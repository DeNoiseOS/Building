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
import { logActivity } from "@/lib/activity";
import { notifyMany } from "@/lib/notifications";
import { canManageAnnouncement } from "@/lib/announcements";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  pinned: z.boolean().optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});

/** GET — list announcements. Any project member. */
export async function GET(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const access = await userHasProjectAccess(guard.userId, id);
  if (!access) return notFound("Project not found.");

  const now = new Date();
  const rows = await prisma.announcement.findMany({
    where: {
      projectId: id,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    include: { author: { select: { id: true, name: true } } },
  });
  return NextResponse.json({
    announcements: rows.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      pinned: a.pinned,
      expiresAt: a.expiresAt?.toISOString() ?? null,
      author: a.author,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    })),
  });
}

/** POST — owner / producer / director only. */
export async function POST(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const allowed = await canManageAnnouncement({
    userId: guard.userId,
    projectId: id,
  });
  if (!allowed) {
    return forbidden("Only owner / producer / director can post announcements.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid data.", parsed.error.flatten().fieldErrors);
  }

  try {
    const created = await prisma.announcement.create({
      data: {
        projectId: id,
        authorId: guard.userId,
        title: parsed.data.title.trim(),
        body: parsed.data.body.trim(),
        pinned: parsed.data.pinned ?? false,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      },
    });

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "announcement_created",
      message: `posted an announcement '${created.title}'.`,
      metadata: { announcementId: created.id },
    });

    // Notify every project member except the author.
    const members = await prisma.projectMember.findMany({
      where: { projectId: id },
      select: { userId: true },
    });
    await notifyMany(
      members.map((m) => m.userId),
      {
        type: "announcement_created",
        title: `Announcement: ${created.title}`,
        body: created.body.slice(0, 140),
        link: `/projects/${id}/announcements`,
        metadata: { announcementId: created.id, projectId: id },
        skipUserId: guard.userId,
      }
    );

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err) {
    console.error("[announcements.POST]", err);
    return serverError("Failed to post announcement.");
  }
}
