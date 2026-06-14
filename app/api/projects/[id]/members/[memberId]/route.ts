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
import { ROLE_VALUES, ROLE_LABELS } from "@/lib/roles";

interface RouteContext {
  params: Promise<{ id: string; memberId: string }>;
}

const patchSchema = z.object({
  role: z.enum(ROLE_VALUES as unknown as [string, ...string[]]),
});

/**
 * PATCH /api/projects/[id]/members/[memberId]
 * Owner-only. Updates a member's role on the project.
 */
export async function PATCH(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, memberId } = await ctx.params;
  const owner = await userIsProjectOwner(guard.userId, id);
  if (!owner) return forbidden("Only the project owner can change member roles.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid role.", parsed.error.flatten().fieldErrors);
  }

  const existing = await prisma.projectMember.findFirst({
    where: { id: memberId, projectId: id },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!existing) return notFound("Member not found.");

  // Don't allow demoting/changing the owner's own membership role here —
  // the owner-role is tied to the project, not the membership row.
  const project = await prisma.project.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (project?.userId === existing.user.id) {
    return badRequest("The project owner's role is fixed.");
  }

  try {
    const updated = await prisma.projectMember.update({
      where: { id: memberId },
      data: { role: parsed.data.role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "member_role_changed",
      message: `changed ${updated.user.name}'s role to ${
        ROLE_LABELS[updated.role] ?? updated.role
      }.`,
      metadata: { memberId: updated.id, userId: updated.user.id, role: updated.role },
    });

    return NextResponse.json({
      id: updated.id,
      userId: updated.user.id,
      name: updated.user.name,
      email: updated.user.email,
      role: updated.role,
      joinedAt: updated.joinedAt.toISOString(),
      isOwner: false,
    });
  } catch (err) {
    console.error("[projects.members.PATCH]", err);
    return serverError("Failed to update member.");
  }
}

/**
 * DELETE /api/projects/[id]/members/[memberId]
 * Owner-only. Removes a member from the project. Cannot remove the owner.
 * Side effect: nulls out assigneeId on tasks assigned to the removed user.
 */
export async function DELETE(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, memberId } = await ctx.params;
  const owner = await userIsProjectOwner(guard.userId, id);
  if (!owner) return forbidden("Only the project owner can remove members.");

  const existing = await prisma.projectMember.findFirst({
    where: { id: memberId, projectId: id },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!existing) return notFound("Member not found.");

  const project = await prisma.project.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (project?.userId === existing.user.id) {
    return badRequest("The project owner cannot be removed.");
  }

  try {
    await prisma.$transaction([
      prisma.task.updateMany({
        where: { projectId: id, assigneeId: existing.user.id },
        data: { assigneeId: null },
      }),
      prisma.projectMember.delete({ where: { id: memberId } }),
    ]);

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "member_removed",
      message: `removed ${existing.user.name} from the project.`,
      metadata: { userId: existing.user.id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[projects.members.DELETE]", err);
    return serverError("Failed to remove member.");
  }
}
