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
import {
  resolveBudgetContext,
  budgetVisibilityFilter,
  canEditBudget,
} from "@/lib/budget-data";
import { logActivity } from "@/lib/activity";

interface RouteContext {
  params: Promise<{ id: string; reqId: string }>;
}

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  vendor: z.string().max(200).optional().nullable(),
  estimatedCost: z.number().int().min(0).max(1_000_000_00).optional(),
  needByDate: z.string().datetime().optional().nullable(),
  departmentId: z.string().optional(),
});

async function loadOrNull(projectId: string, reqId: string) {
  return prisma.budgetRequest.findFirst({
    where: { id: reqId, projectId },
    include: {
      department: { select: { id: true, name: true, kind: true } },
      requester: { select: { id: true, name: true } },
    },
  });
}

/** GET — single request. */
export async function GET(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, reqId } = await ctx.params;
  const bctx = await resolveBudgetContext(guard.userId, id);
  const row = await prisma.budgetRequest.findFirst({
    where: { id: reqId, projectId: id, ...budgetVisibilityFilter(bctx) },
    include: {
      department: { select: { id: true, name: true, kind: true } },
      requester: { select: { id: true, name: true } },
    },
  });
  if (!row) return notFound("Budget request not found.");

  return NextResponse.json({
    id: row.id,
    title: row.title,
    description: row.description,
    vendor: row.vendor,
    estimatedCost: row.estimatedCost,
    needByDate: row.needByDate?.toISOString() ?? null,
    status: row.status,
    department: row.department,
    requester: row.requester,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    purchasedAt: row.purchasedAt?.toISOString() ?? null,
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

/** PATCH — edit fields (only when authorized). */
export async function PATCH(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, reqId } = await ctx.params;
  const existing = await loadOrNull(id, reqId);
  if (!existing) return notFound("Budget request not found.");

  const bctx = await resolveBudgetContext(guard.userId, id);
  if (!canEditBudget(bctx, existing)) {
    return forbidden("You can't edit this budget request.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid data.", parsed.error.flatten().fieldErrors);
  }

  if (parsed.data.departmentId) {
    const dept = await prisma.department.findFirst({
      where: { id: parsed.data.departmentId, projectId: id },
      select: { id: true },
    });
    if (!dept) return badRequest("Department not found on this project.");
  }

  try {
    const updated = await prisma.budgetRequest.update({
      where: { id: reqId },
      data: {
        ...(parsed.data.title !== undefined && { title: parsed.data.title.trim() }),
        ...(parsed.data.description !== undefined && {
          description: parsed.data.description,
        }),
        ...(parsed.data.vendor !== undefined && { vendor: parsed.data.vendor }),
        ...(parsed.data.estimatedCost !== undefined && {
          estimatedCost: parsed.data.estimatedCost,
        }),
        ...(parsed.data.needByDate !== undefined && {
          needByDate: parsed.data.needByDate
            ? new Date(parsed.data.needByDate)
            : null,
        }),
        ...(parsed.data.departmentId !== undefined && {
          departmentId: parsed.data.departmentId,
        }),
      },
    });

    return NextResponse.json({ id: updated.id });
  } catch (err) {
    console.error("[budget-requests.PATCH]", err);
    return serverError("Failed to update budget request.");
  }
}

/** DELETE — only drafts, and only the requester (or owner/producer). */
export async function DELETE(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, reqId } = await ctx.params;
  const existing = await loadOrNull(id, reqId);
  if (!existing) return notFound("Budget request not found.");

  const bctx = await resolveBudgetContext(guard.userId, id);
  if (
    !(
      bctx.isOwner ||
      bctx.memberRole === "producer" ||
      (existing.status === "draft" && existing.requesterId === guard.userId)
    )
  ) {
    return forbidden("You can't delete this budget request.");
  }

  try {
    await prisma.budgetRequest.delete({ where: { id: reqId } });
    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "budget_request_rejected",
      message: `deleted budget request '${existing.title}'.`,
      metadata: { budgetRequestId: reqId },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[budget-requests.DELETE]", err);
    return serverError("Failed to delete.");
  }
}
