import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  badRequest,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api";
import { logActivity } from "@/lib/activity";

/**
 * V0.14.4 — Withdraw a pending custody request.
 *
 * Only the requester may withdraw, and only while the request is still
 * `pending`. We use a soft status flip ("withdrawn") instead of a hard
 * delete so the audit trail and any notifications already sent stay
 * intact. Approval-queue UIs filter for `status === "pending"` so
 * withdrawn rows naturally disappear from heads' views.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string; reqId: string }> }
) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, reqId } = await ctx.params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = (prisma as any).custodyRequest;
  if (!m) return serverError("Custody requests not available.");

  const req = await m.findFirst({
    where: { id: reqId, projectId: id },
    include: {
      department: { select: { id: true, name: true } },
      requester: { select: { id: true, name: true } },
    },
  });
  if (!req) return notFound("Custody request not found.");

  if (req.requester.id !== guard.userId) {
    return forbidden("Only the requester can withdraw this request.");
  }
  if (req.status !== "pending") {
    return badRequest("Only pending requests can be withdrawn.");
  }

  try {
    await m.update({
      where: { id: reqId },
      data: {
        status: "withdrawn",
        decidedByUserId: guard.userId,
        decidedAt: new Date(),
        decisionReason: "Withdrawn by requester.",
      },
    });

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "custody_request_withdrawn",
      message: `withdrew their custody request for ${req.department.name}.`,
      metadata: {
        custodyRequestId: reqId,
        departmentId: req.department.id,
        amount: req.amount,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[custody-request.withdraw]", err);
    return serverError("Failed to withdraw custody request.");
  }
}
