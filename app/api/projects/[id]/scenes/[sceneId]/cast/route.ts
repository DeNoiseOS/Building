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

/**
 * V0.25 — Link Talent to a Scene.
 *
 * POST — creates a SceneCast row. Auth: canManageCast.
 * GET  — list SceneCast rows on this scene.
 */

const createSchema = z.object({
  talentId: z.string().min(1),
  characterName: z.string().max(200).nullable().optional(),
  callTime: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

type Ctx = { params: Promise<{ id: string; sceneId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const guard = await requireUser();
  if (guard.response) return guard.response;
  const { id, sceneId } = await ctx.params;
  if (!(await userHasProjectAccess(guard.userId, id)))
    return notFound("Project not found.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = (prisma as any).sceneCast;
  if (!m || typeof m.findMany !== "function") {
    return NextResponse.json({ cast: [] });
  }
  const rows = await m
    .findMany({
      where: { sceneId },
      orderBy: { createdAt: "asc" },
      include: {
        talent: {
          select: {
            id: true,
            name: true,
            characterName: true,
            headshotUrl: true,
          },
        },
      },
    })
    .catch(() => []);
  type Row = {
    id: string;
    characterName: string | null;
    callTime: Date | null;
    notes: string | null;
    talent: {
      id: string;
      name: string;
      characterName: string | null;
      headshotUrl: string | null;
    };
  };
  return NextResponse.json({
    cast: (rows as Row[]).map((r) => ({
      id: r.id,
      characterName: r.characterName ?? r.talent.characterName,
      callTime: r.callTime?.toISOString() ?? null,
      notes: r.notes,
      talent: r.talent,
    })),
  });
}

export async function POST(req: Request, ctx: Ctx) {
  const guard = await requireUser();
  if (guard.response) return guard.response;
  const { id, sceneId } = await ctx.params;
  if (!(await userHasProjectAccess(guard.userId, id)))
    return notFound("Project not found.");
  if (!(await canManageCast({ userId: guard.userId, projectId: id }))) {
    return forbidden("Only casting authors can link talent.");
  }

  const scene = await prisma.scene.findFirst({
    where: { id: sceneId, projectId: id },
    select: { id: true, number: true },
  });
  if (!scene) return notFound("Scene not found.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid payload.", parsed.error.flatten().fieldErrors);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const talentModel = (prisma as any).talent;
  const talent = talentModel
    ? await talentModel.findFirst({
        where: { id: parsed.data.talentId, projectId: id },
        select: { id: true, name: true },
      })
    : null;
  if (!talent) return badRequest("Talent not found on this project.");

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = (prisma as any).sceneCast;
    await m.create({
      data: {
        sceneId,
        talentId: talent.id,
        characterName: parsed.data.characterName?.trim() || null,
        callTime: parsed.data.callTime ? new Date(parsed.data.callTime) : null,
        notes: parsed.data.notes?.trim() || null,
        addedByUserId: guard.userId,
      },
    });
    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "scene_cast_linked",
      message: `cast ${talent.name} in Scene #${scene.number}.`,
      metadata: { sceneId, talentId: talent.id },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2002") {
      return badRequest("This talent is already cast in this scene.");
    }
    console.error("[scene.cast.POST]", err);
    return serverError("Failed.");
  }
}
