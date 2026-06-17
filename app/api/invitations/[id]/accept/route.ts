import { NextResponse } from "next/server";
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
import { getDepartmentForRole } from "@/lib/department-registry";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/invitations/[id]/accept
 * Accept a project invitation addressed to the caller's email. Creates the
 * ProjectMember row and marks the invitation accepted.
 */
export async function POST(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;

  const me = await prisma.user.findUnique({
    where: { id: guard.userId },
    select: { email: true, name: true },
  });
  if (!me) return notFound("User not found.");

  const invitation = await prisma.projectInvitation.findUnique({
    where: { id },
    include: { project: { select: { id: true, name: true } } },
  });
  if (!invitation) return notFound("Invitation not found.");

  if (invitation.email.toLowerCase() !== me.email.toLowerCase()) {
    return forbidden("This invitation is for a different email.");
  }
  if (invitation.status !== "pending") {
    return badRequest("This invitation is no longer pending.");
  }
  if (invitation.expiresAt < new Date()) {
    return badRequest("This invitation has expired.");
  }

  try {
    // V0.12.1 — Resolve the destination department from the invitation's
    // role (e.g. role=prop_master → Art department). If found, the user
    // is also added to that DepartmentMember row so dept-scoped queries
    // (rosters, dept budgets, dept tasks) immediately see them.
    const destDept = getDepartmentForRole(invitation.role);
    const matchingDeptRow = destDept
      ? await prisma.department.findFirst({
          where: { projectId: invitation.projectId, key: destDept.key },
          select: { id: true },
        })
      : null;

    await prisma.$transaction(async (tx) => {
      await tx.projectMember.upsert({
        where: {
          projectId_userId: {
            projectId: invitation.projectId,
            userId: guard.userId,
          },
        },
        create: {
          projectId: invitation.projectId,
          userId: guard.userId,
          role: invitation.role,
        },
        update: { role: invitation.role },
      });
      if (matchingDeptRow) {
        await tx.departmentMember.upsert({
          where: {
            departmentId_userId: {
              departmentId: matchingDeptRow.id,
              userId: guard.userId,
            },
          },
          create: {
            departmentId: matchingDeptRow.id,
            userId: guard.userId,
            role: "member",
          },
          update: {},
        });
      }
      await tx.projectInvitation.update({
        where: { id },
        data: { status: "accepted" },
      });
    });

    await logActivity({
      projectId: invitation.projectId,
      actorId: guard.userId,
      actorName: me.name,
      type: "member_joined",
      message: `joined the project.`,
      metadata: { invitationId: id, userId: guard.userId },
    });

    // V0.5: notify the inviter that the recipient joined.
    if (invitation.invitedBy && invitation.invitedBy !== guard.userId) {
      await notify({
        userId: invitation.invitedBy,
        type: "invitation_accepted",
        title: `${me.name} accepted your invitation`,
        body: invitation.project.name,
        link: `/projects/${invitation.project.id}/members`,
        metadata: {
          invitationId: id,
          projectId: invitation.project.id,
        },
      });
    }

    return NextResponse.json({ ok: true, project: invitation.project });
  } catch (err) {
    console.error("[invitations.accept]", err);
    return serverError("Failed to accept invitation.");
  }
}
