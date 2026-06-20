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
import { resolveCustodyContext, canIssueCustody } from "@/lib/custody-data";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notifications";

const bodySchema = z
  .object({ reason: z.string().max(1000).optional().nullable() })
  .optional();

/**
 * V0.14.1 — Reject a pending custody request.
 * Resolved dept head (or project owner) only. Reason optional.
 */
export async function POST(
  request: Request,
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
  if (req.status !== "pending") {
    return badRequest("Only pending requests can be rejected.");
  }

  const cctx = await resolveCustodyContext(guard.userId, id);
  if (!cctx.isOwner && !canIssueCustody(cctx, req.department.id)) {
    return forbidden(
      "Only the department head (or owner) can reject this request."
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = undefined;
  }
  const parsed = bodySchema.safeParse(body);
  const reason = parsed.success ? parsed.data?.reason ?? null : null;

  try {
    await m.update({
      where: { id: reqId },
      data: {
        status: "rejected",
        decidedByUserId: guard.userId,
        decidedAt: new Date(),
        decisionReason: reason,
      },
    });

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "custody_request_rejected",
      message: `rejected ${req.requester.name}'s custody request.`,
      metadata: {
        custodyRequestId: reqId,
        departmentId: req.department.id,
        reason,
      },
    });

    if (req.requester.id !== guard.userId) {
      await notify({
        userId: req.requester.id,
        type: "custody_request_rejected",
        title: `${guard.userName} rejected your custody request`,
        body: reason ?? `${req.amount / 100} for ${req.department.name}`,
        link: `/projects/${id}/budget`,
        metadata: { custodyRequestId: reqId, projectId: id },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[custody-request.reject]", err);
    return serverError("Failed to reject custody request.");
  }
}
