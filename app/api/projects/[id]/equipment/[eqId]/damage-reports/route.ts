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
import { userHasProjectAccess } from "@/lib/access";
import {
  resolveEquipmentContext,
  canFileDamageReport,
  DAMAGE_SEVERITY,
} from "@/lib/equipment-data";
import { logActivity } from "@/lib/activity";
import { notifyMany } from "@/lib/notifications";

interface RouteContext {
  params: Promise<{ id: string; eqId: string }>;
}

const createSchema = z.object({
  description: z.string().min(1).max(2000),
  severity: z
    .enum(DAMAGE_SEVERITY.map((s) => s.value) as unknown as [string, ...string[]])
    .default("low"),
});

/** POST — file a damage report on a piece of equipment. */
export async function POST(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, eqId } = await ctx.params;
  const access = await userHasProjectAccess(guard.userId, id);
  if (!access) return notFound("Project not found.");

  const eq = await prisma.equipment.findFirst({
    where: { id: eqId, projectId: id },
    include: { department: { select: { id: true, name: true, kind: true } } },
  });
  if (!eq) return notFound("Equipment not found.");

  const ectx = await resolveEquipmentContext(guard.userId, id);
  if (!canFileDamageReport(ectx)) {
    return forbidden("Not allowed.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid data.", parsed.error.flatten().fieldErrors);
  }

  try {
    const report = await prisma.damageReport.create({
      data: {
        equipmentId: eqId,
        reportedByUserId: guard.userId,
        description: parsed.data.description.trim(),
        severity: parsed.data.severity,
        status: "open",
      },
    });

    // Severity high / critical flips status to "damaged".
    if (
      parsed.data.severity === "high" ||
      parsed.data.severity === "critical"
    ) {
      await prisma.equipment.update({
        where: { id: eqId },
        data: { status: "damaged" },
      });
    }

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "damage_report_created",
      message: `reported ${parsed.data.severity} damage on '${eq.name}'.`,
      metadata: {
        equipmentId: eqId,
        damageReportId: report.id,
        severity: parsed.data.severity,
        departmentId: eq.departmentId,
      },
    });

    // Notify project owner + producers + dept head (by ProjectMember.role).
    const project = await prisma.project.findUnique({
      where: { id },
      select: { userId: true },
    });
    const heads = await prisma.projectMember.findMany({
      where: {
        projectId: id,
        role: { in: ["producer", eq.department.kind] },
      },
      select: { userId: true },
    });
    const targets = new Set<string>();
    if (project) targets.add(project.userId);
    heads.forEach((h) => targets.add(h.userId));
    await notifyMany(Array.from(targets), {
      type: "damage_report_created",
      title: `Damage reported: ${eq.name}`,
      body: `${parsed.data.severity} · ${eq.department.name}`,
      link: `/projects/${id}/equipment/${eqId}`,
      metadata: {
        damageReportId: report.id,
        equipmentId: eqId,
        projectId: id,
      },
      skipUserId: guard.userId,
    });

    return NextResponse.json({ id: report.id }, { status: 201 });
  } catch (err) {
    console.error("[damage-reports.POST]", err);
    return serverError("Failed.");
  }
}
