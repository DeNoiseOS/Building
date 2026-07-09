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
import { canCommentOnScene } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

/**
 * V0.24 — Scene comments.
 *
 * GET  — list all comments on a scene.
 * POST — add a comment. Every project member (including client roles)
 *        can post; that's the whole feedback loop.
 */

const createSchema = z.object({
  body: z.string().min(1).max(4000),
});

type Ctx = { params: Promise<{ id: string; sceneId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const guard = await requireUser();
  if (guard.response) return guard.response;
  const { id, sceneId } = await ctx.params;
  if (!(await userHasProjectAccess(guard.userId, id)))
    return notFound("Project not found.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = (prisma as any).sceneComment;
  if (!m || typeof m.findMany !== "function") {
    return NextResponse.json({ comments: [] });
  }
  const scene = await prisma.scene.findFirst({
    where: { id: sceneId, projectId: id },
    select: { id: true },
  });
  if (!scene) return notFound("Scene not found.");

  const rows = await m
    .findMany({
      where: { sceneId },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { id: true, name: true } } },
    })
    .catch(() => []);
  type Row = {
    id: string;
    body: string;
    createdAt: Date;
    author: { id: string; name: string } | null;
  };
  return NextResponse.json({
    comments: (rows as Row[]).map((r) => ({
      id: r.id,
      body: r.body,
      createdAt: r.createdAt.toISOString(),
      author: r.author,
    })),
  });
}

export async function POST(req: Request, ctx: Ctx) {
  const guard = await requireUser();
  if (guard.response) return guard.response;
  const { id, sceneId } = await ctx.params;
  if (!(await userHasProjectAccess(guard.userId, id)))
    return notFound("Project not found.");

  const scene = await prisma.scene.findFirst({
    where: { id: sceneId, projectId: id },
    select: { id: true, number: true, title: true },
  });
  if (!scene) return notFound("Scene not found.");

  if (!(await canCommentOnScene({ userId: guard.userId, projectId: id }))) {
    return forbidden("You can't comment on scenes in this project.");
  }

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

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = (prisma as any).sceneComment;
    const created = await m.create({
      data: {
        sceneId,
        authorId: guard.userId,
        body: parsed.data.body.trim(),
      },
    });
    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "scene_comment_added",
      message: `commented on Scene #${scene.number} '${scene.title}'.`,
      metadata: { sceneId, commentId: created.id },
    });
    return NextResponse.json({ ok: true, id: created.id });
  } catch (err) {
    console.error("[scene.comments.POST]", err);
    return serverError("Failed to comment.");
  }
}
