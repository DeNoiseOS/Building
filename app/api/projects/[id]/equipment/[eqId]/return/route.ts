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
  RETURN_CONDITIONS,
} from "@/lib/equipment-data";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notifications";

// V0.16 — Check-in body. Condition is optional but recommended.
const bodySchema = z
  .object({
    returnCondition: z
      .enum(
        RETURN_CONDITIONS.map((c) => c.value) as unknown as [
          string,
          ...string[]
        ]
      )
      .optional()
      .nullable(),
    notes: z.string().max(1000).optional().nullable(),
  })
  .optional();

interface RouteContext {
  params: Promise<{ id: string; eqId: string }>;
}

/**
 * POST — return equipment. Closes the open assignment and flips status
 * back to "returned" (so the open-state badge changes). Either the
 * current holder or a department manager can return.
 */
export async function POST(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, eqId } = await ctx.params;
  const eq = await prisma.equipment.findFirst({
    where: { id: eqId, projectId: id },
    include: {
      department: { select: { id: true, kind: true, name: true } },
      assignments: { where: { returnedAt: null }, take: 1 },
    },
  });
  if (!eq) return notFound("Equipment not found.");
  const open = eq.assignments[0];
  if (!open) return badRequest("No open assignment to return.");

  const ectx = await resolveEquipmentContext(guard.userId, id);
  const isHolder = open.assignedToUserId === guard.userId;
  if (!isHolder && !canManageEquipment(ectx, eq.department)) {
    return forbidden("Not allowed to return this equipment.");
  }

  // V0.16 — capture condition + notes from body.
  let body: unknown = undefined;
  try {
    body = await request.json();
  } catch {
    body = undefined;
  }
  const parsed = bodySchema.safeParse(body);
  const condition = parsed.success ? parsed.data?.returnCondition ?? null : null;
  const returnNotes = parsed.success ? parsed.data?.notes ?? null : null;

  // V0.16 — if returned damaged, flip equipment status to "damaged",
  // not "available", so the next user sees the bad state.
  const nextStatus =
    condition === "damaged" ? "damaged" : "available";

  try {
    await prisma.$transaction([
      prisma.equipmentAssignment.update({
        where: { id: open.id },
        data: {
          returnedAt: new Date(),
          returnedByUserId: guard.userId,
          returnCondition: condition,
          ...(returnNotes ? { notes: returnNotes } : {}),
        },
      }),
      prisma.equipment.update({
        where: { id: eqId },
        data: { status: nextStatus },
      }),
    ]);

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "equipment_returned",
      message: `returned '${eq.name}'.`,
      metadata: { equipmentId: eqId, departmentId: eq.departmentId },
    });

    // Notify the assigner (if not the same person returning).
    if (open.assignedByUserId !== guard.userId) {
      await notify({
        userId: open.assignedByUserId,
        type: "equipment_returned",
        title: `${guard.userName} returned equipment`,
        body: `${eq.name} — ${eq.department.name}`,
        link: `/projects/${id}/equipment/${eqId}`,
        metadata: { equipmentId: eqId, projectId: id },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[equipment.return]", err);
    return serverError("Failed.");
  }
}
