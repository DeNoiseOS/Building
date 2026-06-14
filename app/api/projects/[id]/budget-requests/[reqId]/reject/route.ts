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
  canApproveDepartmentExpense,
} from "@/lib/budget-data";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notifications";

interface RouteContext {
  params: Promise<{ id: string; reqId: string }>;
}

const rejectSchema = z
  .object({ reason: z.string().max(500).optional().nullable() })
  .optional();

export async function POST(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, reqId } = await ctx.params;
  const existing = await prisma.budgetRequest.findFirst({
    where: { id: reqId, projectId: id },
    include: { department: { select: { id: true, kind: true } } },
  });
  if (!existing) return notFound("Expense not found.");
  if (
    existing.status !== "submitted" &&
    existing.status !== "pending_department_approval"
  ) {
    return badRequest("Only pending expenses can be rejected.");
  }

  const bctx = await resolveBudgetContext(guard.userId, id);
  if (
    !canApproveDepartmentExpense(bctx, {
      departmentId: existing.departmentId,
      departmentKind: existing.department.kind,
    })
  ) {
    return forbidden(
      "Only the department head (or owner) can reject this expense."
    );
  }

  let body: unknown = undefined;
  try {
    body = await request.json();
  } catch {
    /* body optional */
  }
  const parsed = rejectSchema.safeParse(body);
  const reason = parsed.success ? parsed.data?.reason ?? null : null;

  try {
    const updated = await prisma.budgetRequest.update({
      where: { id: reqId },
      data: {
        status: "rejected",
        rejectedAt: new Date(),
        approvedAt: null,
        rejectionReason: reason,
      },
    });

    // V0.6.1: if a reason was given, persist it as a workflow comment
    // so the rejection discussion lives in one place with the thread.
    if (reason && reason.trim()) {
      await prisma.comment.create({
        data: {
          projectId: id,
          authorId: guard.userId,
          targetType: "purchase_request",
          targetId: reqId,
          body: reason.trim(),
        },
      });
    }

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "purchase_request_rejected",
      message: reason
        ? `rejected purchase request '${updated.title}' — ${reason}`
        : `rejected purchase request '${updated.title}'.`,
      metadata: {
        purchaseRequestId: reqId,
        departmentId: existing.departmentId,
        reason,
      },
    });

    if (existing.requesterId !== guard.userId) {
      await notify({
        userId: existing.requesterId,
        type: "purchase_request_rejected",
        title: "Purchase request rejected",
        body: reason ?? updated.title,
        link: `/projects/${id}/budget`,
        metadata: { purchaseRequestId: reqId, projectId: id },
      });
    }

    return NextResponse.json({ ok: true, status: updated.status });
  } catch (err) {
    console.error("[budget-requests.reject]", err);
    return serverError("Failed to reject.");
  }
}
