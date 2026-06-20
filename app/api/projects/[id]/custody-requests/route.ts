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
import { resolveCustodyContext, canIssueCustody } from "@/lib/custody-data";
import {
  getDepartmentForRole,
  getDepartmentByKey,
} from "@/lib/department-registry";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notifications";

/**
 * V0.14.1 — Custody Requests.
 *
 * A dept member asks the head for additional cash with a justification.
 * Approve → mints a Custody for the requester; Reject → records a
 * decision reason and notifies them.
 */

const createSchema = z.object({
  departmentId: z.string().min(1),
  amount: z.number().int().min(1).max(10_000_000_00),
  reason: z.string().min(1).max(2000),
});

/** GET — list custody requests visible to the caller. */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const access = await userHasProjectAccess(guard.userId, id);
  if (!access) return notFound("Project not found.");

  const cctx = await resolveCustodyContext(guard.userId, id);
  const sp = new URL(request.url).searchParams;

  // Visibility:
  //   Owner / Producer / EP / Director  → all on the project
  //   Resolved dept head                → requests in depts they head
  //   Anyone else                       → only requests they raised
  const where: Record<string, unknown> = { projectId: id };
  if (sp.get("status")) where.status = sp.get("status");

  if (!cctx.isOwner && cctx.memberRole !== "producer" && cctx.memberRole !== "executive_producer" && cctx.memberRole !== "director") {
    if (cctx.myHeadOfDeptIds.length > 0) {
      where.OR = [
        { departmentId: { in: cctx.myHeadOfDeptIds } },
        { requesterUserId: guard.userId },
      ];
    } else {
      where.requesterUserId = guard.userId;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = (prisma as any).custodyRequest;
  if (!m || typeof m.findMany !== "function") {
    return NextResponse.json({ requests: [] });
  }

  const rows = await m.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      requester: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      decidedBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({
    requests: rows.map(
      (r: {
        id: string;
        amount: number;
        reason: string;
        status: string;
        decidedAt: Date | null;
        decisionReason: string | null;
        createdAt: Date;
        requester: { id: string; name: string };
        department: { id: string; name: string };
        decidedBy: { id: string; name: string } | null;
        fulfilledCustodyId: string | null;
      }) => ({
        id: r.id,
        amount: r.amount,
        reason: r.reason,
        status: r.status,
        decidedAt: r.decidedAt?.toISOString() ?? null,
        decisionReason: r.decisionReason,
        createdAt: r.createdAt.toISOString(),
        requester: r.requester,
        department: r.department,
        decidedBy: r.decidedBy,
        fulfilledCustodyId: r.fulfilledCustodyId,
      })
    ),
  });
}

/** POST — submit a new custody request (dept member). */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const access = await userHasProjectAccess(guard.userId, id);
  if (!access) return notFound("Project not found.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request.", parsed.error.flatten().fieldErrors);
  }

  const dept = await prisma.department.findFirst({
    where: { id: parsed.data.departmentId, projectId: id },
    select: { id: true, key: true, name: true },
  });
  if (!dept) return badRequest("Department not found on this project.");

  // Requester must belong to the dept (role-derived or explicit member).
  const cctx = await resolveCustodyContext(guard.userId, id);
  const callerRole = cctx.memberRole;
  const callerDept = callerRole ? getDepartmentForRole(callerRole) : null;
  const belongsByRole = !!callerDept && callerDept.key === dept.key;
  const belongsByMembership = await prisma.departmentMember.findFirst({
    where: { departmentId: dept.id, userId: guard.userId },
    select: { id: true },
  });
  if (!cctx.isOwner && !belongsByRole && !belongsByMembership) {
    return forbidden("You can only request custody for a department you belong to.");
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = (prisma as any).custodyRequest;
    const created = await m.create({
      data: {
        projectId: id,
        departmentId: dept.id,
        requesterUserId: guard.userId,
        amount: parsed.data.amount,
        reason: parsed.data.reason,
        status: "pending",
      },
    });

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "custody_request_submitted",
      message: `requested additional custody for ${dept.name}.`,
      metadata: {
        custodyRequestId: created.id,
        departmentId: dept.id,
        amount: parsed.data.amount,
      },
    });

    // Notify the resolved dept head.
    const reg = getDepartmentByKey(dept.key);
    if (reg) {
      const presentHeads = await prisma.projectMember.findMany({
        where: { projectId: id, role: { in: reg.headRoles } },
        select: { userId: true, role: true },
      });
      const headRoleMatch = reg.headRoles.find((role) =>
        presentHeads.find((m) => m.role === role)
      );
      const head = headRoleMatch
        ? presentHeads.find((m) => m.role === headRoleMatch)
        : null;
      if (head && head.userId !== guard.userId) {
        await notify({
          userId: head.userId,
          type: "custody_request_submitted",
          title: `${guard.userName} requested additional custody`,
          body: `${parsed.data.amount / 100} for ${dept.name}`,
          link: `/projects/${id}/budget`,
          metadata: {
            custodyRequestId: created.id,
            projectId: id,
            departmentId: dept.id,
          },
        });
      }
    }

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err) {
    console.error("[custody-requests.POST]", err);
    return serverError("Failed to submit custody request.");
  }
}
