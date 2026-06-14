import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, serverError } from "@/lib/api";

/**
 * GET /api/invitations
 * Returns the caller's pending project invitations, matched by their email.
 */
export async function GET() {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  try {
    const me = await prisma.user.findUnique({
      where: { id: guard.userId },
      select: { email: true },
    });
    if (!me) return NextResponse.json({ invitations: [] });

    const invitations = await prisma.projectInvitation.findMany({
      where: { email: me.email, status: "pending" },
      orderBy: { createdAt: "desc" },
      include: {
        project: { select: { id: true, name: true, role: true } },
        inviter: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      invitations: invitations.map((i) => ({
        id: i.id,
        project: i.project,
        role: i.role,
        invitedBy: i.inviter.name,
        createdAt: i.createdAt.toISOString(),
        expiresAt: i.expiresAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[invitations.GET]", err);
    return serverError("Failed to load invitations.");
  }
}
