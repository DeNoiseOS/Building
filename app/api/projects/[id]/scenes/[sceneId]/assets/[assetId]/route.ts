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
import { canEditSceneDepartment } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

/**
 * V0.18 — PATCH/DELETE a single SceneAsset row.
 *
 * Auth same as POST: dept-head-or-above for the equipment's dept.
 */
const patchSchema = z.object({
  quantityNeeded: z.number().int().min(1).max(10_000).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

type RouteCtx = {
  params: Promise<{ id: string; sceneId: string; assetId: string }>;
};

async function loadRow(projectId: string, assetId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sa = (prisma as any).sceneAsset;
  if (!sa) return null;
  const row = await sa.findUnique({
    where: { id: assetId },
    include: {
      scene: { select: { projectId: true } },
      equipment: {
        include: { department: { select: { kind: true, name: true } } },
      },
    },
  });
  if (!row || row.scene.projectId !== projectId) return null;
  return row as {
    id: string;
    sceneId: string;
    equipmentId: string;
    equipment: {
      name: string;
      department: { kind: string; name: string };
    };
  };
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  const guard = await requireUser();
  if (guard.response) return guard.response;
  const { id, assetId } = await ctx.params;
  if (!(await userHasProjectAccess(guard.userId, id)))
    return notFound("Project not found.");

  const row = await loadRow(id, assetId);
  if (!row) return notFound("Scene asset not found.");

  if (
    !(await canEditSceneDepartment(
      { userId: guard.userId, projectId: id },
      row.equipment.department.kind
    ))
  ) {
    return forbidden("Not allowed to edit this asset link.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid payload.", parsed.error.flatten().fieldErrors);
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sa = (prisma as any).sceneAsset;
    await sa.update({
      where: { id: assetId },
      data: {
        ...(parsed.data.quantityNeeded !== undefined && {
          quantityNeeded: parsed.data.quantityNeeded,
        }),
        ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
      },
    });
    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "scene_asset_updated",
      message: `updated ${row.equipment.name} on the scene.`,
      metadata: { sceneId: row.sceneId, equipmentId: row.equipmentId },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[scene.assets.PATCH]", err);
    return serverError("Failed.");
  }
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const guard = await requireUser();
  if (guard.response) return guard.response;
  const { id, assetId } = await ctx.params;
  if (!(await userHasProjectAccess(guard.userId, id)))
    return notFound("Project not found.");

  const row = await loadRow(id, assetId);
  if (!row) return notFound("Scene asset not found.");

  if (
    !(await canEditSceneDepartment(
      { userId: guard.userId, projectId: id },
      row.equipment.department.kind
    ))
  ) {
    return forbidden("Not allowed to remove this asset link.");
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sa = (prisma as any).sceneAsset;
    await sa.delete({ where: { id: assetId } });
    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "scene_asset_unlinked",
      message: `removed ${row.equipment.name} from the scene.`,
      metadata: { sceneId: row.sceneId, equipmentId: row.equipmentId },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[scene.assets.DELETE]", err);
    return serverError("Failed.");
  }
}
