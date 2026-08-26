import "server-only";
import { prisma } from "@/lib/prisma";
import type { TasksConfig, DateWindow, AssigneeScope } from "@/lib/widgets/schema";
import { dateWindowToRange, resolveProjectIds } from "./common";

export interface ResolvedTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  updatedAt: Date;
  createdAt: Date;
  project: { id: string; name: string };
  assignee: { id: string; name: string } | null;
}

export interface TasksResult {
  tasks: ResolvedTask[];
  totalCount: number;
  overdueCount: number;
  todayCount: number;
}

/**
 * V0.28 — Tasks resolver.
 *
 * All filters are applied server-side. Projects are always bounded by
 * the user's access filter via resolveProjectIds().
 */
export async function resolveTasks(
  userId: string,
  config: TasksConfig,
  limit = 100
): Promise<TasksResult> {
  const projectIds = await resolveProjectIds(userId, config.scope);
  if (projectIds.length === 0) {
    return { tasks: [], totalCount: 0, overdueCount: 0, todayCount: 0 };
  }

  const where: Record<string, unknown> = {
    projectId: { in: projectIds },
    status: { in: config.statuses },
    priority: { in: config.priorities },
    ...assigneeWhere(userId, config.assignee),
    ...dateWindowsWhere(config.dateWindows),
  };

  const orderBy = orderByFor(config.sortBy);

  const [tasks, totalCount, overdueCount, todayCount] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy,
      take: limit,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        updatedAt: true,
        createdAt: true,
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
    }),
    prisma.task.count({ where }),
    prisma.task.count({
      where: {
        ...where,
        status: { not: "done" },
        dueDate: { lt: startOfToday() },
      },
    }),
    prisma.task.count({
      where: {
        ...where,
        status: { not: "done" },
        dueDate: { gte: startOfToday(), lt: endOfToday() },
      },
    }),
  ]);

  return { tasks, totalCount, overdueCount, todayCount };
}

// ── helpers ─────────────────────────────────────────────────────────

function assigneeWhere(
  userId: string,
  scope: AssigneeScope
): Record<string, unknown> {
  switch (scope.kind) {
    case "me":
      return { assigneeId: userId };
    case "unassigned":
      return { assigneeId: null };
    case "everyone":
      return {};
    case "specific":
      return { assigneeId: { in: scope.userIds } };
  }
}

function dateWindowsWhere(
  windows: DateWindow[]
): Record<string, unknown> {
  if (windows.length === 0) return {};
  const now = new Date();
  const ranges: object[] = [];
  let allowNoDue = false;
  for (const w of windows) {
    const r = dateWindowToRange(w, now);
    if (r === "no_due") allowNoDue = true;
    else if (r !== null) ranges.push({ dueDate: r });
  }
  const or: object[] = [...ranges];
  if (allowNoDue) or.push({ dueDate: null });
  if (or.length === 0) return {};
  if (or.length === 1) return or[0] as Record<string, unknown>;
  return { OR: or };
}

function orderByFor(sortBy: TasksConfig["sortBy"]) {
  switch (sortBy) {
    case "due":
      return [{ dueDate: "asc" as const }, { priority: "desc" as const }];
    case "priority":
      return [{ priority: "desc" as const }, { dueDate: "asc" as const }];
    case "updated":
      return { updatedAt: "desc" as const };
    case "created":
      return { createdAt: "desc" as const };
    case "project":
      return { projectId: "asc" as const };
  }
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfToday(): Date {
  const d = startOfToday();
  d.setDate(d.getDate() + 1);
  return d;
}
