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
 * V0.18 — POST /api/projects/[id]/scenes/[sceneId]/assets
 *
 * Link an existing Equipment to a scene. The dept that owns the
 * Equipment gates the action — the caller must be that dept's head
 * (or above), via canEditSceneDepartment(equipment.department.kind).
 *
 * Quantity overbooking is INTENTIONALLY allowed; the API just
 * records demand. The UI surfaces shortage; production decides.
 */
const createSchema = z.object({
  equipmentId: z.string().min(1),
  quantityNeeded: z.number().int().min(1).max(10_000).default(1),
  notes: z.string().max(2000).nullable().optional(),
});

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string; sceneId: string }> }
) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, sceneId } = await ctx.params;
  const access = await userHasProjectAccess(guard.userId, id);
  if (!access) return notFound("Project not found.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid payload.", parsed.error.flatten().fieldErrors);
  }

  const scene = await prisma.scene.findFirst({
    where: { id: sceneId, projectId: id },
    select: { id: true },
  });
  if (!scene) return notFound("Scene not found.");

  const equipment = await prisma.equipment.findFirst({
    where: { id: parsed.data.equipmentId, projectId: id },
    include: { department: { select: { id: true, kind: true, name: true } } },
  });
  if (!equipment) return notFound("Equipment not found on this project.");

  const allowed = await canEditSceneDepartment(
    { userId: guard.userId, projectId: id },
    equipment.department.kind
  );
  if (!allowed) {
    return forbidden(
      `Only the ${equipment.department.name} head (or scene authors) can add this asset.`
    );
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sa = (prisma as any).sceneAsset;
    const created = await sa.create({
      data: {
        sceneId,
        equipmentId: equipment.id,
        quantityNeeded: parsed.data.quantityNeeded,
        notes: parsed.data.notes ?? null,
        addedByUserId: guard.userId,
      },
    });
    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "scene_asset_linked",
      message: `linked ${equipment.name} to the scene (×${parsed.data.quantityNeeded}).`,
      metadata: { sceneId, equipmentId: equipment.id },
    });
    return NextResponse.json({ ok: true, id: created.id });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2002") {
      return badRequest("This asset is already linked to the scene.");
    }
    console.error("[scene.assets.POST]", err);
    return serverError("Failed to link asset.");
  }
}
