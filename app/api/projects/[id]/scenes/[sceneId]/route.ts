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
  params: Promise<{ id: string; sceneId: string }>;
}

const attachmentsSchema = z
  .array(
    z.object({
      title: z.string().min(1).max(120),
      url: z.string().url().max(800),
    })
  )
  .max(20);

const patchSchema = z.object({
  number: z.string().min(1).max(20).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  type: z
    .enum(SCENE_TYPE_VALUES as unknown as [string, ...string[]])
    .optional(),
  timeOfDay: z
    .enum(SCENE_TIME_VALUES as unknown as [string, ...string[]])
    .optional(),
  status: z
    .enum(SCENE_STATUS_VALUES as unknown as [string, ...string[]])
    .optional(),
  notes: z.string().max(4000).nullable().optional(),
  attachments: attachmentsSchema.nullable().optional(),
  // V0.19 — Gallery thumbnail. Only canManageScene can change this
  // (the route already gates PATCH on canManageScene).
  coverImageUrl: z
    .string()
    .url()
    .max(800)
    .nullable()
    .optional()
    .or(z.literal("")),
});

/** GET — full scene with department workspaces. */
export async function GET(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, sceneId } = await ctx.params;
  const access = await userHasProjectAccess(guard.userId, id);
  if (!access) return notFound("Project not found.");

  const scene = await prisma.scene.findFirst({
    where: { id: sceneId, projectId: id },
    include: {
      createdBy: { select: { id: true, name: true } },
      updatedBy: { select: { id: true, name: true } },
      departments: {
        include: {
          department: { select: { id: true, name: true, kind: true } },
          approvedBy: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!scene) return notFound("Scene not found.");
  return NextResponse.json({ scene });
}

/** PATCH — edit scene fields + change status. Scene-author roles. */
export async function PATCH(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, sceneId } = await ctx.params;
  const access = await userHasProjectAccess(guard.userId, id);
  if (!access) return notFound("Project not found.");

  const allowed = await canManageScene({
    userId: guard.userId,
    projectId: id,
  });
  if (!allowed) {
    return forbidden(
      "Only Director / AD / Producer / EP / Owner can edit scenes."
    );
  }

  const existing = await prisma.scene.findFirst({
    where: { id: sceneId, projectId: id },
    select: { id: true },
  });
  if (!existing) return notFound("Scene not found.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid update.", parsed.error.flatten().fieldErrors);
  }

  try {
    await prisma.scene.update({
      where: { id: sceneId },
      data: {
        ...(parsed.data.number !== undefined && { number: parsed.data.number.trim() }),
        ...(parsed.data.title !== undefined && { title: parsed.data.title.trim() }),
        ...(parsed.data.description !== undefined && {
          description: parsed.data.description,
        }),
        ...(parsed.data.location !== undefined && { location: parsed.data.location }),
        ...(parsed.data.type !== undefined && { type: parsed.data.type }),
        ...(parsed.data.timeOfDay !== undefined && {
          timeOfDay: parsed.data.timeOfDay,
        }),
        ...(parsed.data.status !== undefined && { status: parsed.data.status }),
        ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
        ...(parsed.data.coverImageUrl !== undefined && {
          coverImageUrl: parsed.data.coverImageUrl
            ? parsed.data.coverImageUrl
            : null,
        }),
        ...(parsed.data.attachments !== undefined && {
          attachments: parsed.data.attachments ?? undefined,
        }),
        updatedByUserId: guard.userId,
      },
    });

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "scene_updated",
      message: `updated scene.`,
      metadata: { sceneId },
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002") {
      return badRequest("A scene with that number already exists.");
    }
    console.error("[scene.PATCH]", err);
    return serverError("Failed to update scene.");
  }
}

/** DELETE — scene-author roles only. */
export async function DELETE(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, sceneId } = await ctx.params;
  const access = await userHasProjectAccess(guard.userId, id);
  if (!access) return notFound("Project not found.");

  const allowed = await canManageScene({
    userId: guard.userId,
    projectId: id,
  });
  if (!allowed) return forbidden("Only scene authors can delete scenes.");

  const existing = await prisma.scene.findFirst({
    where: { id: sceneId, projectId: id },
    select: { id: true, number: true },
  });
  if (!existing) return notFound("Scene not found.");

  try {
    await prisma.scene.delete({ where: { id: sceneId } });
    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "scene_deleted",
      message: `deleted scene #${existing.number}.`,
      metadata: { sceneId },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[scene.DELETE]", err);
    return serverError("Failed to delete scene.");
  }
}
