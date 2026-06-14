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
import { userIsProjectOwner } from "@/lib/access";
import {
  listDepartmentsForProject,
  defaultDepartmentName,
} from "@/lib/department-data";
import { ROLE_VALUES } from "@/lib/roles";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const KIND_VALUES = [...ROLE_VALUES, "custom"] as unknown as [string, ...string[]];

const createSchema = z.object({
  name: z.string().min(1).max(80),
  kind: z.enum(KIND_VALUES).default("custom"),
  /** Optional slug. Defaults to a slugified `name`. */
  key: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9_-]+$/)
    .optional(),
});

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
}

/** GET — any project member can list departments. */
export async function GET(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const departments = await listDepartmentsForProject(guard.userId, id);
  if (departments === null) return notFound("Project not found.");
  return NextResponse.json({ departments });
}

/** POST — owner-only. Create a new department on this project. */
export async function POST(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const owner = await userIsProjectOwner(guard.userId, id);
  if (!owner) return forbidden("Only the project owner can create departments.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(
      "Invalid department data.",
      parsed.error.flatten().fieldErrors
    );
  }

  const key = (parsed.data.key ?? slugify(parsed.data.name)).trim();
  if (!key) return badRequest("Department key cannot be empty.");

  const existing = await prisma.department.findUnique({
    where: { projectId_key: { projectId: id, key } },
    select: { id: true },
  });
  if (existing) {
    return badRequest("A department with that key already exists.");
  }

  // Position the new department after existing ones.
  const maxOrder = await prisma.department.aggregate({
    where: { projectId: id },
    _max: { order: true },
  });
  const nextOrder = (maxOrder._max.order ?? -1) + 1;

  try {
    const department = await prisma.department.create({
      data: {
        projectId: id,
        key,
        name: parsed.data.name.trim() || defaultDepartmentName(parsed.data.kind),
        kind: parsed.data.kind,
        order: nextOrder,
      },
    });

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "department_created",
      message: `created the ${department.name} department.`,
      metadata: { departmentId: department.id, kind: department.kind },
    });

    return NextResponse.json(
      {
        id: department.id,
        projectId: department.projectId,
        key: department.key,
        name: department.name,
        kind: department.kind,
        order: department.order,
        createdAt: department.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[departments.POST]", err);
    return serverError("Failed to create department.");
  }
}
