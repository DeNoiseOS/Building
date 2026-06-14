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
  description: z.string().max(2000).optional().nullable(),
  imageUrl: z.string().max(2000).optional().nullable(),
  link: z.string().max(2000).optional().nullable(),
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

  const project = await prisma.project.findFirst({
    where: { id: projectId, ...projectAccessFilter(guard.userId) },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ references: [] });
  }

  const { workspaceItemDepartmentFilter } = await import("@/lib/permissions");
  const visibility = await workspaceItemDepartmentFilter({
    userId: guard.userId,
    projectId,
  });
  const where: Record<string, unknown> = { projectId };
  if (section) where.section = section;
  if (visibility) Object.assign(where, visibility);

  const references = await prisma.reference.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    references: references.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      title: r.title,
      description: r.description,
      imageUrl: r.imageUrl,
      link: r.link,
      section: r.section,
      createdAt: r.createdAt.toISOString(),
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
    return badRequest(
      "Invalid reference data.",
      parsed.error.flatten().fieldErrors
    );
  }

  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, ...projectAccessFilter(guard.userId) },
    select: {
      id: true,
      role: true,
      members: { where: { userId: guard.userId }, select: { role: true } },
    },
  });
  if (!project) {
    return badRequest("Project not found or not accessible.");
  }
  const callerRole = project.members[0]?.role ?? project.role;

  try {
    let departmentId: string | null = parsed.data.departmentId ?? null;
    if (departmentId) {
      const dept = await prisma.department.findFirst({
        where: { id: departmentId, projectId: project.id },
        select: { id: true },
      });
      if (!dept) departmentId = null;
    }

    const reference = await prisma.reference.create({
      data: {
        projectId: parsed.data.projectId,
        departmentId,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        imageUrl: parsed.data.imageUrl ?? null,
        link: parsed.data.link ?? null,
        section: parsed.data.section,
      },
    });

    const sectionDef = findSectionByKey(callerRole, reference.section);
    const sectionLabel = sectionDef?.label ?? reference.section;

    await logActivity({
      projectId: reference.projectId,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "reference_created",
      message: `added reference '${reference.title}' in ${sectionLabel}.`,
      metadata: { referenceId: reference.id, section: reference.section },
    });

    return NextResponse.json(
      {
        id: reference.id,
        projectId: reference.projectId,
        title: reference.title,
        description: reference.description,
        imageUrl: reference.imageUrl,
        link: reference.link,
        section: reference.section,
        createdAt: reference.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[references.POST]", err);
    return serverError("Failed to create reference.");
  }
}
