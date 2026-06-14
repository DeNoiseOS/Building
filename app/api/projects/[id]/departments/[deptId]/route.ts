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
import { logActivity } from "@/lib/activity";
import { userIsProjectOwner } from "@/lib/access";
import { getDepartmentDetail } from "@/lib/department-data";

interface RouteContext {
  params: Promise<{ id: string; deptId: string }>;
}

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  order: z.number().int().min(0).max(1000).optional(),
});

/** GET — any project member can read a department. */
export async function GET(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, deptId } = await ctx.params;
  const detail = await getDepartmentDetail(guard.userId, id, deptId);
  if (!detail) return notFound("Department not found.");
  return NextResponse.json(detail);
}

/** PATCH — owner-only. Rename or reorder a department. */
export async function PATCH(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, deptId } = await ctx.params;
  const owner = await userIsProjectOwner(guard.userId, id);
  if (!owner) return forbidden("Only the project owner can edit departments.");

  const existing = await prisma.department.findFirst({
    where: { id: deptId, projectId: id },
  });
  if (!existing) return notFound("Department not found.");

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
    const updated = await prisma.department.update({
      where: { id: deptId },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name.trim() }),
        ...(parsed.data.order !== undefined && { order: parsed.data.order }),
      },
    });

    const changedFields = Object.keys(parsed.data);
    if (changedFields.length > 0) {
      await logActivity({
        projectId: id,
        actorId: guard.userId,
        actorName: guard.userName,
        type: "department_updated",
        message: `updated the ${updated.name} department.`,
        metadata: { departmentId: updated.id, fields: changedFields },
      });
    }

    return NextResponse.json({
      id: updated.id,
      projectId: updated.projectId,
      key: updated.key,
      name: updated.name,
      kind: updated.kind,
      order: updated.order,
    });
  } catch (err) {
    console.error("[departments.PATCH]", err);
    return serverError("Failed to update department.");
  }
}

/** DELETE — owner-only. Tasks/notes/refs lose departmentId (SET NULL). */
export async function DELETE(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, deptId } = await ctx.params;
  const owner = await userIsProjectOwner(guard.userId, id);
  if (!owner) return forbidden("Only the project owner can delete departments.");

  const existing = await prisma.department.findFirst({
    where: { id: deptId, projectId: id },
  });
  if (!existing) return notFound("Department not found.");

  try {
    await prisma.department.delete({ where: { id: deptId } });
    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "department_deleted",
      message: `removed the ${existing.name} department.`,
      metadata: { departmentId: existing.id, kind: existing.kind },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[departments.DELETE]", err);
    return serverError("Failed to delete department.");
  }
}
