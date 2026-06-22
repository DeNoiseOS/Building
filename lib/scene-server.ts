import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * V0.17 — Server-only scene helpers.
 *
 * Auto-readiness recompute. After ANY scene-department change (toggle,
 * status, approval), call this to recompute the scene's status:
 * promotes draft/planning → ready when every enabled dept is
 * approvalStatus=approved. Does NOT downgrade past "ready" (scheduling /
 * shot / completed are editorial states).
 */
export async function recomputeSceneReadiness(
  sceneId: string
): Promise<void> {
  const scene = await prisma.scene.findUnique({
    where: { id: sceneId },
    select: { id: true, status: true },
  });
  if (!scene) return;
  if (scene.status !== "draft" && scene.status !== "planning") return;

  const enabled = await prisma.sceneDepartment.findMany({
    where: { sceneId, enabled: true },
    select: { approvalStatus: true },
  });
  if (enabled.length === 0) return;
  const allApproved = enabled.every((d) => d.approvalStatus === "approved");
  if (allApproved) {
    await prisma.scene.update({
      where: { id: sceneId },
      data: { status: "ready" },
    });
  }
}
