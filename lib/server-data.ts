import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { decorateProjectsWithStats, computeProjectStats } from "@/lib/project-stats";
import type { ProjectStats } from "@/lib/project-stats";
import { projectAccessFilter } from "@/lib/access";
import { taskVisibilityFilter, getMyDepartmentIds } from "@/lib/permissions";
import {
  deptFilterToPrismaWhere,
  type DeptFilter,
} from "@/lib/department-filter";
import {
  getDepartmentByHeadRole,
  resolveHeadRoleFromPresent,
} from "@/lib/department-registry";

/**
 * Direct DB readers used by server components. We deliberately bypass the HTTP
 * API for first-page renders (same process, same data, no serialization cost)
 * while keeping the same shape as what the API returns.
 *
 * V0.2: every read goes through `projectAccessFilter(userId)` so members see
 * the same data as owners.
 */

export async function getProjectsForUser(userId: string, statusFilter?: string) {
  const accessFilter = projectAccessFilter(userId);
  const where = statusFilter
    ? { AND: [accessFilter, { status: statusFilter }] }
    : accessFilter;

  const rows = await prisma.project.findMany({
    where,
    orderBy: [{ status: "asc" }, { endDate: "asc" }],
    include: {
      tasks: { select: { status: true, dueDate: true } },
      // V0.4: pull the caller's ProjectMember row so every project DTO
      // surfaces `memberRole` — the displayed role for the current viewer.
      members: { where: { userId }, select: { role: true } },
    },
  });

  return decorateProjectsWithStats(rows).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    role: p.role,
    memberRole: p.members[0]?.role ?? p.role,
    startDate: p.startDate.toISOString(),
    endDate: p.endDate.toISOString(),
    status: p.status,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    stats: p.stats,
  }));
}

export interface ProjectDetail {
  id: string;
  name: string;
  description: string | null;
  /** Legacy: the project's headline role (Project.role, owner's original). */
  role: string;
  /** V0.4: the displayed role for the current viewer (ProjectMember.role). */
  memberRole: string;
  startDate: string;
  endDate: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  stats: ProjectStats;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    completedAt: string | null;
  }>;
  activities: Array<{
    id: string;
    type: string;
    message: string;
    createdAt: string;
    actorId: string | null;
    actorName: string | null;
  }>;
}

/**
 * Memoized per-request via React's cache() — Phase 3A's project layout and the
 * tab pages both call this within a single render. cache() ensures one DB hit
 * per (userId, projectId) per request.
 */
export const getProjectForUser = cache(_getProjectForUser);

async function _getProjectForUser(
  userId: string,
  projectId: string
): Promise<ProjectDetail | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...projectAccessFilter(userId) },
    include: {
      tasks: {
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          completedAt: true,
        },
        orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 15,
      },
      members: { where: { userId }, select: { role: true } },
    },
  });

  if (!project) return null;

  const stats = computeProjectStats({
    startDate: project.startDate,
    endDate: project.endDate,
    tasks: project.tasks.map((t) => ({ status: t.status, dueDate: t.dueDate })),
  });

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    role: project.role,
    memberRole: project.members[0]?.role ?? project.role,
    startDate: project.startDate.toISOString(),
    endDate: project.endDate.toISOString(),
    status: project.status,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    stats,
    tasks: project.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate?.toISOString() ?? null,
      completedAt: t.completedAt?.toISOString() ?? null,
    })),
    activities: project.activities.map((a) => ({
      id: a.id,
      type: a.type,
      message: a.message,
      createdAt: a.createdAt.toISOString(),
      actorId: a.actorId,
      actorName: a.actorName,
    })),
  };
}

export interface DashboardData {
  quickStats: {
    activeProjects: number;
    openTasks: number;
    overdueTasks: number;
    dueThisWeek: number;
    completedThisWeek: number;
  };
  activeProjects: Array<{
    id: string;
    name: string;
    description: string | null;
    role: string;
    memberRole: string;
    startDate: string;
    endDate: string;
    status: string;
    stats: ProjectStats;
  }>;
  overdueTasks: Array<{
    id: string;
    title: string;
    priority: string;
    status: string;
    dueDate: string | null;
    project: { id: string; name: string };
  }>;
  upcomingTasks: Array<{
    id: string;
    title: string;
    priority: string;
    status: string;
    dueDate: string | null;
    project: { id: string; name: string };
  }>;
  recentActivity: Array<{
    id: string;
    type: string;
    message: string;
    createdAt: string;
    actorId: string | null;
    actorName: string | null;
    project: { id: string; name: string };
  }>;
}

export async function getDashboardForUser(
  userId: string,
  now: Date = new Date()
): Promise<DashboardData> {
  const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const accessFilter = projectAccessFilter(userId);
  const activeAccessFilter = {
    AND: [accessFilter, { status: "active" }],
  };

  const [activeProjects, allOpenTasks, completedThisWeek, recentActivity] =
    await Promise.all([
      prisma.project.findMany({
        where: activeAccessFilter,
        orderBy: { endDate: "asc" },
        include: {
          tasks: { select: { status: true, dueDate: true } },
          members: { where: { userId }, select: { role: true } },
        },
      }),
      prisma.task.findMany({
        where: {
          project: activeAccessFilter,
          status: { not: "done" },
        },
        include: { project: { select: { id: true, name: true } } },
        orderBy: { dueDate: "asc" },
      }),
      prisma.task.count({
        where: {
          project: accessFilter,
          status: "done",
          completedAt: { gte: oneWeekAgo },
        },
      }),
      prisma.activity.findMany({
        where: { project: accessFilter },
        orderBy: { createdAt: "desc" },
        take: 12,
        include: { project: { select: { id: true, name: true } } },
      }),
    ]);

  const decoratedProjects = decorateProjectsWithStats(activeProjects, now).map(
    (p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      role: p.role,
      memberRole: p.members[0]?.role ?? p.role,
      startDate: p.startDate.toISOString(),
      endDate: p.endDate.toISOString(),
      status: p.status,
      stats: p.stats,
    })
  );

  const overdueTasks = allOpenTasks
    .filter((t) => t.dueDate !== null && t.dueDate.getTime() < now.getTime())
    .slice(0, 8);

  const upcomingTasks = allOpenTasks
    .filter(
      (t) =>
        t.dueDate !== null &&
        t.dueDate.getTime() >= now.getTime() &&
        t.dueDate.getTime() <= twoWeeksFromNow.getTime()
    )
    .slice(0, 8);

  const dueThisWeek = allOpenTasks.filter(
    (t) =>
      t.dueDate !== null &&
      t.dueDate.getTime() >= now.getTime() &&
      t.dueDate.getTime() <= oneWeekFromNow.getTime()
  ).length;

  return {
    quickStats: {
      activeProjects: activeProjects.length,
      openTasks: allOpenTasks.length,
      overdueTasks: overdueTasks.length,
      dueThisWeek,
      completedThisWeek,
    },
    activeProjects: decoratedProjects,
    overdueTasks: overdueTasks.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      status: t.status,
      dueDate: t.dueDate?.toISOString() ?? null,
      project: { id: t.project.id, name: t.project.name },
    })),
    upcomingTasks: upcomingTasks.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      status: t.status,
      dueDate: t.dueDate?.toISOString() ?? null,
      project: { id: t.project.id, name: t.project.name },
    })),
    recentActivity: recentActivity.map((a) => ({
      id: a.id,
      type: a.type,
      message: a.message,
      createdAt: a.createdAt.toISOString(),
      actorId: a.actorId,
      actorName: a.actorName,
      project: { id: a.project.id, name: a.project.name },
    })),
  };
}

// ─── Tasks ───────────────────────────────────────────────────────────────

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
  filters: TaskFilters = {}
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
      const deptWhere = deptFilterToPrismaWhere(
        filters.departmentFilter,
        myDeptIds
      );
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
  const { canEditTask } = await import("@/lib/permissions");
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
    })
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
        ownerDepartment: r.department
          ? { kind: r.department.kind }
          : null,
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

/**
 * Distinct projects available as filter options. Used by the global Tasks
 * page filter row.
 */
/**
 * V0.6 — return the project's department list along with the caller's
 * own department IDs. Used to seed the DepartmentFilter chip.
 */
export async function getProjectDepartmentFilterContext(
  userId: string,
  projectId: string
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

export async function getProjectChoicesForUser(
  userId: string
): Promise<Array<{ id: string; name: string; role: string; memberRole: string }>> {
  const rows = await prisma.project.findMany({
    where: { AND: [projectAccessFilter(userId), { status: "active" }] },
    orderBy: { endDate: "asc" },
    select: {
      id: true,
      name: true,
      role: true,
      userId: true,
      members: {
        where: { userId },
        select: { role: true },
      },
    },
  });
  // V0.3: surface the caller's project-membership role so the sidebar
  // (department highlight) and other shell-level UI render the right
  // workspace for the current user instead of the project's headline role.
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    memberRole: p.members[0]?.role ?? p.role,
  }));
}

// ─── Activity ────────────────────────────────────────────────────────────

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
  departmentFilter?: DeptFilter
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
          : []
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

// ─── Calendar ────────────────────────────────────────────────────────────

export interface CalendarEventSummary {
  kind: "task_due" | "project_start" | "project_end";
  date: string;
  title: string;
  detail: string;
  project: { id: string; name: string };
  /** For tasks. */
  taskId?: string;
  status?: string;
  priority?: string;
}

export async function getCalendarEventsForUser(
  userId: string,
  rangeStart: Date,
  rangeEnd: Date,
  projectId?: string,
  departmentFilter?: DeptFilter
): Promise<CalendarEventSummary[]> {
  const accessFilter = projectAccessFilter(userId);
  const projectWhere = projectId
    ? { AND: [accessFilter, { id: projectId }] }
    : accessFilter;

  // V0.6 — department filter on task events.
  let taskDeptWhere: object | undefined;
  if (departmentFilter && projectId) {
    const myDeptIds = await getMyDepartmentIds(userId, projectId);
    taskDeptWhere = deptFilterToPrismaWhere(departmentFilter, myDeptIds);
  }

  const [projects, tasks] = await Promise.all([
    prisma.project.findMany({
      where: projectWhere,
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
      },
    }),
    prisma.task.findMany({
      where: {
        project: projectWhere,
        dueDate: { gte: rangeStart, lte: rangeEnd },
        ...(taskDeptWhere ?? {}),
      },
      include: { project: { select: { id: true, name: true } } },
    }),
  ]);

  const events: CalendarEventSummary[] = [];

  for (const p of projects) {
    if (p.startDate >= rangeStart && p.startDate <= rangeEnd) {
      events.push({
        kind: "project_start",
        date: p.startDate.toISOString(),
        title: `${p.name} starts`,
        detail: "Project begins",
        project: { id: p.id, name: p.name },
      });
    }
    if (p.endDate >= rangeStart && p.endDate <= rangeEnd) {
      events.push({
        kind: "project_end",
        date: p.endDate.toISOString(),
        title: `${p.name} wraps`,
        detail: "Project ends",
        project: { id: p.id, name: p.name },
      });
    }
  }

  for (const t of tasks) {
    if (!t.dueDate) continue;
    events.push({
      kind: "task_due",
      date: t.dueDate.toISOString(),
      title: t.title,
      detail: t.project.name,
      project: { id: t.project.id, name: t.project.name },
      taskId: t.id,
      status: t.status,
      priority: t.priority,
    });
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}
