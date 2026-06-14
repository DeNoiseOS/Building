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
import { userHasProjectAccess } from "@/lib/access";
import { ROLE_VALUES, ROLE_LABELS } from "@/lib/roles";
import { canInviteRole } from "@/lib/permissions";
import { notify } from "@/lib/notifications";
import { prisma as prismaClient } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const createSchema = z.object({
  email: z.string().email().max(200),
  role: z.enum(ROLE_VALUES as unknown as [string, ...string[]]),
});

const INVITATION_TTL_DAYS = 30;

/**
 * GET /api/projects/[id]/invitations
 * Members can list pending invitations on the project so the UI shows
 * who's been invited but hasn't accepted yet.
 */
export async function GET(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const access = await userHasProjectAccess(guard.userId, id);
  if (!access) return notFound("Project not found.");

  try {
    const invitations = await prisma.projectInvitation.findMany({
      where: { projectId: id, status: "pending" },
      orderBy: { createdAt: "desc" },
      include: {
        inviter: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      invitations: invitations.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        status: i.status,
        invitedBy: i.inviter.name,
        createdAt: i.createdAt.toISOString(),
        expiresAt: i.expiresAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[projects.invitations.GET]", err);
    return serverError("Failed to load invitations.");
  }
}

/**
 * POST /api/projects/[id]/invitations
 * Owner-only. Creates a pending invitation. Works even if the email doesn't
 * belong to a registered user yet — it'll be claimed at registration time.
 */
export async function POST(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;

  // V0.5 — caller must have access AND be allowed to invite this target role.
  const hasAccess = await userHasProjectAccess(guard.userId, id);
  if (!hasAccess) return notFound("Project not found.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid invitation data.", parsed.error.flatten().fieldErrors);
  }

  const permitted = await canInviteRole(
    { userId: guard.userId, projectId: id },
    parsed.data.role
  );
  if (!permitted) {
    return forbidden(
      `Your role doesn't permit inviting a ${ROLE_LABELS[parsed.data.role] ?? parsed.data.role}.`
    );
  }

  const email = parsed.data.email.toLowerCase().trim();

  // If the email already belongs to a current member, short-circuit.
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true },
  });
  if (existingUser) {
    const alreadyMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId: id, userId: existingUser.id },
      },
      select: { id: true },
    });
    if (alreadyMember) {
      return badRequest("That person is already a member of this project.");
    }
  }

  const expiresAt = new Date(
    Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000
  );

  try {
    // Upsert by (projectId, email): if a non-pending invitation exists,
    // refresh it back to pending with the new role + expiry.
    const invitation = await prisma.projectInvitation.upsert({
      where: { projectId_email: { projectId: id, email } },
      create: {
        projectId: id,
        email,
        role: parsed.data.role,
        invitedBy: guard.userId,
        status: "pending",
        expiresAt,
      },
      update: {
        role: parsed.data.role,
        invitedBy: guard.userId,
        status: "pending",
        expiresAt,
      },
    });

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "member_invited",
      message: `invited ${email} as ${ROLE_LABELS[invitation.role] ?? invitation.role}.`,
      metadata: { invitationId: invitation.id, email, role: invitation.role },
    });

    // V0.5 — if the email belongs to an existing user, drop a notification
    // into their bell so they see the invitation immediately.
    if (existingUser) {
      const project = await prismaClient.project.findUnique({
        where: { id },
        select: { name: true },
      });
      await notify({
        userId: existingUser.id,
        type: "invitation_received",
        title: `${guard.userName} invited you to a project`,
        body: project?.name,
        link: "/inbox",
        metadata: { invitationId: invitation.id, projectId: id },
      });
    }

    return NextResponse.json(
      {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        createdAt: invitation.createdAt.toISOString(),
        expiresAt: invitation.expiresAt.toISOString(),
        matchedExistingUser: !!existingUser,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[projects.invitations.POST]", err);
    return serverError("Failed to send invitation.");
  }
}
