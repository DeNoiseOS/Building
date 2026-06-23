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
import { canEditBibleSection } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  url: z.string().url().max(800).nullable().optional(),
  body: z.string().max(20_000).nullable().optional(),
  type: z
    .enum([
      "note",
      "link",
      "image",
      "document",
      "video",
      "mood_board",
      "other",
    ])
    .optional(),
  pinned: z.boolean().optional(),
});

type RouteCtx = {
  params: Promise<{ id: string; entryId: string }>;
};

async function loadEntry(projectId: string, entryId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = (prisma as any).bibleEntry;
  if (!m) return null;
  const row = await m.findUnique({
    where: { id: entryId },
    include: {
      department: { select: { id: true, name: true, kind: true } },
    },
  });
  if (!row || row.projectId !== projectId) return null;
  return row as {
    id: string;
    title: string;
    department: { id: string; name: string; kind: string } | null;
  };
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  const guard = await requireUser();
  if (guard.response) return guard.response;
  const { id, entryId } = await ctx.params;
  if (!(await userHasProjectAccess(guard.userId, id)))
    return notFound("Project not found.");

  const row = await loadEntry(id, entryId);
  if (!row) return notFound("Entry not found.");

  if (
    !(await canEditBibleSection(
      { userId: guard.userId, projectId: id },
      row.department?.kind ?? null
    ))
  ) {
    return forbidden("Not allowed to edit this entry.");
  }

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = (prisma as any).bibleEntry;
    await m.update({
      where: { id: entryId },
      data: {
        ...(parsed.data.title !== undefined && { title: parsed.data.title.trim() }),
        ...(parsed.data.description !== undefined && {
          description: parsed.data.description,
        }),
        ...(parsed.data.url !== undefined && { url: parsed.data.url }),
        ...(parsed.data.body !== undefined && { body: parsed.data.body }),
        ...(parsed.data.type !== undefined && { type: parsed.data.type }),
        ...(parsed.data.pinned !== undefined && { pinned: parsed.data.pinned }),
      },
    });
    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "bible_entry_updated",
      message: `updated "${row.title}" in the Production Bible.`,
      metadata: { entryId },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[bible.PATCH]", err);
    return serverError("Failed to update.");
  }
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const guard = await requireUser();
  if (guard.response) return guard.response;
  const { id, entryId } = await ctx.params;
  if (!(await userHasProjectAccess(guard.userId, id)))
    return notFound("Project not found.");

  const row = await loadEntry(id, entryId);
  if (!row) return notFound("Entry not found.");

  if (
    !(await canEditBibleSection(
      { userId: guard.userId, projectId: id },
      row.department?.kind ?? null
    ))
  ) {
    return forbidden("Not allowed to delete this entry.");
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = (prisma as any).bibleEntry;
    await m.delete({ where: { id: entryId } });
    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "bible_entry_deleted",
      message: `removed "${row.title}" from the Production Bible.`,
      metadata: { entryId },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[bible.DELETE]", err);
    return serverError("Failed to delete.");
  }
}
