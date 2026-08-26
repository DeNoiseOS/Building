import { cn } from "@/lib/utils";
import {
  ListTodo,
  AlertCircle,
  Wallet,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

/**
 * V0.27.1 — Cross-project KPI row. 4 dense tiles, icon-left composition.
 *
 * Copper is reserved for tiles whose value implies action needed. Budget
 * Used shows a real donut ring computed from the actual utilization.
 * No fabricated sparklines / no fake trends.
 */
export function KpiSummary({
  openTasks,
  overdue,
  budgetUsedPct,
  pendingApprovals,
}: {
  openTasks: number;
  overdue: number;
  budgetUsedPct: number | null;
  pendingApprovals: number;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Tile
        icon={ListTodo}
        label="Open Tasks"
        value={openTasks.toLocaleString()}
        hint="Across all projects"
      />
      <Tile
        icon={AlertCircle}
        label="Overdue"
        value={overdue.toLocaleString()}
        hint={overdue > 0 ? "Needs attention" : "Nothing overdue"}
        active={overdue > 0}
      />
      <Tile
        icon={Wallet}
        label="Budget Used"
        value={budgetUsedPct === null ? "—" : `${budgetUsedPct}%`}
        hint={budgetUsedPct === null ? "No budgets set" : "Across all projects"}
        donut={budgetUsedPct !== null && budgetUsedPct > 0 ? budgetUsedPct : undefined}
      />
      <Tile
        icon={ShieldCheck}
        label="Pending Approvals"
        value={pendingApprovals.toLocaleString()}
        hint={
          pendingApprovals > 0 ? "Expenses & revisions" : "Nothing awaiting you"
        }
        active={pendingApprovals > 0}
      />
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  hint,
  active,
  donut,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  active?: boolean;
  donut?: number;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-home)] border px-4 py-4 flex items-center gap-4 min-h-[92px] transition-colors",
        active
          ? "border-[var(--denoise-copper-border)] bg-[var(--denoise-copper-muted)]"
          : "border-[var(--denoise-border)] bg-[var(--denoise-surface)]"
      )}
    >
      <span
        className={cn(
          "h-10 w-10 rounded-md flex items-center justify-center shrink-0 border",
          active
            ? "border-[var(--denoise-copper-border)] bg-transparent text-[var(--denoise-copper)]"
            : "border-[var(--denoise-border-strong)] bg-[var(--denoise-surface-2)] text-[var(--denoise-cream-muted)]"
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-[0.20em] text-[var(--denoise-cream-muted)]">
          {label}
        </p>
        <p
          className={cn(
            "text-[26px] leading-none font-semibold mt-1.5 tabular-nums tracking-tight",
            active
              ? "text-[var(--denoise-copper)]"
              : "text-[var(--denoise-cream)]"
          )}
        >
          {value}
        </p>
        {hint && (
          <p className="text-[11px] text-[var(--denoise-cream-muted)] mt-1 truncate">
            {hint}
          </p>
        )}
      </div>
      {donut !== undefined && <Donut percent={donut} />}
    </div>
  );
}

function Donut({ percent }: { percent: number }) {
  const size = 44;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, percent));
  const offset = c * (1 - p / 100);
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-white/[0.06]"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ stroke: "var(--denoise-copper)" }}
        />
      </svg>
    </div>
  );
}
