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
import { notify } from "@/lib/notifications";
import { canManageDepartmentMembers } from "@/lib/permissions";

interface RouteContext {
  params: Promise<{ id: string; deptId: string }>;
}

const addSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["lead", "member"]).default("member"),
});

/**
 * POST — owner-only. Add a user to this department. The user must already
 * be a project member (departments are organizational, not access-granting).
 */
export async function POST(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, deptId } = await ctx.params;

  const department = await prisma.department.findFirst({
    where: { id: deptId, projectId: id },
  });
  if (!department) return notFound("Department not found.");

  // V0.12 — owner, project-wide roles, or the resolved head of THIS dept.
  const canManage = await canManageDepartmentMembers(
    { userId: guard.userId, projectId: id },
    department.kind
  );
  if (!canManage) {
    return forbidden(
      "Only the project owner / producers / this department's head can manage its members."
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid data.", parsed.error.flatten().fieldErrors);
  }

  const projectMember = await prisma.projectMember.findFirst({
    where: { projectId: id, userId: parsed.data.userId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!projectMember) {
    return badRequest(
      "User must be a project member before being added to a department."
    );
  }

  try {
    const added = await prisma.departmentMember.upsert({
      where: {
        departmentId_userId: {
          departmentId: deptId,
          userId: parsed.data.userId,
        },
      },
      create: {
        departmentId: deptId,
        userId: parsed.data.userId,
        role: parsed.data.role,
      },
      update: { role: parsed.data.role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "department_member_added",
      message: `added ${added.user.name} to ${department.name}.`,
      metadata: {
        departmentId: deptId,
        userId: added.userId,
        role: added.role,
      },
    });
    if (added.user.id !== guard.userId) {
      await notify({
        userId: added.user.id,
        type: "department_member_added",
        title: `${guard.userName} added you to ${department.name}`,
        link: `/projects/${id}/departments/${deptId}`,
        metadata: { projectId: id, departmentId: deptId },
      });
    }

    return NextResponse.json(
      {
        id: added.id,
        userId: added.user.id,
        name: added.user.name,
        email: added.user.email,
        role: added.role,
        joinedAt: added.joinedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[department.members.POST]", err);
    return serverError("Failed to add member.");
  }
}
