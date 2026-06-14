import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  badRequest,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api";
import { resolveBudgetContext, canMarkPurchased } from "@/lib/budget-data";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notifications";

interface RouteContext {
  params: Promise<{ id: string; reqId: string }>;
}

export async function POST(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, reqId } = await ctx.params;
  const existing = await prisma.budgetRequest.findFirst({
    where: { id: reqId, projectId: id },
    include: { department: { select: { id: true, kind: true } } },
  });
  if (!existing) return notFound("Expense not found.");
  if (existing.status !== "approved") {
    return badRequest("Only approved expenses can be marked purchased.");
  }

  const bctx = await resolveBudgetContext(guard.userId, id);
  if (
    !canMarkPurchased(bctx, {
      departmentId: existing.departmentId,
      departmentKind: existing.department.kind,
    })
  ) {
    return forbidden(
      "Only the department head (or owner) can mark this purchased."
    );
  }

  try {
    const updated = await prisma.budgetRequest.update({
      where: { id: reqId },
      data: { status: "purchased", purchasedAt: new Date() },
    });

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "purchase_completed",
      message: `marked purchase '${updated.title}' completed.`,
      metadata: {
        purchaseRequestId: reqId,
        departmentId: existing.departmentId,
      },
    });

    if (existing.requesterId !== guard.userId) {
      await notify({
        userId: existing.requesterId,
        type: "purchase_completed",
        title: "Purchase completed",
        body: updated.title,
        link: `/projects/${id}/budget`,
        metadata: { purchaseRequestId: reqId, projectId: id },
      });
    }

    return NextResponse.json({ ok: true, status: updated.status });
  } catch (err) {
    console.error("[budget-requests.purchase]", err);
    return serverError("Failed to mark purchased.");
  }
}
