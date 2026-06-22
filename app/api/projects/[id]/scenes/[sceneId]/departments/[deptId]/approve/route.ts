import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  badRequest,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api";
import { userHasProjectAccess } from "@/lib/access";
import { canApproveSceneDepartment } from "@/lib/permissions";
import { recomputeSceneReadiness } from "@/lib/scene-server";
import { logActivity } from "@/lib/activity";

/**
 * V0.17 — POST /scenes/[sceneId]/departments/[deptId]/approve
 *
 * Director / AD / Producer / EP / Owner approve a department's
 * completed status. Requires the dept-row status to be "completed".
 * Triggers a scene auto-readiness recompute.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string; sceneId: string; deptId: string }> }
) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, sceneId, deptId } = await ctx.params;
  const access = await userHasProjectAccess(guard.userId, id);
  if (!access) return notFound("Project not found.");

  const allowed = await canApproveSceneDepartment({
    userId: guard.userId,
    projectId: id,
  });
  if (!allowed) {
    return forbidden(
      "Only Director / AD / Producer / EP / Owner can approve a dept."
    );
  }

  const row = await prisma.sceneDepartment.findUnique({
    where: { sceneId_departmentId: { sceneId, departmentId: deptId } },
    include: {
      scene: { select: { projectId: true } },
      department: { select: { name: true } },
    },
  });
  if (!row || row.scene.projectId !== id) {
    return notFound("Scene-department row not found.");
  }
  if (!row.enabled) {
    return badRequest("This department isn't enabled for the scene.");
  }
  if (row.status !== "completed") {
    return badRequest(
      "The department must mark its work Completed before approval."
    );
  }
  if (row.approvalStatus === "approved") {
    return badRequest("Already approved.");
  }

  try {
    await prisma.sceneDepartment.update({
      where: { sceneId_departmentId: { sceneId, departmentId: deptId } },
      data: {
        approvalStatus: "approved",
        approvedByUserId: guard.userId,
        approvedAt: new Date(),
      },
    });

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "scene_department_approved",
      message: `approved ${row.department.name} for the scene.`,
      metadata: { sceneId, departmentId: deptId },
    });

    // V0.17 — auto-readiness recompute.
    await recomputeSceneReadiness(sceneId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[scene.dept.approve]", err);
    return serverError("Failed to approve.");
  }
}
