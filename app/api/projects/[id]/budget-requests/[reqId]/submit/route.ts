import { NextResponse } from "next/server";
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
  canSubmitBudget,
} from "@/lib/budget-data";
import { departmentHeadUserIds } from "@/lib/project-budget";
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
    include: { department: { select: { name: true } } },
  });
  if (!existing) return notFound("Budget request not found.");
  if (existing.status !== "draft") {
    return badRequest("Only drafts can be submitted.");
  }

  const bctx = await resolveBudgetContext(guard.userId, id);
  if (!canSubmitBudget(bctx, existing)) {
    return forbidden("You can't submit this budget request.");
  }

  try {
    const updated = await prisma.budgetRequest.update({
      where: { id: reqId },
      data: {
        // V0.6.3 — status routes to the *department head*, not producer.
        status: "pending_department_approval",
        submittedAt: new Date(),
      },
    });

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "purchase_request_created",
      message: `submitted an expense '${updated.title}' from ${existing.department.name}.`,
      metadata: {
        purchaseRequestId: reqId,
        departmentId: existing.departmentId,
      },
    });

    // V0.6.3 — notify the dept head(s) of the request's department.
    const heads = await departmentHeadUserIds(id, existing.departmentId);
    for (const userId of heads) {
      if (userId === guard.userId) continue;
      await notify({
        userId,
        type: "purchase_request_submitted",
        title: "Expense pending approval",
        body: `${updated.title} — ${existing.department.name}`,
        link: `/projects/${id}/budget`,
        metadata: { purchaseRequestId: reqId, projectId: id },
      });
    }

    return NextResponse.json({ ok: true, status: updated.status });
  } catch (err) {
    console.error("[budget-requests.submit]", err);
    return serverError("Failed to submit budget request.");
  }
}
