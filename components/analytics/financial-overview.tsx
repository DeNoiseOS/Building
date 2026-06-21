import { StatCard } from "./stat-card";
import { formatCurrencyAmount } from "@/lib/currencies";
import type { FinancialOverview as FinancialOverviewData } from "@/lib/analytics";

/**
 * V0.15 — Financial overview block. 6 indicators per the brief:
 * budget util %, allocation util %, outstanding/settled custody
 * totals, pending/approved purchase counts.
 */
export function FinancialOverview({
  data,
  currency,
}: {
  data: FinancialOverviewData;
  currency: string;
}) {
  return (
    <section className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
      <div className="px-5 py-4 border-b border-white/[0.04]">
        <h2 className="text-base font-semibold">Financial Overview</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          How the project budget is being utilised.
        </p>
      </div>
      <div className="p-3 grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard
          label="Budget Utilization"
          value={
            data.budgetUtilization !== null ? `${data.budgetUtilization}%` : "—"
          }
          accent={
            data.budgetUtilization !== null && data.budgetUtilization >= 90
              ? "danger"
              : data.budgetUtilization !== null && data.budgetUtilization >= 70
              ? "warn"
              : "good"
          }
        />
        <StatCard
          label="Allocation Utilization"
          value={
            data.allocationUtilization !== null
              ? `${data.allocationUtilization}%`
              : "—"
          }
          accent={
            data.allocationUtilization !== null &&
            data.allocationUtilization >= 90
              ? "danger"
              : data.allocationUtilization !== null &&
                data.allocationUtilization >= 70
              ? "warn"
              : "good"
          }
        />
        <StatCard
          label="Outstanding Custodies"
          value={formatCurrencyAmount(data.outstandingCustodies / 100, currency)}
        />
        <StatCard
          label="Settled Custodies"
          value={formatCurrencyAmount(data.settledCustodies / 100, currency)}
        />
        <StatCard
          label="Pending Purchases"
          value={data.pendingPurchases.toLocaleString()}
          accent={data.pendingPurchases > 0 ? "warn" : "default"}
        />
        <StatCard
          label="Approved Purchases"
          value={data.approvedPurchases.toLocaleString()}
        />
      </div>
    </section>
  );
}
