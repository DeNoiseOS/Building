import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  badRequest,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api";
import { userHasProjectAccess } from "@/lib/access";
import {
  resolveCustodyContext,
  canIssueCustody,
  custodyVisibilityFilter,
} from "@/lib/custody-data";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notifications";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const createSchema = z.object({
  departmentId: z.string().min(1),
  holderUserId: z.string().min(1),
  amount: z.number().int().min(1).max(10_000_000_00),
  notes: z.string().max(2000).optional().nullable(),
});

/** GET — list custodies visible to the caller. */
export async function GET(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const access = await userHasProjectAccess(guard.userId, id);
  if (!access) return notFound("Project not found.");

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const departmentId = url.searchParams.get("department");

  const cctx = await resolveCustodyContext(guard.userId, id);
  const where: Record<string, unknown> = {
    projectId: id,
    ...custodyVisibilityFilter(cctx),
  };
  if (status) where.status = status;
  if (departmentId) where.departmentId = departmentId;

  const rows = await prisma.custody.findMany({
    where,
    orderBy: { issuedAt: "desc" },
    include: {
      department: { select: { id: true, name: true, kind: true } },
      holder: { select: { id: true, name: true } },
      issuedBy: { select: { id: true, name: true } },
      expenses: {
        where: { status: "purchased" },
        select: { estimatedCost: true },
      },
    },
  });

  return NextResponse.json({
    custodies: rows.map((c) => {
      const spent = c.expenses.reduce((s, e) => s + e.estimatedCost, 0);
      return {
        id: c.id,
        amount: c.amount,
        currency: c.currency,
        status: c.status,
        settlementStatus: c.settlementStatus,
        settlementRequestedAt: c.settlementRequestedAt?.toISOString() ?? null,
        settledAt: c.settledAt?.toISOString() ?? null,
        issuedAt: c.issuedAt.toISOString(),
        notes: c.notes,
        spent,
        remaining: c.amount - spent,
        department: c.department,
        holder: c.holder,
        issuedBy: c.issuedBy,
      };
    }),
  });
}

/** POST — Producer/Owner issues a new custody. */
export async function POST(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const cctx = await resolveCustodyContext(guard.userId, id);
  if (!canIssueCustody(cctx)) {
    return forbidden(
      "Only the department head (or project owner) can issue custody."
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid data.", parsed.error.flatten().fieldErrors);
  }

  // V0.12.3 — head can only issue custody for THEIR OWN dept.
  if (!cctx.isOwner && !canIssueCustody(cctx, parsed.data.departmentId)) {
    return forbidden(
      "You can only issue custody for the department you head."
    );
  }

  const [dept, holder, project] = await Promise.all([
    prisma.department.findFirst({
      where: { id: parsed.data.departmentId, projectId: id },
      select: { id: true, name: true },
    }),
    prisma.user.findUnique({
      where: { id: parsed.data.holderUserId },
      select: { id: true, name: true },
    }),
    prisma.project.findUnique({
      where: { id },
      select: { currency: true },
    }),
  ]);
  if (!dept) return badRequest("Department not found on this project.");
  if (!holder) return badRequest("Holder user not found.");

  // Holder should be a project member.
  const member = await prisma.projectMember.findFirst({
    where: { projectId: id, userId: holder.id },
    select: { id: true },
  });
  if (!member) return badRequest("Holder must be a project member.");

  try {
    const created = await prisma.custody.create({
      data: {
        projectId: id,
        departmentId: dept.id,
        holderUserId: holder.id,
        issuedByUserId: guard.userId,
        amount: parsed.data.amount,
        currency: project?.currency ?? "SAR",
        notes: parsed.data.notes ?? null,
        status: "active",
      },
    });

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "custody_issued",
      message: `issued ${parsed.data.amount / 100} ${project?.currency ?? ""} custody to ${holder.name} (${dept.name}).`,
      metadata: {
        custodyId: created.id,
        departmentId: dept.id,
        holderUserId: holder.id,
        amount: parsed.data.amount,
      },
    });

    if (holder.id !== guard.userId) {
      await notify({
        userId: holder.id,
        type: "custody_issued",
        title: `${guard.userName} issued you a custody`,
        body: `${parsed.data.amount / 100} ${project?.currency ?? ""} — ${dept.name}`,
        link: `/projects/${id}/budget`,
        metadata: {
          custodyId: created.id,
          projectId: id,
          departmentId: dept.id,
        },
      });
    }

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err) {
    console.error("[custodies.POST]", err);
    return serverError("Failed to issue custody.");
  }
}
