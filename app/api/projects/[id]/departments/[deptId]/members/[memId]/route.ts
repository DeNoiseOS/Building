import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { userIsProjectOwner } from "@/lib/access";

interface RouteContext {
  params: Promise<{ id: string; deptId: string; memId: string }>;
}

/** DELETE — owner-only. Remove a member from this department. */
export async function DELETE(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, deptId, memId } = await ctx.params;
  const owner = await userIsProjectOwner(guard.userId, id);
  if (!owner) {
    return forbidden("Only the project owner can manage department members.");
  }

  const existing = await prisma.departmentMember.findFirst({
    where: { id: memId, departmentId: deptId, department: { projectId: id } },
    include: {
      user: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  });
  if (!existing) return notFound("Department member not found.");

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
