import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api";
import { decorateProjectsWithStats } from "@/lib/project-stats";
import { projectAccessFilter } from "@/lib/access";

export async function GET() {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const now = new Date();
  const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  // Active projects with tasks for stats.
  const activeProjects = await prisma.project.findMany({
    where: { AND: [projectAccessFilter(guard.userId), { status: "active" }] },
    orderBy: { endDate: "asc" },
    include: {
      tasks: { select: { status: true, dueDate: true } },
    },
  });

  const decoratedProjects = decorateProjectsWithStats(activeProjects, now).map(
    (p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      role: p.role,
      startDate: p.startDate.toISOString(),
      endDate: p.endDate.toISOString(),
      status: p.status,
      stats: p.stats,
    })
  );

  // Cross-project task aggregates.
  const allOpenTasks = await prisma.task.findMany({
    where: {
      project: { AND: [projectAccessFilter(guard.userId), { status: "active" }] },
      status: { not: "done" },
    },
    include: {
      project: { select: { id: true, name: true } },
    },
    orderBy: { dueDate: "asc" },
  });

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

  // Completed tasks this week.
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const completedThisWeek = await prisma.task.count({
    where: {
      project: projectAccessFilter(guard.userId),
      status: "done",
      completedAt: { gte: oneWeekAgo },
    },
  });

  // Recent activity across all the user's projects.
  const recentActivity = await prisma.activity.findMany({
    where: { project: projectAccessFilter(guard.userId) },
    orderBy: { createdAt: "desc" },
    take: 12,
    include: {
      project: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({
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
      actorId: a.actorId,
      actorName: a.actorName,
      createdAt: a.createdAt.toISOString(),
      project: { id: a.project.id, name: a.project.name },
    })),
  });
}
