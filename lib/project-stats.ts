import { prisma } from "@/lib/prisma";

export type ProjectHealth = "healthy" | "watch" | "at_risk";

export interface ProjectStats {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  progressPercent: number;
  expectedProgress: number;
  health: ProjectHealth;
  healthMessage: string;
}

interface ProjectStatsInput {
  startDate: Date;
  endDate: Date;
  tasks: Array<{
    status: string;
    dueDate: Date | null;
  }>;
  now?: Date;
}

/**
 * Pure stats calculation. Given a project's date range and its tasks, returns
 * progress + health. Pulled out so the API and any unit tests can call it
 * directly without DB access.
 */
export function computeProjectStats({
  startDate,
  endDate,
  tasks,
  now = new Date(),
}: ProjectStatsInput): ProjectStats {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "done").length;
  const pendingTasks = totalTasks - completedTasks;
  const overdueTasks = tasks.filter(
    (t) =>
      t.status !== "done" &&
      t.dueDate !== null &&
      t.dueDate.getTime() < now.getTime()
  ).length;

  const progressPercent =
    totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  const total = endDate.getTime() - startDate.getTime();
  const elapsed = now.getTime() - startDate.getTime();
  const expectedProgress =
    total > 0
      ? Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)))
      : 0;

  const progressGap = expectedProgress - progressPercent;

  let health: ProjectHealth = "healthy";
  let healthMessage = "Project is on track.";

  if (overdueTasks > 2 || progressGap > 20) {
    health = "at_risk";
    healthMessage =
      overdueTasks > 2
        ? `${overdueTasks} tasks overdue. Progress significantly behind schedule.`
        : "Progress significantly behind schedule.";
  } else if (overdueTasks > 0 || progressGap > 10) {
    health = "watch";
    healthMessage =
      overdueTasks > 0
        ? `${overdueTasks} task${
            overdueTasks === 1 ? "" : "s"
          } overdue. Review pending work.`
        : "Progress slightly behind schedule.";
  } else if (totalTasks === 0) {
    healthMessage = "No tasks yet. Add tasks to start tracking progress.";
  }

  return {
    totalTasks,
    completedTasks,
    pendingTasks,
    overdueTasks,
    progressPercent,
    expectedProgress,
    health,
    healthMessage,
  };
}

export async function getProjectStats(
  projectId: string,
  now: Date = new Date()
): Promise<ProjectStats> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      startDate: true,
      endDate: true,
      tasks: { select: { status: true, dueDate: true } },
    },
  });

  if (!project) {
    return {
      totalTasks: 0,
      completedTasks: 0,
      pendingTasks: 0,
      overdueTasks: 0,
      progressPercent: 0,
      expectedProgress: 0,
      health: "healthy",
      healthMessage: "Project not found.",
    };
  }

  return computeProjectStats({
    startDate: project.startDate,
    endDate: project.endDate,
    tasks: project.tasks,
    now,
  });
}

/**
 * Same computation but operating on a list of projects already fetched with
 * their tasks. Used by the dashboard composed read so we don't make N+1
 * queries.
 */
export function decorateProjectsWithStats<
  T extends {
    startDate: Date;
    endDate: Date;
    tasks: Array<{ status: string; dueDate: Date | null }>;
  }
>(projects: T[], now: Date = new Date()): Array<T & { stats: ProjectStats }> {
  return projects.map((p) => ({
    ...p,
    stats: computeProjectStats({
      startDate: p.startDate,
      endDate: p.endDate,
      tasks: p.tasks,
      now,
    }),
  }));
}
