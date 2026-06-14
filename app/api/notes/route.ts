import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, badRequest, serverError } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { findSectionByKey } from "@/lib/sections";
import { projectAccessFilter } from "@/lib/access";

const createSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1, "Title is required.").max(200),
  body: z.string().max(20000).default(""),
  section: z.string().min(1, "Section is required.").max(100),
  /** V1.0A: optional department ownership. */
  departmentId: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  const section = url.searchParams.get("section") ?? undefined;

  if (!projectId) {
    return badRequest("projectId is required.");
  }

  // Verify the caller has access (owner or member) to the project.
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...projectAccessFilter(guard.userId) },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ notes: [] });
  }

  const { workspaceItemDepartmentFilter } = await import("@/lib/permissions");
  const visibility = await workspaceItemDepartmentFilter({
    userId: guard.userId,
    projectId,
  });
  const where: Record<string, unknown> = { projectId };
  if (section) where.section = section;
  if (visibility) Object.assign(where, visibility);

  const notes = await prisma.note.findMany({
    where,
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    notes: notes.map((n) => ({
      id: n.id,
      projectId: n.projectId,
      title: n.title,
      body: n.body,
      section: n.section,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid note data.", parsed.error.flatten().fieldErrors);
  }

  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, ...projectAccessFilter(guard.userId) },
    select: {
      id: true,
      role: true,
      // V0.4: resolve section label against the caller's member role so the
      // activity message reflects their workspace, not the project's headline.
      members: { where: { userId: guard.userId }, select: { role: true } },
    },
  });
  if (!project) {
    return badRequest("Project not found or not accessible.");
  }
  const callerRole = project.members[0]?.role ?? project.role;

  try {
    // V1.0A: validate departmentId belongs to this project if provided.
    let departmentId: string | null = parsed.data.departmentId ?? null;
    if (departmentId) {
      const dept = await prisma.department.findFirst({
        where: { id: departmentId, projectId: project.id },
        select: { id: true },
      });
      if (!dept) departmentId = null;
    }

    const note = await prisma.note.create({
      data: {
        projectId: parsed.data.projectId,
        departmentId,
        title: parsed.data.title,
        body: parsed.data.body,
        section: parsed.data.section,
      },
    });

    const sectionDef = findSectionByKey(callerRole, note.section);
    const sectionLabel = sectionDef?.label ?? note.section;

    await logActivity({
      projectId: note.projectId,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "note_created",
      message: `added note '${note.title}' in ${sectionLabel}.`,
      metadata: { noteId: note.id, section: note.section },
    });

    return NextResponse.json(
      {
        id: note.id,
        projectId: note.projectId,
        title: note.title,
        body: note.body,
        section: note.section,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[notes.POST]", err);
    return serverError("Failed to create note.");
  }
}
