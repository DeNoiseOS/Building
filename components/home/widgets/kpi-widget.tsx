import { cn } from "@/lib/utils";
import type { KpiConfig } from "@/lib/widgets/schema";
import type { KpiResult } from "@/lib/widgets/data/kpi";
import type { Density } from "@/components/home/canvas/use-density";

/**
 * V0.28 Phase B — KPI widget.
 *
 * Density behavior:
 *   micro/compact → label + big number (+ hint on compact)
 *   standard+     → number + hint + subtle donut when the metric is a
 *                    percentage, no fabricated sparklines
 */
export function KpiWidget({
  config,
  data,
  density,
}: {
  config: KpiConfig;
  data: KpiResult;
  density: Density;
}) {
  const value =
    data.value === null
      ? "—"
      : data.unit === "percent"
        ? `${data.value}%`
        : data.value.toLocaleString();

  const isActionable =
    (config.metric === "overdue_tasks" || config.metric === "pending_approvals") &&
    typeof data.value === "number" &&
    data.value > 0;

  const showDonut =
    data.unit === "percent" &&
    typeof data.value === "number" &&
    data.value > 0 &&
    density !== "micro";

  return (
    <div
      className={cn(
        "h-full flex items-center gap-3 px-4 py-3",
        isActionable && "bg-[var(--denoise-copper-muted)]",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-[0.20em] text-[var(--denoise-cream-muted)]">
          {config.label ?? data.label}
        </p>
        <p
          className={cn(
            "text-[26px] font-semibold tabular-nums tracking-tight leading-none mt-1.5",
            isActionable ? "text-[var(--denoise-copper)]" : "text-[var(--denoise-cream)]",
          )}
        >
          {value}
        </p>
        {density !== "micro" && data.hint && (
          <p className="text-[11px] text-[var(--denoise-cream-muted)] mt-1 truncate">
            {data.hint}
          </p>
        )}
      </div>
      {showDonut && <Donut percent={data.value as number} />}
    </div>
  );
}

function Donut({ percent }: { percent: number }) {
  const size = 44;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(100, percent)) / 100);
  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0" aria-hidden>
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
  );
}
