import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser, badRequest, forbidden, notFound } from "@/lib/api";
import { userHasProjectAccess } from "@/lib/access";
import { canManageProjectMembers, invitableRoles } from "@/lib/permissions";
import { ROLE_VALUES, ROLE_LABELS } from "@/lib/roles";
import { logActivity } from "@/lib/activity";

/**
 * V0.26.1 — Instant "Add teammate" for testing.
 *
 * Skips the email + invitation-accept dance: given a role, ensures the
 * shared `The [Role]` persona exists, then attaches them to this
 * project as a ProjectMember. Perfect for demoing the collaboration
 * flow without switching accounts.
 *
 * Gated by NEXT_PUBLIC_QUICK_LOGIN=1. Auth: canManageProjectMembers
 * (Owner / EP / Producer) OR invitableRoles allows the target role
 * (dept heads can bring in their own members).
 */

const bodySchema = z.object({
  role: z.string().min(1),
});

async function ensureRolePersona(role: string): Promise<string> {
  const label = ROLE_LABELS[role] ?? role;
  const email = `${role.replace(/_/g, "-")}@personas.local`;
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) return existing.id;
  const password = await bcrypt.hash(
    Math.random().toString(36) + Date.now().toString(36),
    4
  );
  const created = await prisma.user.create({
    data: {
      name: `The ${label}`,
      email,
      password,
      primaryRole: role,
    },
  });
  return created.id;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  if (process.env.NEXT_PUBLIC_QUICK_LOGIN !== "1") {
    return NextResponse.json(
      { error: "Quick login isn't enabled on this deployment." },
      { status: 404 }
    );
  }

  const guard = await requireUser();
  if (guard.response) return guard.response;
  const { id } = await ctx.params;
  if (!(await userHasProjectAccess(guard.userId, id)))
    return notFound("Project not found.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid payload.");
  }
  const role = parsed.data.role.trim();
  if (!ROLE_VALUES.includes(role as (typeof ROLE_VALUES)[number])) {
    return badRequest(`Unknown role: ${role}`);
  }

  // Reuse the invite hierarchy so we don't accidentally let a member
  // add roles above them.
  const ctxCaller = { userId: guard.userId, projectId: id };
  const canManage = await canManageProjectMembers(ctxCaller);
  const allowed = await invitableRoles(ctxCaller);
  if (!canManage && !allowed.includes(role)) {
    return forbidden("Your role can't add that persona.");
  }

  const personaId = await ensureRolePersona(role);

  // Idempotent: if the persona is already on the project, keep going.
  const existing = await prisma.projectMember.findFirst({
    where: { projectId: id, userId: personaId },
    select: { id: true, role: true },
  });
  if (existing) {
    if (existing.role !== role) {
      await prisma.projectMember.update({
        where: { id: existing.id },
        data: { role },
      });
    }
    return NextResponse.json({ ok: true, alreadyMember: true });
  }

  await prisma.projectMember.create({
    data: {
      projectId: id,
      userId: personaId,
      role,
    },
  });
  await logActivity({
    projectId: id,
    actorId: guard.userId,
    actorName: guard.userName,
    type: "member_added",
    message: `added The ${ROLE_LABELS[role] ?? role} to the project.`,
    metadata: { addedUserId: personaId, role },
  });
  return NextResponse.json({ ok: true });
}
