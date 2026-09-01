import "server-only";
import { prisma } from "@/lib/prisma";
import { projectAccessFilter } from "@/lib/access";
import { decorateProjectsWithStats } from "@/lib/project-stats";
import type { ProjectStats } from "@/lib/project-stats";

/**
 * Dashboard reader.
 *
 * Extracted from the monolithic `lib/server-data.ts` (Phase 4 split).
 * One function; keeps its own DTO shape so callers get a stable
 * home-page contract regardless of future schema drift.
 */

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
  now: Date = new Date(),
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

  const decoratedProjects = decorateProjectsWithStats(activeProjects, now).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    role: p.role,
    memberRole: p.members[0]?.role ?? p.role,
    startDate: p.startDate.toISOString(),
    endDate: p.endDate.toISOString(),
    status: p.status,
    stats: p.stats,
  }));

  const overdueTasks = allOpenTasks
    .filter((t) => t.dueDate !== null && t.dueDate.getTime() < now.getTime())
    .slice(0, 8);

  const upcomingTasks = allOpenTasks
    .filter(
      (t) =>
        t.dueDate !== null &&
        t.dueDate.getTime() >= now.getTime() &&
        t.dueDate.getTime() <= twoWeeksFromNow.getTime(),
    )
    .slice(0, 8);

  const dueThisWeek = allOpenTasks.filter(
    (t) =>
      t.dueDate !== null &&
      t.dueDate.getTime() >= now.getTime() &&
      t.dueDate.getTime() <= oneWeekFromNow.getTime(),
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
