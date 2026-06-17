import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, forbidden, notFound, serverError } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { canEditProjectSettings } from "@/lib/permissions";
import { userHasProjectAccess } from "@/lib/access";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;

  // V0.12.1 — Owner / Executive Producer / Producer.
  const hasAccess = await userHasProjectAccess(guard.userId, id);
  if (!hasAccess) return notFound("Project not found.");
  const canEdit = await canEditProjectSettings({
    userId: guard.userId,
    projectId: id,
  });
  if (!canEdit) {
    return forbidden(
      "Only owner / executive producer / producer can archive this project."
    );
  }

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) return notFound("Project not found.");

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
