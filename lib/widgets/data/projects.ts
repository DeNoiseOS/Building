import "server-only";
import { prisma } from "@/lib/prisma";
import type { ProjectsConfig } from "@/lib/widgets/schema";
import { computeProjectStats, type ProjectHealth } from "@/lib/project-stats";
import { resolveProjectScope } from "./common";

export interface ResolvedProject {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  currency: string;
  memberRole: string;
  progressPercent: number;
  health: ProjectHealth;
  budgetApproved: number;
  budgetSpent: number;
  budgetUsedPct: number | null;
  openTasks: number;
  overdueTasks: number;
  departmentCount: number;
  teamCount: number;
}

export interface ProjectsResult {
  projects: ResolvedProject[];
}

/**
 * V0.28 — Projects / Project Pulse resolver.
 */
export async function resolveProjects(
  userId: string,
  config: ProjectsConfig,
  limit = 12,
): Promise<ProjectsResult> {
  const where = await resolveProjectScope(userId, config.scope);
  const rows = await prisma.project.findMany({
    where: { AND: [where, { status: "active" }] },
    orderBy: { endDate: "asc" },
    take: limit,
    include: {
      tasks: { select: { status: true, dueDate: true } },
      departments: { select: { id: true } },
      departmentBudgets: { select: { approvedAmount: true } },
      budgetRequests: {
        where: { status: "purchased" },
        select: { estimatedCost: true },
      },
      members: { where: { userId }, select: { role: true } },
      _count: { select: { members: true } },
    },
  });

  const now = new Date();

  const projects: ResolvedProject[] = rows.map((p) => {
    const stats = computeProjectStats({
      startDate: p.startDate,
      endDate: p.endDate,
      tasks: p.tasks,
      now,
    });
    const budgetApproved = p.departmentBudgets.reduce(
      (s, b) => s + (b.approvedAmount ?? 0),
      0,
    );
    const budgetSpent = p.budgetRequests.reduce((s, r) => s + r.estimatedCost, 0);
    const budgetUsedPct =
      budgetApproved > 0
        ? Math.min(100, Math.round((budgetSpent / budgetApproved) * 100))
        : null;
    const openTasks = p.tasks.filter((t) => t.status !== "done").length;
    const overdueTasks = p.tasks.filter(
      (t) => t.status !== "done" && t.dueDate && t.dueDate.getTime() < now.getTime(),
    ).length;
    return {
      id: p.id,
      name: p.name,
      startDate: p.startDate,
      endDate: p.endDate,
      currency: p.currency ?? "USD",
      memberRole: p.members[0]?.role ?? "",
      progressPercent: stats.progressPercent,
      health: stats.health,
      budgetApproved,
      budgetSpent,
      budgetUsedPct,
      openTasks,
      overdueTasks,
      departmentCount: p.departments.length,
      teamCount: p._count.members,
    };
  });

  const filtered = config.atRiskOnly
    ? projects.filter((p) => p.health !== "healthy")
    : projects;

  return { projects: filtered };
}
