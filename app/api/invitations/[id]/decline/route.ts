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

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/invitations/[id]/decline
 * Decline a project invitation addressed to the caller's email.
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
  });
  if (!invitation) return notFound("Invitation not found.");

  if (invitation.email.toLowerCase() !== me.email.toLowerCase()) {
    return forbidden("This invitation is for a different email.");
  }
  if (invitation.status !== "pending") {
    return badRequest("This invitation is no longer pending.");
  }

  try {
    await prisma.projectInvitation.update({
      where: { id },
      data: { status: "declined" },
    });

    await logActivity({
      projectId: invitation.projectId,
      actorId: guard.userId,
      actorName: me.name,
      type: "invitation_declined",
      message: `declined the invitation.`,
      metadata: { invitationId: id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[invitations.decline]", err);
    return serverError("Failed to decline invitation.");
  }
}
