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

// V0.16 — Assign to a user OR a department. Exactly one required.
const bodySchema = z
  .object({
    assignedToUserId: z.string().min(1).optional().nullable(),
    assignedToDepartmentId: z.string().min(1).optional().nullable(),
    expectedReturnDate: z.string().datetime().optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
  })
  .refine(
    (d) => !!d.assignedToUserId !== !!d.assignedToDepartmentId,
    {
      message: "Provide exactly one of assignedToUserId or assignedToDepartmentId.",
      path: ["assignedToUserId"],
    }
  );

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

  // V0.16 — Resolve target (user OR department).
  let targetUserId: string | null = null;
  let targetUserName: string | null = null;
  let targetDeptId: string | null = null;
  let targetDeptName: string | null = null;
  if (parsed.data.assignedToUserId) {
    const target = await prisma.user.findUnique({
      where: { id: parsed.data.assignedToUserId },
      select: { id: true, name: true },
    });
    if (!target) return badRequest("Assignee user not found.");
    targetUserId = target.id;
    targetUserName = target.name;
  } else if (parsed.data.assignedToDepartmentId) {
    const targetDept = await prisma.department.findFirst({
      where: { id: parsed.data.assignedToDepartmentId, projectId: id },
      select: { id: true, name: true },
    });
    if (!targetDept) return badRequest("Target department not found on this project.");
    targetDeptId = targetDept.id;
    targetDeptName = targetDept.name;
  }

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
          assignedToUserId: targetUserId,
          assignedToDepartmentId: targetDeptId,
          assignedByUserId: guard.userId,
          expectedReturnDate: parsed.data.expectedReturnDate
            ? new Date(parsed.data.expectedReturnDate)
            : null,
          notes: parsed.data.notes ?? null,
        },
      }),
      prisma.equipment.update({
        where: { id: eqId },
        // V0.16 — prefer "assigned" over the legacy "checked_out".
        data: { status: "assigned" },
      }),
    ]);

    const targetLabel = targetUserName ?? `${targetDeptName} (dept)`;
    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "equipment_assigned",
      message: `assigned '${eq.name}' to ${targetLabel}.`,
      metadata: {
        equipmentId: eqId,
        assignedToUserId: targetUserId,
        assignedToDepartmentId: targetDeptId,
        departmentId: eq.departmentId,
      },
    });

    if (targetUserId && targetUserId !== guard.userId) {
      await notify({
        userId: targetUserId,
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
