import "server-only";
import { prisma } from "@/lib/prisma";
import type { CalendarConfig } from "@/lib/widgets/schema";
import { resolveProjectScope } from "./common";

export interface CalendarEvent {
  kind: "task_due" | "project_start" | "project_end" | "shoot_day";
  when: Date;
  title: string;
  detail: string;
  projectId: string;
  projectName: string;
  taskId?: string;
  status?: string;
  priority?: string;
}

export interface CalendarResult {
  events: CalendarEvent[];
  rangeStart: Date;
  rangeEnd: Date;
}

/**
 * V0.28 — Calendar resolver.
 *
 * View defines the visible range; access filter is applied via
 * resolveProjectScope so agency roles only see their permitted
 * projects/tasks.
 */
export async function resolveCalendar(
  userId: string,
  config: CalendarConfig,
  anchor: Date = new Date()
): Promise<CalendarResult> {
  const { rangeStart, rangeEnd } = viewRange(config.view, anchor);
  const projectWhere = await resolveProjectScope(userId, config.scope);

  const events: CalendarEvent[] = [];

  if (
    config.eventKinds.includes("project_start") ||
    config.eventKinds.includes("project_end")
  ) {
    const projects = await prisma.project.findMany({
      where: {
        AND: [
          projectWhere,
          {
            OR: [
              { startDate: { gte: rangeStart, lt: rangeEnd } },
              { endDate: { gte: rangeStart, lt: rangeEnd } },
            ],
          },
        ],
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
      },
    });
    for (const p of projects) {
      if (
        config.eventKinds.includes("project_start") &&
        p.startDate >= rangeStart &&
        p.startDate < rangeEnd
      ) {
        events.push({
          kind: "project_start",
          when: p.startDate,
          title: `${p.name} — start`,
          detail: "Project starts",
          projectId: p.id,
          projectName: p.name,
        });
      }
      if (
        config.eventKinds.includes("project_end") &&
        p.endDate >= rangeStart &&
        p.endDate < rangeEnd
      ) {
        events.push({
          kind: "project_end",
          when: p.endDate,
          title: `${p.name} — end`,
          detail: "Project ends",
          projectId: p.id,
          projectName: p.name,
        });
      }
    }
  }

  if (config.eventKinds.includes("shoot_day")) {
    const days = await prisma.shootDay.findMany({
      where: {
        project: projectWhere,
        date: { gte: rangeStart, lt: rangeEnd },
      },
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        label: true,
        generalCallTime: true,
        locationName: true,
        project: { select: { id: true, name: true } },
        _count: { select: { scenes: true } },
      },
    });
    for (const d of days) {
      events.push({
        kind: "shoot_day",
        when: d.date,
        title: d.label ?? `Shoot Day · ${d._count.scenes} scene${d._count.scenes === 1 ? "" : "s"}`,
        detail: d.generalCallTime
          ? `Call ${d.generalCallTime}${d.locationName ? " · " + d.locationName : ""}`
          : d.locationName ?? "",
        projectId: d.project.id,
        projectName: d.project.name,
      });
    }
  }

  if (config.eventKinds.includes("task_due")) {
    const tasks = await prisma.task.findMany({
      where: {
        project: projectWhere,
        dueDate: { gte: rangeStart, lt: rangeEnd },
      },
      orderBy: { dueDate: "asc" },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        project: { select: { id: true, name: true } },
      },
    });
    for (const t of tasks) {
      if (!t.dueDate) continue;
      events.push({
        kind: "task_due",
        when: t.dueDate,
        title: t.title,
        detail: t.status,
        projectId: t.project.id,
        projectName: t.project.name,
        taskId: t.id,
        status: t.status,
        priority: t.priority,
      });
    }
  }

  events.sort((a, b) => a.when.getTime() - b.when.getTime());
  return { events, rangeStart, rangeEnd };
}

function viewRange(
  view: CalendarConfig["view"],
  anchor: Date
): { rangeStart: Date; rangeEnd: Date } {
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);

  switch (view) {
    case "day":
      end.setDate(end.getDate() + 1);
      break;
    case "3day":
      end.setDate(end.getDate() + 3);
      break;
    case "agenda":
    case "week":
      end.setDate(end.getDate() + 7);
      break;
    case "month":
      end.setMonth(end.getMonth() + 1);
      break;
  }
  return { rangeStart: start, rangeEnd: end };
}
