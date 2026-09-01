import "server-only";
import { prisma } from "@/lib/prisma";
import {
  getDepartmentByHeadRole,
  resolveHeadRoleFromPresent,
} from "@/lib/department-registry";
import { getMyDepartmentIds } from "@/lib/permissions";

/**
 * URL-driven filter contexts.
 *
 * Extracted from the monolithic `lib/server-data.ts` (Phase 4 split).
 * Currently one function; will grow as more per-page filter contexts
 * land (per-scene, per-department, etc.).
 */

/**
 * V0.6 — return the project's department list along with the caller's
 * own department IDs. Used to seed the DepartmentFilter chip.
 */
export async function getProjectDepartmentFilterContext(
  userId: string,
  projectId: string,
): Promise<{
  departments: Array<{ id: string; name: string }>;
  myDepartmentIds: string[];
}> {
  const [depts, mine, mem, allMembers] = await Promise.all([
    prisma.department.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, kind: true },
    }),
    getMyDepartmentIds(userId, projectId),
    prisma.projectMember.findFirst({
      where: { projectId, userId },
      select: { role: true },
    }),
    prisma.projectMember.findMany({
      where: { projectId },
      select: { role: true },
    }),
  ]);

  // V0.12.3 — also count the depts I'm the *resolved* head of (V0.11
  // priority list). A Production Designer with no explicit
  // DepartmentMember row still counts as "in" the Art department.
  const merged = new Set(mine);
  if (mem?.role) {
    const presentRoles = allMembers.map((m) => m.role);
    for (const d of depts) {
      const reg = getDepartmentByHeadRole(d.kind);
      if (!reg) continue;
      const resolved = resolveHeadRoleFromPresent(reg.key, presentRoles);
      if (resolved === mem.role) merged.add(d.id);
    }
  }

  return {
    departments: depts.map((d) => ({ id: d.id, name: d.name })),
    myDepartmentIds: Array.from(merged),
  };
}
