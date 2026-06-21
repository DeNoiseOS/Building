import { formatCurrencyAmount } from "@/lib/currencies";
import type { DepartmentAnalyticsRow } from "@/lib/analytics";

/**
 * V0.15 — Department analytics table + top-spend ranking section.
 */
export function DepartmentAnalytics({
  rows,
  topSpending,
  currency,
}: {
  rows: DepartmentAnalyticsRow[];
  topSpending: DepartmentAnalyticsRow[];
  currency: string;
}) {
  const topMax = topSpending[0]?.spent ?? 0;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <section className="lg:col-span-2 rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.04]">
          <h2 className="text-base font-semibold">Departments</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            One row per department.
          </p>
        </div>
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70">
            <tr className="border-b border-white/[0.04]">
              <Th>Department</Th>
              <Th align="right">Allocated</Th>
              <Th align="right">Spent</Th>
              <Th align="right">Remaining</Th>
              <Th align="right">Purchases</Th>
              <Th align="right">Custodies</Th>
              <Th align="right">Team</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-8 text-sm text-muted-foreground text-center"
                >
                  No departments on this project yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.departmentId}
                  className="border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02]"
                >
                  <Td>
                    <span className="font-medium">{r.name}</span>
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {formatCurrencyAmount(r.allocated / 100, currency)}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {formatCurrencyAmount(r.spent / 100, currency)}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {r.remaining !== null
                      ? formatCurrencyAmount(r.remaining / 100, currency)
                      : "—"}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {r.totalPurchases}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {r.activeCustodies}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {r.teamSize}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
        <div className="px-5 py-4 border-b border-white/[0.04]">
          <h2 className="text-base font-semibold">Top Spenders</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Departments ranked by spend.
          </p>
        </div>
        <ol className="p-3 space-y-2">
          {topSpending.length === 0 ? (
            <li className="text-sm text-muted-foreground text-center py-6">
              No spending recorded yet.
            </li>
          ) : (
            topSpending.map((d, i) => {
              const widthPct = topMax > 0 ? (d.spent / topMax) * 100 : 0;
              return (
                <li
                  key={d.departmentId}
                  className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        #{i + 1}
                      </span>
                      <span className="font-medium truncate">{d.name}</span>
                    </span>
                    <span className="tabular-nums font-semibold">
                      {formatCurrencyAmount(d.spent / 100, currency)}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-violet-500"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </li>
              );
            })
          )}
        </ol>
      </section>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      className={`px-5 py-3 font-medium text-${align}`}
      style={{ textAlign: align }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  className = "",
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  return (
    <td
      className={`px-5 py-3 ${className}`}
      style={{ textAlign: align }}
    >
      {children}
    </td>
  );
}
