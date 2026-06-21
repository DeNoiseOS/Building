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
  MAINTENANCE_TYPE_VALUES,
} from "@/lib/equipment-data";
import { logActivity } from "@/lib/activity";

interface RouteContext {
  params: Promise<{ id: string; eqId: string }>;
}

const createSchema = z.object({
  type: z.enum(
    MAINTENANCE_TYPE_VALUES as unknown as [string, ...string[]]
  ),
  vendor: z.string().max(200).optional().nullable(),
  cost: z.number().int().min(0).max(10_000_000_00).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  /**
   * If true, this is logged as historical maintenance that is already
   * complete (e.g. a back-dated inspection). Otherwise the asset goes
   * into in_maintenance until the record is closed via PATCH.
   */
  completed: z.boolean().optional().default(false),
});

/** GET — list maintenance records for an asset. */
export async function GET(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, eqId } = await ctx.params;
  const eq = await prisma.equipment.findFirst({
    where: { id: eqId, projectId: id },
    select: { id: true },
  });
  if (!eq) return notFound("Equipment not found.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = (prisma as any).maintenanceRecord;
  if (!m) return NextResponse.json({ maintenance: [] });

  const rows = await m.findMany({
    where: { equipmentId: eqId },
    orderBy: { startedAt: "desc" },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ maintenance: rows });
}

/** POST — open a maintenance record. Resolved dept head / owner only. */
export async function POST(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, eqId } = await ctx.params;
  const eq = await prisma.equipment.findFirst({
    where: { id: eqId, projectId: id },
    include: { department: { select: { id: true, name: true, kind: true } } },
  });
  if (!eq) return notFound("Equipment not found.");

  const ectx = await resolveEquipmentContext(guard.userId, id);
  if (!canManageEquipment(ectx, eq.department)) {
    return forbidden("Only the dept head (or owner) can log maintenance.");
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mModel = (prisma as any).maintenanceRecord;
    const now = new Date();
    const created = await prisma.$transaction(async (tx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const txM = (tx as any).maintenanceRecord;
      const record = await txM.create({
        data: {
          equipmentId: eqId,
          createdByUserId: guard.userId,
          type: parsed.data.type,
          vendor: parsed.data.vendor ?? null,
          cost: parsed.data.cost ?? null,
          notes: parsed.data.notes ?? null,
          startedAt: now,
          completedAt: parsed.data.completed ? now : null,
        },
      });
      // V0.16 — flip asset to in_maintenance when the record is open.
      // Skip if already damaged/retired/lost — those states take precedence.
      if (!parsed.data.completed && eq.status !== "damaged" && eq.status !== "retired" && eq.status !== "lost") {
        await tx.equipment.update({
          where: { id: eqId },
          data: { status: "in_maintenance" },
        });
      }
      return record;
    });
    void mModel;

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "equipment_maintenance_logged",
      message: `logged ${parsed.data.type} maintenance on '${eq.name}'.`,
      metadata: {
        equipmentId: eqId,
        departmentId: eq.departmentId,
        maintenanceId: created.id,
        type: parsed.data.type,
      },
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err) {
    console.error("[equipment.maintenance.POST]", err);
    return serverError("Failed to log maintenance.");
  }
}
