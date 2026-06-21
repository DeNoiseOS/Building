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
  resolveEquipmentContext,
  canManageEquipment,
} from "@/lib/equipment-data";
import { logActivity } from "@/lib/activity";

/**
 * V0.16 — Mark a damage report as "under review".
 *
 * Owner / dept-head transition for a damage report that's been
 * acknowledged but not yet resolved. Asset stays "damaged" through
 * this state.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string; eqId: string; drId: string }> }
) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, eqId, drId } = await ctx.params;
  const eq = await prisma.equipment.findFirst({
    where: { id: eqId, projectId: id },
    include: { department: { select: { id: true, name: true, kind: true } } },
  });
  if (!eq) return notFound("Equipment not found.");

  const report = await prisma.damageReport.findFirst({
    where: { id: drId, equipmentId: eqId },
  });
  if (!report) return notFound("Damage report not found.");
  if (report.status !== "open") {
    return badRequest("Only open reports can move to under_review.");
  }

  const ectx = await resolveEquipmentContext(guard.userId, id);
  if (!canManageEquipment(ectx, eq.department)) {
    return forbidden("Only the dept head (or owner) can review damage reports.");
  }

  try {
    await prisma.damageReport.update({
      where: { id: drId },
      data: { status: "under_review" },
    });

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "damage_report_reviewed",
      message: `marked damage report on '${eq.name}' as under review.`,
      metadata: { equipmentId: eqId, damageReportId: drId },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[damage-report.review]", err);
    return serverError("Failed to update damage report.");
  }
}
