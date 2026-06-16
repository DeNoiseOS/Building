import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { canManageDepartmentMembers } from "@/lib/permissions";

interface RouteContext {
  params: Promise<{ id: string; deptId: string; memId: string }>;
}

/** DELETE — owner-only. Remove a member from this department. */
export async function DELETE(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, deptId, memId } = await ctx.params;

  const existing = await prisma.departmentMember.findFirst({
    where: { id: memId, departmentId: deptId, department: { projectId: id } },
    include: {
      user: { select: { id: true, name: true } },
      department: { select: { id: true, name: true, kind: true } },
    },
  });
  if (!existing) return notFound("Department member not found.");

  // V0.12 — owner, project-wide roles, or the resolved head of THIS dept.
  const canManage = await canManageDepartmentMembers(
    { userId: guard.userId, projectId: id },
    existing.department.kind
  );
  if (!canManage) {
    return forbidden(
      "Only the project owner / producers / this department's head can manage its members."
    );
  }

  try {
    await prisma.departmentMember.delete({ where: { id: memId } });
    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "department_member_removed",
      message: `removed ${existing.user.name} from ${existing.department.name}.`,
      metadata: {
        departmentId: deptId,
        userId: existing.user.id,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[department.members.DELETE]", err);
    return serverError("Failed to remove member.");
  }
}
