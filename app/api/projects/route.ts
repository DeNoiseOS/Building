import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, badRequest, serverError } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { decorateProjectsWithStats } from "@/lib/project-stats";
import { projectAccessFilter } from "@/lib/access";
import { ROLE_VALUES, PROJECT_STATUS } from "@/lib/roles";

const createSchema = z
  .object({
    name: z.string().min(1, "Name is required.").max(200),
    description: z.string().max(2000).optional().nullable(),
    role: z.enum(ROLE_VALUES as unknown as [string, ...string[]]),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
  })
  .refine((d) => new Date(d.endDate) >= new Date(d.startDate), {
    message: "End date must be on or after the start date.",
    path: ["endDate"],
  });

export async function GET(request: Request) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const accessFilter = projectAccessFilter(guard.userId);
  const where =
    status && PROJECT_STATUS.some((s) => s.value === status)
      ? { AND: [accessFilter, { status }] }
      : accessFilter;

  const projects = await prisma.project.findMany({
    where,
    orderBy: [{ status: "asc" }, { endDate: "asc" }],
    include: {
      tasks: { select: { status: true, dueDate: true } },
    },
  });

  const decorated = decorateProjectsWithStats(projects).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    role: p.role,
    startDate: p.startDate.toISOString(),
    endDate: p.endDate.toISOString(),
    status: p.status,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    stats: p.stats,
  }));

  return NextResponse.json({ projects: decorated });
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
    return badRequest("Invalid project data.", parsed.error.flatten().fieldErrors);
  }

  try {
    // V0.2: create project AND register the owner as a ProjectMember so
    // they show up in the members list with their declared role.
    const project = await prisma.project.create({
      data: {
        userId: guard.userId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        role: parsed.data.role,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
        members: {
          create: {
            userId: guard.userId,
            role: parsed.data.role,
          },
        },
      },
    });

    await logActivity({
      projectId: project.id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "project_created",
      message: `created project '${project.name}'.`,
      metadata: { role: project.role },
    });

    return NextResponse.json(
      {
        id: project.id,
        name: project.name,
        description: project.description,
        role: project.role,
        startDate: project.startDate.toISOString(),
        endDate: project.endDate.toISOString(),
        status: project.status,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[projects.POST]", err);
    return serverError("Failed to create project.");
  }
}
