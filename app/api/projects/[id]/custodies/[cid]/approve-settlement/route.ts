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
  resolveCustodyContext,
  canApproveSettlement,
} from "@/lib/custody-data";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notifications";

interface RouteContext {
  params: Promise<{ id: string; cid: string }>;
}

/** POST — producer / owner approves a pending settlement → status=settled. */
export async function POST(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, cid } = await ctx.params;
  const cctx = await resolveCustodyContext(guard.userId, id);
  if (!canApproveSettlement(cctx)) {
    return forbidden("Only producer / owner can approve settlement.");
  }

  const existing = await prisma.custody.findFirst({
    where: { id: cid, projectId: id },
    include: { department: { select: { name: true } } },
  });
  if (!existing) return notFound("Custody not found.");
  if (existing.settlementStatus !== "pending") {
    return badRequest("No pending settlement on this custody.");
  }

  const now = new Date();
  try {
    await prisma.custody.update({
      where: { id: cid },
      data: {
        status: "settled",
        settlementStatus: "approved",
        settledAt: now,
      },
    });

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "custody_settlement_approved",
      message: `approved settlement on a custody (${existing.department.name}).`,
      metadata: { custodyId: cid, departmentId: existing.departmentId },
    });

    if (existing.holderUserId !== guard.userId) {
      await notify({
        userId: existing.holderUserId,
        type: "custody_settlement_approved",
        title: "Custody settlement approved",
        body: existing.department.name,
        link: `/projects/${id}/budget`,
        metadata: { custodyId: cid, projectId: id },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[custodies.approve-settlement]", err);
    return serverError("Failed.");
  }
}
