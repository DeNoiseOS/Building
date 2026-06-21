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
  canManageEquipment,
} from "@/lib/equipment-data";
import { logActivity } from "@/lib/activity";

interface RouteContext {
  params: Promise<{ id: string; eqId: string; mrId: string }>;
}

const patchSchema = z.object({
  vendor: z.string().max(200).nullable().optional(),
  cost: z.number().int().min(0).max(10_000_000_00).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  /**
   * Set to true to close the record. The asset returns to "available"
   * (unless an open damage report keeps it at "damaged").
   */
  complete: z.boolean().optional(),
});

/** PATCH — edit notes/vendor/cost, or complete the record. */
export async function PATCH(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, eqId, mrId } = await ctx.params;
  const eq = await prisma.equipment.findFirst({
    where: { id: eqId, projectId: id },
    include: { department: { select: { id: true, name: true, kind: true } } },
  });
  if (!eq) return notFound("Equipment not found.");

  const ectx = await resolveEquipmentContext(guard.userId, id);
  if (!canManageEquipment(ectx, eq.department)) {
    return forbidden("Only the dept head (or owner) can update maintenance.");
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mModel = (prisma as any).maintenanceRecord;
  if (!mModel) return serverError("Maintenance model unavailable.");

  const existing = await mModel.findFirst({
    where: { id: mrId, equipmentId: eqId },
  });
  if (!existing) return notFound("Maintenance record not found.");

  try {
    await prisma.$transaction(async (tx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const txM = (tx as any).maintenanceRecord;
      await txM.update({
        where: { id: mrId },
        data: {
          ...(parsed.data.vendor !== undefined && { vendor: parsed.data.vendor }),
          ...(parsed.data.cost !== undefined && { cost: parsed.data.cost }),
          ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
          ...(parsed.data.complete === true && {
            completedAt: existing.completedAt ?? new Date(),
          }),
        },
      });

      // V0.16 — When closing the record AND no other open maintenance
      // exists AND there's no open damage report, return asset to available.
      if (parsed.data.complete === true && !existing.completedAt) {
        const [openMaintCount, openDamageCount] = await Promise.all([
          txM.count({
            where: {
              equipmentId: eqId,
              completedAt: null,
              id: { not: mrId },
            },
          }),
          tx.damageReport.count({
            where: {
              equipmentId: eqId,
              status: { in: ["open", "under_review"] },
            },
          }),
        ]);
        if (openMaintCount === 0 && openDamageCount === 0) {
          await tx.equipment.update({
            where: { id: eqId },
            data: { status: "available" },
          });
        }
      }
    });

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type:
        parsed.data.complete === true
          ? "equipment_maintenance_completed"
          : "equipment_maintenance_updated",
      message:
        parsed.data.complete === true
          ? `completed maintenance on '${eq.name}'.`
          : `updated maintenance record on '${eq.name}'.`,
      metadata: { equipmentId: eqId, maintenanceId: mrId },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[equipment.maintenance.PATCH]", err);
    return serverError("Failed to update maintenance record.");
  }
}

/** DELETE — only allowed while still open. */
export async function DELETE(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, eqId, mrId } = await ctx.params;
  const eq = await prisma.equipment.findFirst({
    where: { id: eqId, projectId: id },
    include: { department: { select: { id: true, kind: true } } },
  });
  if (!eq) return notFound("Equipment not found.");

  const ectx = await resolveEquipmentContext(guard.userId, id);
  if (!canManageEquipment(ectx, eq.department)) {
    return forbidden("Not allowed.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mModel = (prisma as any).maintenanceRecord;
  if (!mModel) return serverError("Maintenance model unavailable.");

  const existing = await mModel.findFirst({
    where: { id: mrId, equipmentId: eqId },
  });
  if (!existing) return notFound("Maintenance record not found.");
  if (existing.completedAt) {
    return badRequest("Completed maintenance records can't be deleted.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const txM = (tx as any).maintenanceRecord;
      await txM.delete({ where: { id: mrId } });
      // Same return-to-available logic as completing.
      const [openMaintCount, openDamageCount] = await Promise.all([
        txM.count({
          where: { equipmentId: eqId, completedAt: null, id: { not: mrId } },
        }),
        tx.damageReport.count({
          where: {
            equipmentId: eqId,
            status: { in: ["open", "under_review"] },
          },
        }),
      ]);
      if (openMaintCount === 0 && openDamageCount === 0) {
        await tx.equipment.update({
          where: { id: eqId },
          data: { status: "available" },
        });
      }
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[equipment.maintenance.DELETE]", err);
    return serverError("Failed.");
  }
}
