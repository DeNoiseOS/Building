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

// V0.14.4 — Rejection reason is now required (min 3 chars).
const bodySchema = z.object({
  reason: z.string().trim().min(3, "Please give a reason (3+ characters).").max(1000),
});

/**
 * V0.14 — Reject a pending Purchase. Reason optional.
 * Resolved dept head (or project owner) only.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string; purchaseId: string }> }
) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, purchaseId } = await ctx.params;
  const existing = await prisma.purchase.findFirst({
    where: { id: purchaseId, projectId: id },
    include: {
      department: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
  if (!existing) return notFound("Purchase not found.");
  if (existing.status !== "pending") {
    return badRequest("Only pending purchases can be rejected.");
  }

  const cctx = await resolveCustodyContext(guard.userId, id);
  if (!cctx.isOwner && !canIssueCustody(cctx, existing.department.id)) {
    return forbidden(
      "Only the department head (or owner) can reject this purchase."
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("A reason is required.");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(
      "A rejection reason is required (3+ characters).",
      parsed.error.flatten().fieldErrors
    );
  }
  const reason = parsed.data.reason.trim();

  try {
    await prisma.purchase.update({
      where: { id: purchaseId },
      data: {
        status: "rejected",
        rejectedAt: new Date(),
        rejectionReason: reason,
        approvedByUserId: null,
        approvedAt: null,
      },
    });

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "purchase_rejected",
      message: `rejected ${existing.type} '${existing.name}' for ${existing.department.name}.`,
      metadata: {
        purchaseId,
        departmentId: existing.department.id,
        reason,
      },
    });

    if (existing.createdBy.id !== guard.userId) {
      await notify({
        userId: existing.createdBy.id,
        type: "purchase_rejected",
        title: `${guard.userName} rejected your purchase`,
        body: reason ?? `${existing.name} — ${existing.department.name}`,
        link: `/projects/${id}/budget`,
        metadata: {
          purchaseId,
          projectId: id,
          departmentId: existing.department.id,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[purchase.reject]", err);
    return serverError("Failed to reject purchase.");
  }
}
