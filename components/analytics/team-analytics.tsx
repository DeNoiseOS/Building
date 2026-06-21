import { StatCard } from "./stat-card";
import type { TeamAnalytics as TeamAnalyticsData } from "@/lib/analytics";

/**
 * V0.15 — Team analytics block. Total + per-department distribution.
 */
export function TeamAnalytics({ data }: { data: TeamAnalyticsData }) {
  const max = Math.max(
    1,
    ...data.byDepartment.map((d) => d.memberCount),
    data.unassignedCount
  );
  return (
    <section className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
      <div className="px-5 py-4 border-b border-white/[0.04]">
        <h2 className="text-base font-semibold">Team</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Members and department distribution.
        </p>
      </div>
      <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          label="Total Members"
          value={data.totalMembers.toLocaleString()}
        />
        <StatCard
          label="Departments"
          value={data.byDepartment.length.toLocaleString()}
        />
        <StatCard
          label="Unassigned"
          value={data.unassignedCount.toLocaleString()}
          accent={data.unassignedCount > 0 ? "warn" : "default"}
          hint="not in any dept"
        />
      </div>
      <ol className="p-3 pt-0 space-y-2">
        {data.byDepartment.map((d) => (
          <li
            key={d.departmentId}
            className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3"
          >
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium truncate">{d.departmentName}</span>
              <span className="tabular-nums text-muted-foreground">
                {d.memberCount}
              </span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
              <div
                className="h-full bg-primary"
                style={{ width: `${(d.memberCount / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
        {data.unassignedCount > 0 && (
          <li className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-amber-200/90">Unassigned</span>
              <span className="tabular-nums text-muted-foreground">
                {data.unassignedCount}
              </span>
            </div>
          </li>
        )}
      </ol>
    </section>
  );
}
