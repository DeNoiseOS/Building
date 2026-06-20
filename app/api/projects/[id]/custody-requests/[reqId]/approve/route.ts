import { NextResponse } from "next/server";
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

/**
 * V0.14.1 — Approve a pending custody request.
 *
 * On approval, mint a fresh Custody to the requester with the requested
 * amount. The approving head is recorded as the issuer.
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
  if (req.status !== "pending") {
    return badRequest("Only pending requests can be approved.");
  }

  const cctx = await resolveCustodyContext(guard.userId, id);
  if (!cctx.isOwner && !canIssueCustody(cctx, req.department.id)) {
    return forbidden(
      "Only the department head (or owner) can approve this request."
    );
  }

  try {
    // Mint the custody + mark the request fulfilled in a single transaction.
    const project = await prisma.project.findUnique({
      where: { id },
      select: { currency: true },
    });
    const result = await prisma.$transaction(async (tx) => {
      const custody = await tx.custody.create({
        data: {
          projectId: id,
          departmentId: req.department.id,
          holderUserId: req.requester.id,
          issuedByUserId: guard.userId,
          amount: req.amount,
          currency: project?.currency ?? "SAR",
          notes: `Approved custody request: ${req.reason}`.slice(0, 2000),
          status: "active",
        },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (tx as any).custodyRequest.update({
        where: { id: reqId },
        data: {
          status: "approved",
          decidedByUserId: guard.userId,
          decidedAt: new Date(),
          decisionReason: null,
          fulfilledCustodyId: custody.id,
        },
      });
      return custody;
    });

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "custody_request_approved",
      message: `approved ${req.requester.name}'s custody request for ${req.department.name}.`,
      metadata: {
        custodyRequestId: reqId,
        custodyId: result.id,
        departmentId: req.department.id,
        amount: req.amount,
      },
    });

    if (req.requester.id !== guard.userId) {
      await notify({
        userId: req.requester.id,
        type: "custody_request_approved",
        title: `${guard.userName} approved your custody request`,
        body: `${req.amount / 100} for ${req.department.name}`,
        link: `/projects/${id}/budget`,
        metadata: {
          custodyRequestId: reqId,
          custodyId: result.id,
          projectId: id,
        },
      });
    }

    return NextResponse.json({ ok: true, custodyId: result.id });
  } catch (err) {
    console.error("[custody-request.approve]", err);
    return serverError("Failed to approve custody request.");
  }
}
