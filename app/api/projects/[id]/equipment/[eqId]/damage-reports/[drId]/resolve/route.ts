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
  resolveEquipmentContext,
  canResolveDamageReport,
} from "@/lib/equipment-data";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notifications";

interface RouteContext {
  params: Promise<{ id: string; eqId: string; drId: string }>;
}

const bodySchema = z
  .object({
    resolution: z.string().max(1000).optional().nullable(),
  })
  .optional();

/** POST — equipment manager resolves an open damage report. */
export async function POST(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, eqId, drId } = await ctx.params;
  const report = await prisma.damageReport.findFirst({
    where: { id: drId, equipmentId: eqId },
    include: {
      equipment: {
        select: { id: true, name: true, projectId: true, departmentId: true },
      },
    },
  });
  if (!report || report.equipment.projectId !== id) {
    return notFound("Damage report not found.");
  }
  if (report.status === "resolved") {
    return badRequest("Already resolved.");
  }

  const dept = await prisma.department.findUnique({
    where: { id: report.equipment.departmentId },
    select: { id: true, kind: true },
  });
  if (!dept) return notFound("Department not found.");

  const ectx = await resolveEquipmentContext(guard.userId, id);
  if (!canResolveDamageReport(ectx, dept)) {
    return forbidden("Not allowed.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = undefined;
  }
  const parsed = bodySchema.safeParse(body);
  const resolution = parsed.success
    ? parsed.data?.resolution ?? null
    : null;

  try {
    await prisma.damageReport.update({
      where: { id: drId },
      data: {
        status: "resolved",
        resolvedAt: new Date(),
        resolution,
      },
    });

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "damage_report_resolved",
      message: `resolved a damage report on '${report.equipment.name}'.`,
      metadata: { damageReportId: drId, equipmentId: eqId },
    });

    if (report.reportedByUserId !== guard.userId) {
      await notify({
        userId: report.reportedByUserId,
        type: "damage_report_resolved",
        title: `Damage report resolved`,
        body: report.equipment.name,
        link: `/projects/${id}/equipment/${eqId}`,
        metadata: { damageReportId: drId, equipmentId: eqId, projectId: id },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[damage-reports.resolve]", err);
    return serverError("Failed.");
  }
}
