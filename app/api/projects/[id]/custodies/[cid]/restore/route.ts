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

/**
 * V0.14 — Restore a cancelled custody back to active.
 *
 * Only the original issuer authority (resolved dept head or owner) can
 * restore. Settled custodies cannot be restored (settlement is final;
 * cancel and reissue if needed).
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string; cid: string }> }
) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, cid } = await ctx.params;
  const existing = await prisma.custody.findFirst({
    where: { id: cid, projectId: id },
    include: {
      department: { select: { id: true, name: true } },
      holder: { select: { id: true, name: true } },
    },
  });
  if (!existing) return notFound("Custody not found.");

  if (existing.status !== "cancelled") {
    return badRequest("Only cancelled custodies can be restored.");
  }

  const cctx = await resolveCustodyContext(guard.userId, id);
  if (!cctx.isOwner && !canIssueCustody(cctx, existing.department.id)) {
    return forbidden(
      "Only the department head (or owner) can restore this custody."
    );
  }

  try {
    await prisma.custody.update({
      where: { id: cid },
      data: {
        status: "active",
        settlementStatus: null,
        settlementRequestedAt: null,
        settledAt: null,
      },
    });

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "custody_restored",
      message: `restored custody for ${existing.holder.name} (${existing.department.name}).`,
      metadata: { custodyId: cid, departmentId: existing.department.id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[custody.restore]", err);
    return serverError("Failed to restore custody.");
  }
}
