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

const bodySchema = z
  .object({ comment: z.string().max(2000).optional().nullable() })
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
  // V0.6.3 — accept both legacy "submitted" and new vocab.
  if (
    existing.status !== "submitted" &&
    existing.status !== "pending_department_approval"
  ) {
    return badRequest("Only pending expenses can be approved.");
  }

  const bctx = await resolveBudgetContext(guard.userId, id);
  if (
    !canApproveDepartmentExpense(bctx, {
      departmentId: existing.departmentId,
      departmentKind: existing.department.kind,
    })
  ) {
    return forbidden(
      "Only the department head (or owner) can approve this expense."
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = undefined;
  }
  const parsed = bodySchema.safeParse(body);
  const comment = parsed.success ? parsed.data?.comment ?? null : null;

  try {
    const updated = await prisma.budgetRequest.update({
      where: { id: reqId },
      data: {
        status: "approved",
        approvedAt: new Date(),
        rejectedAt: null,
        rejectionReason: null,
      },
    });

    if (comment && comment.trim()) {
      await prisma.comment.create({
        data: {
          projectId: id,
          authorId: guard.userId,
          targetType: "purchase_request",
          targetId: reqId,
          body: comment.trim(),
        },
      });
    }

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "purchase_request_approved",
      message: `approved purchase request '${updated.title}'.`,
      metadata: {
        purchaseRequestId: reqId,
        departmentId: existing.departmentId,
      },
    });

    if (existing.requesterId !== guard.userId) {
      await notify({
        userId: existing.requesterId,
        type: "purchase_request_approved",
        title: "Purchase request approved",
        body: updated.title,
        link: `/projects/${id}/budget`,
        metadata: { purchaseRequestId: reqId, projectId: id },
      });
    }

    return NextResponse.json({ ok: true, status: updated.status });
  } catch (err) {
    console.error("[budget-requests.approve]", err);
    return serverError("Failed to approve.");
  }
}
