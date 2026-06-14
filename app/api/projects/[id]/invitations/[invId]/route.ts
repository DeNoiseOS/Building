import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, forbidden, notFound, serverError } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { userIsProjectOwner } from "@/lib/access";

interface RouteContext {
  params: Promise<{ id: string; invId: string }>;
}

/**
 * DELETE /api/projects/[id]/invitations/[invId]
 * Owner-only. Revokes a pending invitation.
 */
export async function DELETE(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, invId } = await ctx.params;
  const owner = await userIsProjectOwner(guard.userId, id);
  if (!owner) return forbidden("Only the project owner can revoke invitations.");

  const existing = await prisma.projectInvitation.findFirst({
    where: { id: invId, projectId: id },
  });
  if (!existing) return notFound("Invitation not found.");

  try {
    await prisma.projectInvitation.delete({ where: { id: invId } });

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "invitation_revoked",
      message: `revoked invitation for ${existing.email}.`,
      metadata: { invitationId: invId, email: existing.email },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[projects.invitations.DELETE]", err);
    return serverError("Failed to revoke invitation.");
  }
}
