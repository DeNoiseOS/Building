import { StatCard } from "./stat-card";
import { formatCurrencyAmount } from "@/lib/currencies";
import type { ProjectAnalyticsSummary } from "@/lib/analytics";

/**
 * V0.15 — Top-of-page project stats grid (8 cards from the brief).
 */
export function ProjectStatsGrid({
  summary,
}: {
  summary: ProjectAnalyticsSummary;
}) {
  const c = summary.currency;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard
        label="Total Budget"
        value={
          summary.totalBudget !== null
            ? formatCurrencyAmount(summary.totalBudget / 100, c)
            : "—"
        }
      />
      <StatCard
        label="Allocated"
        value={formatCurrencyAmount(summary.totalAllocated / 100, c)}
        accent="primary"
      />
      <StatCard
        label="Spent"
        value={formatCurrencyAmount(summary.totalSpent / 100, c)}
        accent="warn"
      />
      <StatCard
        label="Remaining"
        value={
          summary.totalRemaining !== null
            ? formatCurrencyAmount(summary.totalRemaining / 100, c)
            : "—"
        }
        accent="good"
      />
      <StatCard
        label="Purchases"
        value={summary.totalPurchases.toLocaleString()}
        hint="approved"
      />
      <StatCard
        label="Active Custodies"
        value={summary.activeCustodies.toLocaleString()}
      />
      <StatCard
        label="Team Members"
        value={summary.teamMembersCount.toLocaleString()}
      />
      <StatCard
        label="Departments"
        value={summary.departmentsCount.toLocaleString()}
      />
    </div>
  );
}
