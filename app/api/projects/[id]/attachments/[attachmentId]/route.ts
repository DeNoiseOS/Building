import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  notFound,
  serverError,
  forbidden,
} from "@/lib/api";
import { userHasProjectAccess } from "@/lib/access";
import { removeStorageFile } from "@/lib/storage";

/**
 * V0.23 — DELETE an attachment.
 *
 * Removes both the DB row and the Storage file. Only the uploader
 * OR the project owner can delete. (Broader roles can be added
 * later — for now we keep the blast radius small.)
 */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, attachmentId } = await ctx.params;
  if (!(await userHasProjectAccess(guard.userId, id)))
    return notFound("Project not found.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = (prisma as any).attachment;
  if (!m || typeof m.findUnique !== "function") {
    return notFound("Attachment not found.");
  }
  const row = await m.findUnique({ where: { id: attachmentId } });
  if (!row || row.projectId !== id) {
    return notFound("Attachment not found.");
  }

  const isOwner = await prisma.project.findFirst({
    where: { id, userId: guard.userId },
    select: { id: true },
  });
  if (!isOwner && row.uploadedByUserId !== guard.userId) {
    return forbidden("Only the uploader or the project owner can delete this.");
  }

  try {
    await m.delete({ where: { id: attachmentId } });
    await removeStorageFile(row.storagePath);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[attachments.DELETE]", err);
    return serverError("Failed to delete.");
  }
}
