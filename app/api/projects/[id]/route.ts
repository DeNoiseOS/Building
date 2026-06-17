import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, badRequest, forbidden, notFound, serverError } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { computeProjectStats } from "@/lib/project-stats";
import { projectAccessFilter, userHasProjectAccess } from "@/lib/access";
import { PROJECT_STATUS } from "@/lib/roles";
import { canEditProjectSettings } from "@/lib/permissions";

// V0.12.1 — `role` removed from project PATCH. Users can never modify
// their own project role; role changes happen via the members API and
// only by authorized admins.
const updateSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional().nullable(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    status: z
      .enum(
        PROJECT_STATUS.map((s) => s.value) as unknown as [string, ...string[]]
      )
      .optional(),
  })
  .refine(
    (d) => {
      if (d.startDate && d.endDate) {
        return new Date(d.endDate) >= new Date(d.startDate);
      }
      return true;
    },
    {
      message: "End date must be on or after the start date.",
      path: ["endDate"],
    }
  );

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET only — readable by any project member or owner.
async function loadProjectWithAccess(userId: string, projectId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, ...projectAccessFilter(userId) },
    include: {
      tasks: {
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          completedAt: true,
        },
        orderBy: { dueDate: "asc" },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 15,
      },
    },
  });
}

export async function GET(_request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const project = await loadProjectWithAccess(guard.userId, id);
  if (!project) return notFound("Project not found.");

  const stats = computeProjectStats({
    startDate: project.startDate,
    endDate: project.endDate,
    tasks: project.tasks.map((t) => ({ status: t.status, dueDate: t.dueDate })),
  });

  return NextResponse.json({
    id: project.id,
    name: project.name,
    description: project.description,
    role: project.role,
    startDate: project.startDate.toISOString(),
    endDate: project.endDate.toISOString(),
    status: project.status,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    stats,
    tasks: project.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate?.toISOString() ?? null,
      completedAt: t.completedAt?.toISOString() ?? null,
    })),
    activities: project.activities.map((a) => ({
      id: a.id,
      type: a.type,
      message: a.message,
      createdAt: a.createdAt.toISOString(),
      actorId: a.actorId,
      actorName: a.actorName,
    })),
  });
}

export async function PATCH(request: Request, ctx: RouteContext) {
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
      "Only the project owner, executive producer, or producer can edit project settings."
    );
  }

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) return notFound("Project not found.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid project data.", parsed.error.flatten().fieldErrors);
  }

  // Cross-field validation when only one date is being updated.
  const newStart = parsed.data.startDate
    ? new Date(parsed.data.startDate)
    : existing.startDate;
  const newEnd = parsed.data.endDate
    ? new Date(parsed.data.endDate)
    : existing.endDate;
  if (newEnd < newStart) {
    return badRequest("End date must be on or after the start date.", {
      endDate: ["End date must be on or after the start date."],
    });
  }

  try {
    const updated = await prisma.project.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.description !== undefined && {
          description: parsed.data.description,
        }),
        ...(parsed.data.startDate !== undefined && { startDate: newStart }),
        ...(parsed.data.endDate !== undefined && { endDate: newEnd }),
        ...(parsed.data.status !== undefined && { status: parsed.data.status }),
      },
    });

    const changedFields = Object.keys(parsed.data).filter(
      (k) => parsed.data[k as keyof typeof parsed.data] !== undefined
    );

    await logActivity({
      projectId: updated.id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "project_updated",
      message: `updated project '${updated.name}'.`,
      metadata: { fields: changedFields },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      role: updated.role,
      startDate: updated.startDate.toISOString(),
      endDate: updated.endDate.toISOString(),
      status: updated.status,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    console.error("[projects.PATCH]", err);
    return serverError("Failed to update project.");
  }
}

export async function DELETE(_request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const existing = await prisma.project.findFirst({
    where: { id, userId: guard.userId },
  });
  if (!existing) {
    const accessible = await prisma.project.findFirst({
      where: { id },
      select: { id: true },
    });
    return accessible
      ? forbidden("Only the project owner can delete this project.")
      : notFound("Project not found.");
  }

  try {
    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[projects.DELETE]", err);
    return serverError("Failed to delete project.");
  }
}
