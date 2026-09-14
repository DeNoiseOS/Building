import "server-only";
import { prisma } from "@/lib/prisma";
import { projectAccessFilter } from "@/lib/access";
import { getMyDepartmentIds } from "@/lib/permissions";
import { deptFilterToPrismaWhere, type DeptFilter } from "@/lib/department-filter";

/**
 * Calendar reader.
 *
 * Extracted from the monolithic `lib/server-data.ts` (Phase 4 split).
 * Aggregates project boundaries + task due dates into one event
 * stream ordered by date.
 */

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
  departmentFilter?: DeptFilter,
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
