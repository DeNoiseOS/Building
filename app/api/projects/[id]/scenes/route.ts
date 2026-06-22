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
import { canManageScene } from "@/lib/permissions";
import {
  SCENE_TYPE_VALUES,
  SCENE_TIME_VALUES,
  SCENE_STATUS_VALUES,
} from "@/lib/scene-data";
import { logActivity } from "@/lib/activity";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const attachmentsSchema = z
  .array(
    z.object({
      title: z.string().min(1).max(120),
      url: z.string().url().max(800),
    })
  )
  .max(20);

const createSchema = z.object({
  number: z.string().min(1).max(20),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  type: z
    .enum(SCENE_TYPE_VALUES as unknown as [string, ...string[]])
    .default("INT"),
  timeOfDay: z
    .enum(SCENE_TIME_VALUES as unknown as [string, ...string[]])
    .default("day"),
  notes: z.string().max(4000).optional().nullable(),
  attachments: attachmentsSchema.optional(),
});

/**
 * GET /api/projects/[id]/scenes
 *
 * Query params:
 *   - q                  text search on number/title/location
 *   - status             filter by SCENE_STATUS
 *   - type               filter by SCENE_TYPE
 *   - timeOfDay          filter by SCENE_TIME_OF_DAY
 *   - sort               "number" (default) | "status" | "updated"
 */
export async function GET(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const access = await userHasProjectAccess(guard.userId, id);
  if (!access) return notFound("Project not found.");

  const sp = new URL(request.url).searchParams;
  const q = sp.get("q")?.trim();
  const status = sp.get("status") ?? undefined;
  const type = sp.get("type") ?? undefined;
  const timeOfDay = sp.get("timeOfDay") ?? undefined;
  const sort = sp.get("sort") ?? "number";

  const where: Record<string, unknown> = { projectId: id };
  if (status && (SCENE_STATUS_VALUES as readonly string[]).includes(status)) {
    where.status = status;
  }
  if (type && (SCENE_TYPE_VALUES as readonly string[]).includes(type)) {
    where.type = type;
  }
  if (timeOfDay && (SCENE_TIME_VALUES as readonly string[]).includes(timeOfDay)) {
    where.timeOfDay = timeOfDay;
  }
  if (q) {
    where.OR = [
      { number: { contains: q, mode: "insensitive" } },
      { title: { contains: q, mode: "insensitive" } },
      { location: { contains: q, mode: "insensitive" } },
    ];
  }

  const orderBy =
    sort === "status"
      ? [{ status: "asc" as const }, { number: "asc" as const }]
      : sort === "updated"
      ? [{ updatedAt: "desc" as const }]
      : [{ number: "asc" as const }];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sceneModel = (prisma as any).scene;
  if (!sceneModel || typeof sceneModel.findMany !== "function") {
    return NextResponse.json({ scenes: [] });
  }

  try {
    const rows = await sceneModel.findMany({
      where,
      orderBy,
      include: {
        departments: {
          select: {
            id: true,
            departmentId: true,
            enabled: true,
            status: true,
            approvalStatus: true,
            department: { select: { id: true, name: true, kind: true } },
          },
        },
      },
    });
    return NextResponse.json({ scenes: rows });
  } catch (err) {
    console.error("[scenes.GET]", err);
    return serverError("Failed to load scenes.");
  }
}

/** POST — create a scene. Scene-author roles only. */
export async function POST(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const access = await userHasProjectAccess(guard.userId, id);
  if (!access) return notFound("Project not found.");

  const allowed = await canManageScene({
    userId: guard.userId,
    projectId: id,
  });
  if (!allowed) {
    return forbidden(
      "Only Director / Assistant Director / Producer / EP / Owner can create scenes."
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid scene.", parsed.error.flatten().fieldErrors);
  }

  try {
    const created = await prisma.scene.create({
      data: {
        projectId: id,
        number: parsed.data.number.trim(),
        title: parsed.data.title.trim(),
        description: parsed.data.description ?? null,
        location: parsed.data.location ?? null,
        type: parsed.data.type,
        timeOfDay: parsed.data.timeOfDay,
        notes: parsed.data.notes ?? null,
        attachments: parsed.data.attachments ?? undefined,
        createdByUserId: guard.userId,
        updatedByUserId: guard.userId,
      },
    });
    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "scene_created",
      message: `created scene #${created.number} '${created.title}'.`,
      metadata: { sceneId: created.id },
    });
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002") {
      return badRequest("A scene with that number already exists.");
    }
    console.error("[scenes.POST]", err);
    return serverError("Failed to create scene.");
  }
}
