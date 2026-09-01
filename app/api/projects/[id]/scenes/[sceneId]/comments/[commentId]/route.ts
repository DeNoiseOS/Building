import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, forbidden, notFound, serverError } from "@/lib/api";
import { userHasProjectAccess } from "@/lib/access";

/**
 * V0.24 — DELETE a scene comment. Author or project owner only.
 */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; sceneId: string; commentId: string }> },
) {
  const guard = await requireUser();
  if (guard.response) return guard.response;
  const { id, sceneId, commentId } = await ctx.params;
  if (!(await userHasProjectAccess(guard.userId, id)))
    return notFound("Project not found.");

  const row = await prisma.sceneComment.findUnique({ where: { id: commentId } });
  if (!row || row.sceneId !== sceneId) return notFound("Not found.");

  const isOwner = await prisma.project.findFirst({
    where: { id, userId: guard.userId },
    select: { id: true },
  });
  if (!isOwner && row.authorId !== guard.userId) {
    return forbidden("Only the author or project owner can delete this.");
  }

  try {
    await prisma.sceneComment.delete({ where: { id: commentId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[scene.comment.DELETE]", err);
    return serverError("Failed.");
  }
}
