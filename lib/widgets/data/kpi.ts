import "server-only";
import { prisma } from "@/lib/prisma";
import type { KpiConfig } from "@/lib/widgets/schema";
import { resolveProjectIds, resolveProjectScope } from "./common";

export interface KpiResult {
  value: number | null;
  unit: "count" | "percent";
  label: string;
  hint?: string;
}

/**
 * V0.28 — KPI resolver.
 *
 * Every metric is computed against the intersection of the widget's
 * scope and the caller's access filter. Never queries beyond what the
 * user is authorised to see.
 */
export async function resolveKpi(
  userId: string,
  config: KpiConfig
): Promise<KpiResult> {
  const projectIds = await resolveProjectIds(userId, config.scope);

  // Nothing accessible under this scope — return a zero we can render
  // without further work.
  if (projectIds.length === 0 && config.metric !== "pending_approvals") {
    return { value: 0, unit: unitFor(config.metric), label: labelFor(config.metric) };
  }

  const projectFilter = { projectId: { in: projectIds } };

  switch (config.metric) {
    case "open_tasks": {
      const value = await prisma.task.count({
        where: { ...projectFilter, status: { not: "done" } },
      });
      return { value, unit: "count", label: "Open Tasks" };
    }
    case "overdue_tasks": {
      const value = await prisma.task.count({
        where: {
          ...projectFilter,
          status: { not: "done" },
          dueDate: { lt: startOfToday() },
        },
      });
      return { value, unit: "count", label: "Overdue", hint: value > 0 ? "Needs attention" : undefined };
    }
    case "completed_tasks": {
      const value = await prisma.task.count({
        where: { ...projectFilter, status: "done" },
      });
      return { value, unit: "count", label: "Completed" };
    }
    case "projects_active": {
      const value = await prisma.project.count({
        where: {
          AND: [await resolveProjectScope(userId, config.scope), { status: "active" }],
        },
      });
      return { value, unit: "count", label: "Active Projects" };
    }
    case "budget_used_pct": {
      const budgets = await prisma.departmentBudget.findMany({
        where: projectFilter,
        select: { approvedAmount: true },
      });
      const purchases = await prisma.budgetRequest.findMany({
        where: { ...projectFilter, status: "purchased" },
        select: { estimatedCost: true },
      });
      const approved = budgets.reduce((s, b) => s + (b.approvedAmount ?? 0), 0);
      const spent = purchases.reduce((s, r) => s + r.estimatedCost, 0);
      const value =
        approved > 0 ? Math.min(100, Math.round((spent / approved) * 100)) : null;
      return {
        value,
        unit: "percent",
        label: "Budget Used",
        hint: value === null ? "No budgets set" : "Across scoped projects",
      };
    }
    case "pending_approvals": {
      // Approvals belong to departments the user leads or to projects
      // where the user is a producer/owner. We compute both counts
      // using resolveProjectScope-derived project IDs as an outer
      // bound.
      const [expenses, revisions] = await Promise.all([
        prisma.budgetRequest.count({
          where: {
            projectId: { in: projectIds },
            status: { in: ["submitted", "pending_department_approval"] },
            department: { members: { some: { userId, role: "lead" } } },
          },
        }),
        prisma.departmentBudget.count({
          where: {
            projectId: { in: projectIds },
            status: "revision_requested",
            project: {
              OR: [
                { userId },
                { members: { some: { userId, role: "producer" } } },
              ],
            },
          },
        }),
      ]);
      const value = expenses + revisions;
      return {
        value,
        unit: "count",
        label: "Pending Approvals",
        hint: value > 0 ? "Expenses & revisions" : "Nothing awaiting you",
      };
    }
    case "expenses_count": {
      const value = await prisma.purchase.count({ where: projectFilter });
      return { value, unit: "count", label: "Expenses" };
    }
    case "scenes_count": {
      const value = await prisma.scene.count({ where: projectFilter });
      return { value, unit: "count", label: "Scenes" };
    }
    case "activity_count": {
      const seven = new Date();
      seven.setDate(seven.getDate() - 7);
      const value = await prisma.activity.count({
        where: { ...projectFilter, createdAt: { gte: seven } },
      });
      return { value, unit: "count", label: "Activity (7d)" };
    }
  }
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function unitFor(metric: KpiConfig["metric"]): "count" | "percent" {
  return metric === "budget_used_pct" ? "percent" : "count";
}

function labelFor(metric: KpiConfig["metric"]): string {
  const map: Record<KpiConfig["metric"], string> = {
    open_tasks: "Open Tasks",
    overdue_tasks: "Overdue",
    completed_tasks: "Completed",
    projects_active: "Active Projects",
    budget_used_pct: "Budget Used",
    pending_approvals: "Pending Approvals",
    expenses_count: "Expenses",
    scenes_count: "Scenes",
    activity_count: "Activity (7d)",
  };
  return map[metric];
}
