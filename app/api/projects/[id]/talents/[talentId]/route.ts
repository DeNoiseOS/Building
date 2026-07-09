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
import { userHasProjectAccess } from "@/lib/access";
import { canManageCast } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  characterName: z.string().max(200).nullable().optional(),
  bio: z.string().max(4000).nullable().optional(),
  headshotUrl: z.string().url().max(800).nullable().optional().or(z.literal("")),
  contactPhone: z.string().max(60).nullable().optional(),
  contactEmail: z.string().email().max(200).nullable().optional().or(z.literal("")),
  agentName: z.string().max(200).nullable().optional(),
  agentContact: z.string().max(200).nullable().optional(),
  dayRate: z.number().int().min(0).max(10_000_000_00).nullable().optional(),
});

type Ctx = { params: Promise<{ id: string; talentId: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const guard = await requireUser();
  if (guard.response) return guard.response;
  const { id, talentId } = await ctx.params;
  if (!(await userHasProjectAccess(guard.userId, id)))
    return notFound("Project not found.");
  if (!(await canManageCast({ userId: guard.userId, projectId: id }))) {
    return forbidden("Not allowed.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = (prisma as any).talent;
  if (!m) return notFound("Not found.");
  const row = await m.findUnique({ where: { id: talentId } });
  if (!row || row.projectId !== id) return notFound("Not found.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid payload.", parsed.error.flatten().fieldErrors);
  }

  try {
    await m.update({
      where: { id: talentId },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name.trim() }),
        ...(parsed.data.characterName !== undefined && {
          characterName: parsed.data.characterName?.trim() || null,
        }),
        ...(parsed.data.bio !== undefined && { bio: parsed.data.bio?.trim() || null }),
        ...(parsed.data.headshotUrl !== undefined && {
          headshotUrl: parsed.data.headshotUrl || null,
        }),
        ...(parsed.data.contactPhone !== undefined && {
          contactPhone: parsed.data.contactPhone?.trim() || null,
        }),
        ...(parsed.data.contactEmail !== undefined && {
          contactEmail: parsed.data.contactEmail || null,
        }),
        ...(parsed.data.agentName !== undefined && {
          agentName: parsed.data.agentName?.trim() || null,
        }),
        ...(parsed.data.agentContact !== undefined && {
          agentContact: parsed.data.agentContact?.trim() || null,
        }),
        ...(parsed.data.dayRate !== undefined && { dayRate: parsed.data.dayRate }),
      },
    });
    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "talent_updated",
      message: `updated ${row.name}.`,
      metadata: { talentId },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[talent.PATCH]", err);
    return serverError("Failed.");
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const guard = await requireUser();
  if (guard.response) return guard.response;
  const { id, talentId } = await ctx.params;
  if (!(await userHasProjectAccess(guard.userId, id)))
    return notFound("Project not found.");
  if (!(await canManageCast({ userId: guard.userId, projectId: id }))) {
    return forbidden("Not allowed.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = (prisma as any).talent;
  if (!m) return notFound("Not found.");
  const row = await m.findUnique({ where: { id: talentId } });
  if (!row || row.projectId !== id) return notFound("Not found.");

  try {
    await m.delete({ where: { id: talentId } });
    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "talent_removed",
      message: `removed ${row.name} from Cast.`,
      metadata: { talentId },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[talent.DELETE]", err);
    return serverError("Failed.");
  }
}
