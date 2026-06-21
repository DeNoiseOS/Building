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
  canManageEquipment,
  EQUIPMENT_STATUS,
} from "@/lib/equipment-data";
import { logActivity } from "@/lib/activity";

interface RouteContext {
  params: Promise<{ id: string; eqId: string }>;
}

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  serialNumber: z.string().max(200).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  status: z
    .enum(EQUIPMENT_STATUS.map((s) => s.value) as unknown as [string, ...string[]])
    .optional(),
  // V0.16 — asset profile.
  purchaseDate: z.string().datetime().nullable().optional(),
  purchaseCost: z
    .number()
    .int()
    .min(0)
    .max(10_000_000_00)
    .nullable()
    .optional(),
});

/** GET — single equipment with assignment history + damage reports. */
export async function GET(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, eqId } = await ctx.params;
  const access = await userHasProjectAccess(guard.userId, id);
  if (!access) return notFound("Project not found.");

  const eq = await prisma.equipment.findFirst({
    where: { id: eqId, projectId: id },
    include: {
      department: { select: { id: true, name: true, kind: true } },
      assignments: {
        orderBy: { assignedAt: "desc" },
        include: {
          assignedTo: { select: { id: true, name: true } },
          assignedBy: { select: { id: true, name: true } },
        },
      },
      damageReports: {
        orderBy: { createdAt: "desc" },
        include: { reportedBy: { select: { id: true, name: true } } },
      },
    },
  });
  if (!eq) return notFound("Equipment not found.");

  return NextResponse.json({
    id: eq.id,
    name: eq.name,
    serialNumber: eq.serialNumber,
    category: eq.category,
    notes: eq.notes,
    status: eq.status,
    department: eq.department,
    assignments: eq.assignments.map((a) => ({
      id: a.id,
      assignedTo: a.assignedTo,
      assignedBy: a.assignedBy,
      assignedAt: a.assignedAt.toISOString(),
      returnedAt: a.returnedAt?.toISOString() ?? null,
      notes: a.notes,
    })),
    damageReports: eq.damageReports.map((d) => ({
      id: d.id,
      reportedBy: d.reportedBy,
      description: d.description,
      severity: d.severity,
      status: d.status,
      createdAt: d.createdAt.toISOString(),
      resolvedAt: d.resolvedAt?.toISOString() ?? null,
      resolution: d.resolution,
    })),
    createdAt: eq.createdAt.toISOString(),
    updatedAt: eq.updatedAt.toISOString(),
  });
}

export async function PATCH(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, eqId } = await ctx.params;
  const eq = await prisma.equipment.findFirst({
    where: { id: eqId, projectId: id },
    include: { department: { select: { id: true, kind: true } } },
  });
  if (!eq) return notFound("Equipment not found.");

  const ectx = await resolveEquipmentContext(guard.userId, id);
  if (!canManageEquipment(ectx, eq.department)) {
    return forbidden("Not allowed.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid data.", parsed.error.flatten().fieldErrors);
  }

  try {
    const updated = await prisma.equipment.update({
      where: { id: eqId },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name.trim() }),
        ...(parsed.data.serialNumber !== undefined && {
          serialNumber: parsed.data.serialNumber,
        }),
        ...(parsed.data.category !== undefined && {
          category: parsed.data.category,
        }),
        ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
        ...(parsed.data.status !== undefined && { status: parsed.data.status }),
        // V0.16 — asset profile.
        ...(parsed.data.purchaseDate !== undefined && {
          purchaseDate: parsed.data.purchaseDate
            ? new Date(parsed.data.purchaseDate)
            : null,
        }),
        ...(parsed.data.purchaseCost !== undefined && {
          purchaseCost: parsed.data.purchaseCost,
        }),
      },
    });

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "equipment_updated",
      message: `updated equipment '${updated.name}'.`,
      metadata: { equipmentId: eqId },
    });

    return NextResponse.json({ id: updated.id });
  } catch (err) {
    console.error("[equipment.PATCH]", err);
    return serverError("Failed to update.");
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, eqId } = await ctx.params;
  const eq = await prisma.equipment.findFirst({
    where: { id: eqId, projectId: id },
    include: { department: { select: { id: true, kind: true } } },
  });
  if (!eq) return notFound("Equipment not found.");

  const ectx = await resolveEquipmentContext(guard.userId, id);
  if (!canManageEquipment(ectx, eq.department)) {
    return forbidden("Not allowed.");
  }

  try {
    await prisma.equipment.delete({ where: { id: eqId } });
    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "equipment_deleted",
      message: `removed equipment '${eq.name}'.`,
      metadata: { equipmentId: eqId },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[equipment.DELETE]", err);
    return serverError("Failed to delete.");
  }
}
