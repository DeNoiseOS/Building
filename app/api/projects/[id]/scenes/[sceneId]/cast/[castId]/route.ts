import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, forbidden, notFound, serverError } from "@/lib/api";
import { userHasProjectAccess } from "@/lib/access";
import { canManageCast } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { log } from "@/lib/logger";

/**
 * V0.25 — Unlink talent from a scene.
 */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; sceneId: string; castId: string }> },
) {
  const guard = await requireUser();
  if (guard.response) return guard.response;
  const { id, sceneId, castId } = await ctx.params;
  if (!(await userHasProjectAccess(guard.userId, id)))
    return notFound("Project not found.");
  if (!(await canManageCast({ userId: guard.userId, projectId: id }))) {
    return forbidden("Not allowed.");
  }

  const row = await prisma.sceneCast.findUnique({
    where: { id: castId },
    include: { talent: { select: { name: true } } },
  });
  if (!row || row.sceneId !== sceneId) return notFound("Not found.");

  try {
    await prisma.sceneCast.delete({ where: { id: castId } });
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
    log.error("[scene.cast.DELETE]", err instanceof Error ? err : { err: String(err) });
    return serverError("Failed.");
  }
}
