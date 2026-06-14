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
import { notify } from "@/lib/notifications";

interface RouteContext {
  params: Promise<{ id: string; eqId: string }>;
}

const bodySchema = z.object({
  assignedToUserId: z.string().min(1),
  notes: z.string().max(1000).optional().nullable(),
});

/** POST — assign equipment. Marks status=checked_out + opens an assignment. */
export async function POST(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, eqId } = await ctx.params;
  const eq = await prisma.equipment.findFirst({
    where: { id: eqId, projectId: id },
    include: { department: { select: { id: true, kind: true, name: true } } },
  });
  if (!eq) return notFound("Equipment not found.");
  if (eq.status === "lost") {
    return badRequest("Cannot assign lost equipment.");
  }

  const ectx = await resolveEquipmentContext(guard.userId, id);
  if (!canManageEquipment(ectx, eq.department)) {
    return forbidden("Not allowed to assign this equipment.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid data.", parsed.error.flatten().fieldErrors);
  }

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.assignedToUserId },
    select: { id: true, name: true },
  });
  if (!target) return badRequest("Assignee user not found.");

  try {
    // Close any open assignment defensively.
    await prisma.equipmentAssignment.updateMany({
      where: { equipmentId: eqId, returnedAt: null },
      data: { returnedAt: new Date() },
    });

    await prisma.$transaction([
      prisma.equipmentAssignment.create({
        data: {
          equipmentId: eqId,
          assignedToUserId: target.id,
          assignedByUserId: guard.userId,
          notes: parsed.data.notes ?? null,
        },
      }),
      prisma.equipment.update({
        where: { id: eqId },
        data: { status: "checked_out" },
      }),
    ]);

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "equipment_assigned",
      message: `assigned '${eq.name}' to ${target.name}.`,
      metadata: {
        equipmentId: eqId,
        assignedToUserId: target.id,
        departmentId: eq.departmentId,
      },
    });

    if (target.id !== guard.userId) {
      await notify({
        userId: target.id,
        type: "equipment_assigned",
        title: `${guard.userName} assigned you equipment`,
        body: `${eq.name} — ${eq.department.name}`,
        link: `/projects/${id}/equipment/${eqId}`,
        metadata: { equipmentId: eqId, projectId: id },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[equipment.assign]", err);
    return serverError("Failed to assign.");
  }
}
