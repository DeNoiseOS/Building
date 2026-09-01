import "server-only";
import { prisma } from "@/lib/prisma";
import { projectAccessFilter } from "@/lib/access";
import { getMyDepartmentIds } from "@/lib/permissions";
import type { DeptFilter } from "@/lib/department-filter";

/**
 * Activity feed reader.
 *
 * Extracted from the monolithic `lib/server-data.ts` (Phase 4 split).
 */

export interface ActivitySummary {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  actorId: string | null;
  actorName: string | null;
  project: { id: string; name: string };
}

export async function getActivityForUser(
  userId: string,
  limit: number = 50,
  projectId?: string,
  departmentFilter?: DeptFilter,
): Promise<ActivitySummary[]> {
  const projectFilter: {
    AND: [ReturnType<typeof projectAccessFilter>, { id?: string }];
  } = {
    AND: [projectAccessFilter(userId), {}],
  };
  if (projectId) projectFilter.AND[1] = { id: projectId };

  // V0.6 — optional department filter via activity.metadata.departmentId.
  // Activity rows don't have a column FK to Department (the entity is
  // task/note/ref-agnostic). When a filter is requested, post-filter rows
  // by parsing metadata.
  const rows = await prisma.activity.findMany({
    where: { project: projectFilter },
    orderBy: { createdAt: "desc" },
    take: departmentFilter && projectId ? Math.max(limit * 4, 200) : limit,
    include: { project: { select: { id: true, name: true } } },
  });

  let filtered = rows;
  if (departmentFilter && projectId) {
    const myDeptIds = await getMyDepartmentIds(userId, projectId);
    const targetIds = new Set<string>(
      departmentFilter.mode === "mine"
        ? myDeptIds
        : departmentFilter.mode === "custom"
          ? departmentFilter.departmentIds
          : [],
    );
    if (departmentFilter.mode !== "all") {
      filtered = rows.filter((a) => {
        if (!a.metadata) return false;
        try {
          const m = JSON.parse(a.metadata) as { departmentId?: string };
          return m.departmentId ? targetIds.has(m.departmentId) : false;
        } catch {
          return false;
        }
      });
    }
    filtered = filtered.slice(0, limit);
  }

  return filtered.map((a) => ({
    id: a.id,
    type: a.type,
    message: a.message,
    createdAt: a.createdAt.toISOString(),
    actorId: a.actorId,
    actorName: a.actorName,
    project: { id: a.project.id, name: a.project.name },
  }));
}
