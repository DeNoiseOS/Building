import "server-only";
import { prisma } from "@/lib/prisma";
import type { TimelineConfig } from "@/lib/widgets/schema";
import { dateWindowToRange, resolveProjectIds } from "./common";

export interface TimelineEntry {
  key: string;
  kind: "task" | "scene";
  when: Date;
  title: string;
  href: string;
  projectId: string;
  projectName: string;
  meta?: string;
}

export interface TimelineResult {
  entries: TimelineEntry[];
}

/**
 * V0.28 — Timeline resolver.
 *
 * Draws from `tasks` (with dueDate) and `scenes` (currently `status =
 * "scheduled"`; when the ShootDay model lands this file is the only
 * one that needs to switch source). Both sources are bounded by the
 * user's project access.
 */
export async function resolveTimeline(
  userId: string,
  config: TimelineConfig,
  limit = 30
): Promise<TimelineResult> {
  const projectIds = await resolveProjectIds(userId, config.scope);
  if (projectIds.length === 0) return { entries: [] };

  const range = dateWindowToRange(config.dateRange);
  const dueRange =
    range && range !== "no_due" ? { dueDate: range } : {};

  const entries: TimelineEntry[] = [];

  if (config.sources.includes("tasks")) {
    const tasks = await prisma.task.findMany({
      where: {
        projectId: { in: projectIds },
        status: { not: "done" },
        ...dueRange,
      },
      orderBy: { dueDate: "asc" },
      take: limit,
      select: {
        id: true,
        title: true,
        dueDate: true,
        project: { select: { id: true, name: true } },
      },
    });
    for (const t of tasks) {
      if (!t.dueDate) continue;
      entries.push({
        key: `task-${t.id}`,
        kind: "task",
        when: t.dueDate,
        title: t.title,
        href: `/projects/${t.project.id}/tasks`,
        projectId: t.project.id,
        projectName: t.project.name,
      });
    }
  }

  if (config.sources.includes("scenes")) {
    // V0.29 — Scenes with a ShootDay now surface at their real shoot
    // date. Scenes still marked `status="scheduled"` without a
    // shootDay fall back to today so old data is not silently lost.
    const scenes = await prisma.scene.findMany({
      where: {
        projectId: { in: projectIds },
        OR: [{ shootDayId: { not: null } }, { status: "scheduled" }],
      },
      orderBy: [{ shootDay: { date: "asc" } }, { updatedAt: "desc" }],
      take: limit,
      select: {
        id: true,
        number: true,
        title: true,
        location: true,
        status: true,
        shootDay: { select: { date: true } },
        project: { select: { id: true, name: true } },
      },
    });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const s of scenes) {
      const when = s.shootDay?.date ?? today;
      // Apply date-range filter to shootDay-anchored scenes too
      if (range && range !== "no_due" && s.shootDay) {
        const t = when.getTime();
        if (range.gte && t < range.gte.getTime()) continue;
        if (range.lt && t >= range.lt.getTime()) continue;
      }
      entries.push({
        key: `scene-${s.id}`,
        kind: "scene",
        when,
        title: `Sc. ${s.number} — ${s.title}`,
        href: `/projects/${s.project.id}/scenes`,
        projectId: s.project.id,
        projectName: s.project.name,
        meta: s.location ?? undefined,
      });
    }
  }

  entries.sort((a, b) => a.when.getTime() - b.when.getTime());
  return { entries };
}
