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
import { canManageAnnouncement } from "@/lib/announcements";

interface RouteContext {
  params: Promise<{ id: string; annId: string }>;
}

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(10000).optional(),
  pinned: z.boolean().optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});

export async function PATCH(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, annId } = await ctx.params;
  const allowed = await canManageAnnouncement({
    userId: guard.userId,
    projectId: id,
  });
  if (!allowed) return forbidden("Not allowed.");

  const existing = await prisma.announcement.findFirst({
    where: { id: annId, projectId: id },
  });
  if (!existing) return notFound("Announcement not found.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid data.", parsed.error.flatten().fieldErrors);
  }

  try {
    const updated = await prisma.announcement.update({
      where: { id: annId },
      data: {
        ...(parsed.data.title !== undefined && { title: parsed.data.title.trim() }),
        ...(parsed.data.body !== undefined && { body: parsed.data.body.trim() }),
        ...(parsed.data.pinned !== undefined && { pinned: parsed.data.pinned }),
        ...(parsed.data.expiresAt !== undefined && {
          expiresAt: parsed.data.expiresAt
            ? new Date(parsed.data.expiresAt)
            : null,
        }),
      },
    });
    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "announcement_updated",
      message: `updated announcement '${updated.title}'.`,
      metadata: { announcementId: updated.id },
    });
    return NextResponse.json({ id: updated.id });
  } catch (err) {
    console.error("[announcements.PATCH]", err);
    return serverError("Failed to update.");
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, annId } = await ctx.params;
  const allowed = await canManageAnnouncement({
    userId: guard.userId,
    projectId: id,
  });
  if (!allowed) return forbidden("Not allowed.");

  const existing = await prisma.announcement.findFirst({
    where: { id: annId, projectId: id },
  });
  if (!existing) return notFound("Announcement not found.");

  try {
    await prisma.announcement.delete({ where: { id: annId } });
    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "announcement_deleted",
      message: `deleted announcement '${existing.title}'.`,
      metadata: { announcementId: annId },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[announcements.DELETE]", err);
    return serverError("Failed to delete.");
  }
}
