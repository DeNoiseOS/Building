import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, badRequest, notFound, serverError } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { projectAccessFilter } from "@/lib/access";

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().max(20000).optional(),
  section: z.string().min(1).max(100).optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function loadNoteWithAccess(userId: string, noteId: string) {
  return prisma.note.findFirst({
    where: { id: noteId, project: projectAccessFilter(userId) },
    include: { project: { select: { id: true, role: true } } },
  });
}

export async function GET(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const note = await loadNoteWithAccess(guard.userId, id);
  if (!note) return notFound("Note not found.");

  return NextResponse.json({
    id: note.id,
    projectId: note.projectId,
    title: note.title,
    body: note.body,
    section: note.section,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  });
}

export async function PATCH(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const existing = await loadNoteWithAccess(guard.userId, id);
  if (!existing) return notFound("Note not found.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid note data.", parsed.error.flatten().fieldErrors);
  }

  try {
    const updated = await prisma.note.update({
      where: { id },
      data: {
        ...(parsed.data.title !== undefined && { title: parsed.data.title }),
        ...(parsed.data.body !== undefined && { body: parsed.data.body }),
        ...(parsed.data.section !== undefined && { section: parsed.data.section }),
      },
    });

    const changedFields = Object.keys(parsed.data).filter(
      (k) => parsed.data[k as keyof typeof parsed.data] !== undefined
    );
    if (changedFields.length > 0) {
      await logActivity({
        projectId: updated.projectId,
        actorId: guard.userId,
        actorName: guard.userName,
        type: "note_updated",
        message: `updated note '${updated.title}'.`,
        metadata: { noteId: updated.id, fields: changedFields },
      });
    }

    return NextResponse.json({
      id: updated.id,
      projectId: updated.projectId,
      title: updated.title,
      body: updated.body,
      section: updated.section,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    console.error("[notes.PATCH]", err);
    return serverError("Failed to update note.");
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const existing = await loadNoteWithAccess(guard.userId, id);
  if (!existing) return notFound("Note not found.");

  try {
    await prisma.note.delete({ where: { id } });
    await logActivity({
      projectId: existing.projectId,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "note_deleted",
      message: `deleted note '${existing.title}'.`,
      metadata: { noteId: existing.id },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[notes.DELETE]", err);
    return serverError("Failed to delete note.");
  }
}
