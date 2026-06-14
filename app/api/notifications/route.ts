import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, serverError } from "@/lib/api";

/** GET /api/notifications — the caller's most recent notifications. */
export async function GET(request: Request) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const url = new URL(request.url);
  const onlyUnread = url.searchParams.get("unread") === "1";

  try {
    const rows = await prisma.notification.findMany({
      where: {
        userId: guard.userId,
        ...(onlyUnread ? { readAt: null } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const unreadCount = await prisma.notification.count({
      where: { userId: guard.userId, readAt: null },
    });
    return NextResponse.json({
      notifications: rows.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        link: n.link,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount,
    });
  } catch (err) {
    console.error("[notifications.GET]", err);
    return serverError("Failed to load notifications.");
  }
}

/** POST /api/notifications/read-all — mark all unread as read. */
export async function POST() {
  const guard = await requireUser();
  if (guard.response) return guard.response;
  try {
    await prisma.notification.updateMany({
      where: { userId: guard.userId, readAt: null },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[notifications.read-all]", err);
    return serverError("Failed to mark notifications read.");
  }
}
