import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, notFound, serverError } from "@/lib/api";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** POST /api/notifications/[id]/read — mark a single notification read. */
export async function POST(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const existing = await prisma.notification.findFirst({
    where: { id, userId: guard.userId },
    select: { id: true },
  });
  if (!existing) return notFound("Notification not found.");

  try {
    await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[notifications.read]", err);
    return serverError("Failed to mark notification read.");
  }
}
