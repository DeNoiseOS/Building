import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api";
import { userHasProjectAccess } from "@/lib/access";
import { canManageCast } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

/**
 * V0.25 — Unlink talent from a scene.
 */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; sceneId: string; castId: string }> }
) {
  const guard = await requireUser();
  if (guard.response) return guard.response;
  const { id, sceneId, castId } = await ctx.params;
  if (!(await userHasProjectAccess(guard.userId, id)))
    return notFound("Project not found.");
  if (!(await canManageCast({ userId: guard.userId, projectId: id }))) {
    return forbidden("Not allowed.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = (prisma as any).sceneCast;
  if (!m) return notFound("Not found.");
  const row = await m.findUnique({
    where: { id: castId },
    include: { talent: { select: { name: true } } },
  });
  if (!row || row.sceneId !== sceneId) return notFound("Not found.");

  try {
    await m.delete({ where: { id: castId } });
    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "scene_cast_unlinked",
      message: `removed ${row.talent?.name ?? "cast"} from this scene.`,
      metadata: { sceneId, castId },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[scene.cast.DELETE]", err);
    return serverError("Failed.");
  }
}
