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
} from "@/lib/equipment-data";
import { logActivity } from "@/lib/activity";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const createSchema = z.object({
  departmentId: z.string().min(1),
  name: z.string().min(1).max(200),
  serialNumber: z.string().max(200).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  // V0.16 — asset profile fields.
  purchaseDate: z.string().datetime().optional().nullable(),
  purchaseCost: z.number().int().min(0).max(10_000_000_00).optional().nullable(),
});

/** GET — list equipment on a project. Any project member can read. */
export async function GET(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const access = await userHasProjectAccess(guard.userId, id);
  if (!access) return notFound("Project not found.");

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const departmentId = url.searchParams.get("department");

  const where: Record<string, unknown> = { projectId: id };
  if (status) where.status = status;
  if (departmentId) where.departmentId = departmentId;

  const rows = await prisma.equipment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      department: { select: { id: true, name: true, kind: true } },
      assignments: {
        where: { returnedAt: null },
        include: { assignedTo: { select: { id: true, name: true } } },
        take: 1,
      },
      _count: { select: { damageReports: true } },
    },
  });

  return NextResponse.json({
    equipment: rows.map((e) => ({
      id: e.id,
      name: e.name,
      serialNumber: e.serialNumber,
      category: e.category,
      notes: e.notes,
      status: e.status,
      department: e.department,
      currentHolder: e.assignments[0]?.assignedTo ?? null,
      openDamageCount: e._count.damageReports,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    })),
  });
}

/** POST — create equipment. Manager-only for the chosen department. */
export async function POST(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
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

  const dept = await prisma.department.findFirst({
    where: { id: parsed.data.departmentId, projectId: id },
    select: { id: true, kind: true, name: true },
  });
  if (!dept) return badRequest("Department not found on this project.");

  const ectx = await resolveEquipmentContext(guard.userId, id);
  if (!canManageEquipment(ectx, dept)) {
    return forbidden("Not allowed to add equipment to this department.");
  }

  try {
    const created = await prisma.equipment.create({
      data: {
        projectId: id,
        departmentId: dept.id,
        name: parsed.data.name.trim(),
        serialNumber: parsed.data.serialNumber ?? null,
        category: parsed.data.category ?? null,
        notes: parsed.data.notes ?? null,
        status: "available",
        // V0.16
        purchaseDate: parsed.data.purchaseDate
          ? new Date(parsed.data.purchaseDate)
          : null,
        purchaseCost: parsed.data.purchaseCost ?? null,
      },
    });

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "equipment_created",
      message: `added equipment '${created.name}' to ${dept.name}.`,
      metadata: { equipmentId: created.id, departmentId: dept.id },
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err) {
    console.error("[equipment.POST]", err);
    return serverError("Failed to add equipment.");
  }
}
