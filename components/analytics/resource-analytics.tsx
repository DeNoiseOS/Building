import { StatCard } from "./stat-card";
import type { ResourceAnalytics as ResourceAnalyticsData } from "@/lib/analytics";

/**
 * V0.15 — Resource analytics block. Top counts + per-department breakdown.
 */
export function ResourceAnalytics({
  data,
}: {
  data: ResourceAnalyticsData;
}) {
  return (
    <section className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
      <div className="px-5 py-4 border-b border-white/[0.04]">
        <h2 className="text-base font-semibold">Resources</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Equipment, props, talent, and other tracked assets.
        </p>
      </div>
      <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total" value={data.total.toLocaleString()} />
        <StatCard
          label="Assigned"
          value={data.assigned.toLocaleString()}
          accent="primary"
        />
        <StatCard
          label="Available"
          value={data.available.toLocaleString()}
          accent="good"
        />
        <StatCard
          label="Damaged / Lost"
          value={data.damaged.toLocaleString()}
          accent={data.damaged > 0 ? "danger" : "default"}
        />
      </div>
      {data.byDepartment.length > 0 && (
        <table className="w-full text-sm border-t border-white/[0.04]">
          <thead className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70">
            <tr className="border-b border-white/[0.04]">
              <th className="px-5 py-3 text-left font-medium">Department</th>
              <th className="px-5 py-3 text-right font-medium">Total</th>
              <th className="px-5 py-3 text-right font-medium">Assigned</th>
              <th className="px-5 py-3 text-right font-medium">Available</th>
              <th className="px-5 py-3 text-right font-medium">Damaged</th>
            </tr>
          </thead>
          <tbody>
            {data.byDepartment.map((r) => (
              <tr
                key={r.departmentId}
                className="border-b border-white/[0.03] last:border-b-0"
              >
                <td className="px-5 py-2.5 font-medium">{r.departmentName}</td>
                <td className="px-5 py-2.5 text-right tabular-nums">
                  {r.total}
                </td>
                <td className="px-5 py-2.5 text-right tabular-nums">
                  {r.assigned}
                </td>
                <td className="px-5 py-2.5 text-right tabular-nums">
                  {r.available}
                </td>
                <td className="px-5 py-2.5 text-right tabular-nums">
                  {r.damaged}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
