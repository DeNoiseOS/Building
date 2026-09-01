import "server-only";
import { prisma } from "@/lib/prisma";
import { projectAccessFilter } from "@/lib/access";
import { canEditTask, getMyDepartmentIds, taskVisibilityFilter } from "@/lib/permissions";
import { deptFilterToPrismaWhere, type DeptFilter } from "@/lib/department-filter";

/**
 * Task readers.
 *
 * Extracted from the monolithic `lib/server-data.ts` (Phase 4 split).
 * Owns the shape of the Task list DTOs and the per-row edit
 * authority annotation used by the UI.
 */

export interface TaskSummary {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  section: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assigneeId: string | null;
  assignee: { id: string; name: string } | null;
  project: { id: string; name: string; role: string };
  /** V0.6 — caller's edit authority on this task. View is always allowed. */
  canEdit: boolean;
  /** V0.6 — owner department id for filter/badge logic. */
  departmentId: string | null;
}

export interface TaskFilters {
  projectId?: string;
  status?: string[];
  section?: string;
  assigneeId?: string;
  /** "me" maps server-side to the requesting user's id */
  mineOnly?: boolean;
  /** V0.6 — optional department filter (URL-driven). */
  departmentFilter?: DeptFilter;
}

/**
 * Returns every task in the user's projects, filtered as requested. Tasks are
 * ordered with done at the bottom and then by due date ascending — the natural
 * "what needs my attention" order.
 */
export async function getTasksForUser(
  userId: string,
  filters: TaskFilters = {},
): Promise<TaskSummary[]> {
  // V0.5 — visibility is applied per-project. When the user is browsing
  // global tasks (no projectId filter), we apply the visibility filter
  // for each of their accessible projects via UNION, but a simpler and
  // sufficient approach is: when projectId is provided, apply the
  // hierarchy-aware visibility. When not, fall back to "tasks the user
  // can reach via creator/assignee/department/project-wide role".
  const baseWhere: Record<string, unknown> = {
    project: projectAccessFilter(userId),
  };
  if (filters.projectId) baseWhere.projectId = filters.projectId;
  if (filters.status && filters.status.length > 0)
    baseWhere.status = { in: filters.status };
  if (filters.section) baseWhere.section = filters.section;
  if (filters.mineOnly) baseWhere.assigneeId = userId;
  else if (filters.assigneeId) baseWhere.assigneeId = filters.assigneeId;

  // V0.6 — visibility is no longer hierarchy-narrowed: any project member
  // sees all tasks on that project. The taskVisibilityFilter call is kept
  // because it also gates non-members defensively.
  if (filters.projectId) {
    const vis = await taskVisibilityFilter({
      userId,
      projectId: filters.projectId,
    });
    if (vis) Object.assign(baseWhere, vis);

    // V0.6 — apply department filter (URL ?dept= chip) when present.
    if (filters.departmentFilter) {
      const myDeptIds = await getMyDepartmentIds(userId, filters.projectId);
      const deptWhere = deptFilterToPrismaWhere(filters.departmentFilter, myDeptIds);
      if (deptWhere) Object.assign(baseWhere, deptWhere);
    }
  } else {
    // Global view: union of "tasks I created or am assigned to" PLUS
    // "tasks in projects where I'm a producer/director/owner".
    baseWhere.OR = [
      { creatorId: userId },
      { assigneeId: userId },
      {
        project: {
          OR: [
            { userId },
            {
              members: {
                some: {
                  userId,
                  role: { in: ["producer", "director"] },
                },
              },
            },
          ],
        },
      },
      {
        department: {
          members: { some: { userId } },
        },
      },
      {
        assignee: {
          is: {
            departmentMemberships: {
              some: {
                department: {
                  members: { some: { userId } },
                },
              },
            },
          },
        },
      },
    ];
  }

  const rows = await prisma.task.findMany({
    where: baseWhere,
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    include: {
      project: { select: { id: true, name: true, role: true, userId: true } },
      assignee: { select: { id: true, name: true } },
      department: { select: { id: true, kind: true } },
    },
  });

  // V0.6 — compute per-row edit authority. We resolve the caller's
  // memberRole + departmentIds per project once, then check inline.
  const projectIds = Array.from(new Set(rows.map((r) => r.projectId)));
  const contextCache = new Map<
    string,
    {
      isOwner: boolean;
      memberRole: string | null;
      departmentIds: string[];
    }
  >();
  await Promise.all(
    projectIds.map(async (pid) => {
      const [mem, owner, deptRows] = await Promise.all([
        prisma.projectMember.findFirst({
          where: { projectId: pid, userId },
          select: { role: true },
        }),
        prisma.project.findFirst({
          where: { id: pid, userId },
          select: { id: true },
        }),
        prisma.departmentMember.findMany({
          where: { userId, department: { projectId: pid } },
          select: { departmentId: true },
        }),
      ]);
      contextCache.set(pid, {
        memberRole: mem?.role ?? null,
        isOwner: !!owner,
        departmentIds: deptRows.map((r) => r.departmentId),
      });
    }),
  );

  const decorated: TaskSummary[] = [];
  for (const r of rows) {
    const ctx = contextCache.get(r.projectId);
    let canEdit = false;
    if (ctx) {
      const c = {
        userId,
        projectId: r.projectId,
        memberRole: ctx.memberRole ?? undefined,
        isOwner: ctx.isOwner,
        departmentIds: ctx.departmentIds,
      };
      canEdit = await canEditTask(c, {
        id: r.id,
        projectId: r.projectId,
        departmentId: r.departmentId,
        creatorId: r.creatorId,
        assigneeId: r.assigneeId,
        approverId: r.approverId,
        ownerDepartment: r.department ? { kind: r.department.kind } : null,
      });
    }
    decorated.push({
      ...serializeTask(r),
      canEdit,
      departmentId: r.departmentId,
    });
  }
  return decorated;
}

function serializeTask(t: {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  section: string | null;
  dueDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  assigneeId: string | null;
  assignee: { id: string; name: string } | null;
  project: { id: string; name: string; role: string };
  departmentId?: string | null;
}): TaskSummary {
  return {
    id: t.id,
    projectId: t.projectId,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    section: t.section,
    dueDate: t.dueDate?.toISOString() ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    assigneeId: t.assigneeId,
    assignee: t.assignee,
    project: t.project,
    // V0.6 — defaults; the list reader overrides per-row.
    canEdit: true,
    departmentId: t.departmentId ?? null,
  };
}
