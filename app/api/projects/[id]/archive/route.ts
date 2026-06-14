import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, forbidden, notFound, serverError } from "@/lib/api";
import { logActivity } from "@/lib/activity";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  // Archive is an owner-only operation.
  const existing = await prisma.project.findFirst({
    where: { id, userId: guard.userId },
  });
  if (!existing) {
    const accessible = await prisma.project.findFirst({
      where: { id },
      select: { id: true },
    });
    return accessible
      ? forbidden("Only the project owner can archive this project.")
      : notFound("Project not found.");
  }

  const nextStatus = existing.status === "archived" ? "active" : "archived";

  try {
    const updated = await prisma.project.update({
      where: { id },
      data: { status: nextStatus },
    });

    await logActivity({
      projectId: updated.id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: nextStatus === "archived" ? "project_archived" : "project_unarchived",
      message:
        nextStatus === "archived"
          ? `archived project '${updated.name}'.`
          : `unarchived project '${updated.name}'.`,
    });

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
    });
  } catch (err) {
    console.error("[projects.archive]", err);
    return serverError("Failed to update project status.");
  }
}
