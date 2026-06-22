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
import {
  canManageScene,
  canEditSceneDepartment,
} from "@/lib/permissions";
import { SCENE_DEPT_STATUS_VALUES } from "@/lib/scene-data";
import { recomputeSceneReadiness } from "@/lib/scene-server";
import { logActivity } from "@/lib/activity";

interface RouteContext {
  params: Promise<{ id: string; sceneId: string; deptId: string }>;
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
  /** Director / AD toggle dept on/off per scene. */
  enabled: z.boolean().optional(),
  /** Dept-status workspace updates. */
  status: z
    .enum(SCENE_DEPT_STATUS_VALUES as unknown as [string, ...string[]])
    .optional(),
  requirements: z.string().max(4000).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  attachments: attachmentsSchema.nullable().optional(),
});

/**
 * PATCH — update a scene-department row.
 *
 * Field-level gating:
 *   - `enabled`     → canManageScene (Director / AD / Producer / EP / Owner)
 *   - workspace fields (status / requirements / notes / attachments)
 *                   → canEditSceneDepartment (resolved dept head + above)
 *
 * Status change to "completed" leaves approvalStatus untouched (still
 * pending_review); the explicit /approve endpoint flips that.
 */
export async function PATCH(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, sceneId, deptId } = await ctx.params;
  const access = await userHasProjectAccess(guard.userId, id);
  if (!access) return notFound("Project not found.");

  const scene = await prisma.scene.findFirst({
    where: { id: sceneId, projectId: id },
    select: { id: true },
  });
  if (!scene) return notFound("Scene not found.");

  const dept = await prisma.department.findFirst({
    where: { id: deptId, projectId: id },
    select: { id: true, kind: true, name: true },
  });
  if (!dept) return notFound("Department not found on this project.");

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

  const callerCtx = { userId: guard.userId, projectId: id };
  const canManage = await canManageScene(callerCtx);
  const canEditWorkspace = await canEditSceneDepartment(callerCtx, dept.kind);

  // Toggle `enabled` requires manage-scene authority.
  if (parsed.data.enabled !== undefined && !canManage) {
    return forbidden(
      "Only Director / AD / Producer / EP / Owner can toggle a department."
    );
  }
  // Workspace edits require head-or-above.
  const workspaceFieldTouched =
    parsed.data.status !== undefined ||
    parsed.data.requirements !== undefined ||
    parsed.data.notes !== undefined ||
    parsed.data.attachments !== undefined;
  if (workspaceFieldTouched && !canEditWorkspace) {
    return forbidden(
      "Only the dept head (or scene authors) can edit this workspace."
    );
  }

  try {
    // Upsert so a toggle-on creates the row if it doesn't exist yet.
    await prisma.sceneDepartment.upsert({
      where: { sceneId_departmentId: { sceneId, departmentId: deptId } },
      create: {
        sceneId,
        departmentId: deptId,
        enabled: parsed.data.enabled ?? true,
        status: parsed.data.status ?? "not_started",
        requirements: parsed.data.requirements ?? null,
        notes: parsed.data.notes ?? null,
        attachments: parsed.data.attachments ?? undefined,
      },
      update: {
        ...(parsed.data.enabled !== undefined && { enabled: parsed.data.enabled }),
        ...(parsed.data.status !== undefined && { status: parsed.data.status }),
        ...(parsed.data.requirements !== undefined && {
          requirements: parsed.data.requirements,
        }),
        ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
        ...(parsed.data.attachments !== undefined && {
          attachments: parsed.data.attachments ?? undefined,
        }),
        // V0.17 — when status moves AWAY from completed, clear approval.
        ...(parsed.data.status !== undefined &&
          parsed.data.status !== "completed" && {
            approvalStatus: "pending_review",
            approvedAt: null,
            approvedByUserId: null,
          }),
      },
    });

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "scene_department_updated",
      message: `updated ${dept.name} on the scene.`,
      metadata: { sceneId, departmentId: deptId },
    });

    // V0.17 — auto-readiness recompute after any change.
    await recomputeSceneReadiness(sceneId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[scene.dept.PATCH]", err);
    return serverError("Failed to update.");
  }
}
