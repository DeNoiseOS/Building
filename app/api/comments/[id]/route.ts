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

interface RouteContext {
  params: Promise<{ id: string }>;
}

const updateSchema = z.object({
  body: z.string().min(1).max(4000),
});

/** PATCH — edit own comment. */
export async function PATCH(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const existing = await prisma.comment.findUnique({ where: { id } });
  if (!existing) return notFound("Comment not found.");
  if (existing.authorId !== guard.userId) {
    return forbidden("You can only edit your own comments.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid data.", parsed.error.flatten().fieldErrors);
  }

  try {
    const updated = await prisma.comment.update({
      where: { id },
      data: { body: parsed.data.body.trim() },
    });
    await logActivity({
      projectId: existing.projectId,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "comment_updated",
      message: `edited a comment.`,
      metadata: { commentId: id, targetType: existing.targetType, targetId: existing.targetId },
    });
    return NextResponse.json({
      id: updated.id,
      body: updated.body,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    console.error("[comments.PATCH]", err);
    return serverError("Failed to update comment.");
  }
}

/** DELETE — delete own comment. */
export async function DELETE(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const existing = await prisma.comment.findUnique({ where: { id } });
  if (!existing) return notFound("Comment not found.");
  if (existing.authorId !== guard.userId) {
    return forbidden("You can only delete your own comments.");
  }

  try {
    await prisma.comment.delete({ where: { id } });
    await logActivity({
      projectId: existing.projectId,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "comment_deleted",
      message: `deleted a comment.`,
      metadata: { commentId: id, targetType: existing.targetType, targetId: existing.targetId },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[comments.DELETE]", err);
    return serverError("Failed to delete comment.");
  }
}
