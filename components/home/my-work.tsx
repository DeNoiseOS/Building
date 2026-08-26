import Link from "next/link";
import { format } from "date-fns";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Panel, SectionHeader } from "./section-header";

export interface HomeTask {
  id: string;
  title: string;
  dueDate: Date | null;
  project: { id: string; name: string };
}

/**
 * V0.27.1 — My Work as a narrow operational column with tab-style
 * headers. Pure server component — the tab header row is a set of
 * links that scroll the underlying `/tasks?mine=1&window=...` view
 * later. The visible list defaults to the first non-empty group so
 * the panel never renders as a large empty rectangle.
 */
export function MyWork({
  overdue,
  today,
  thisWeek,
}: {
  overdue: HomeTask[];
  today: HomeTask[];
  thisWeek: HomeTask[];
}) {
  const groups = [
    { key: "overdue", label: "Overdue", tone: "red" as const, items: overdue },
    { key: "today", label: "Due Today", tone: "amber" as const, items: today },
    { key: "week", label: "This Week", tone: "neutral" as const, items: thisWeek },
  ];
  const activeGroup =
    groups.find((g) => g.items.length > 0) ?? groups[0];

  return (
    <Panel>
      <SectionHeader
        title="My Work"
        count={overdue.length + today.length + thisWeek.length}
        href="/tasks?mine=1"
      />
      <div className="px-4 pt-3 flex items-center gap-4 border-b border-[var(--denoise-border)]">
        {groups.map((g) => {
          const isActive = g.key === activeGroup.key;
          return (
            <div key={g.key} className="pb-2.5 -mb-px relative">
              <div
                className={cn(
                  "text-[11px] uppercase tracking-[0.16em] font-medium flex items-center gap-1.5",
                  isActive
                    ? "text-[var(--denoise-cream)]"
                    : "text-[var(--denoise-cream-muted)]"
                )}
              >
                {g.label}
                <span className="text-[10px] tabular-nums opacity-70">
                  {g.items.length}
                </span>
              </div>
              {isActive && (
                <div className="absolute left-0 right-0 bottom-[-1px] h-[2px] bg-[var(--denoise-copper)]" />
              )}
            </div>
          );
        })}
      </div>
      {activeGroup.items.length === 0 ? (
        <div className="px-4 py-6 flex items-center gap-2 text-[12px] text-[var(--denoise-cream-muted)]">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400/70" />
          Nothing here — clear window.
        </div>
      ) : (
        <ul className="divide-y divide-[var(--denoise-border)]">
          {activeGroup.items.slice(0, 6).map((t) => (
            <li key={t.id}>
              <Link
                href={`/projects/${t.project.id}/tasks`}
                className="block px-4 py-2.5 hover:bg-[var(--denoise-surface-2)] transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] text-[var(--denoise-cream)] truncate flex-1">
                    {t.title}
                  </p>
                  {t.dueDate && (
                    <span
                      className={cn(
                        "text-[10px] uppercase tracking-[0.14em] tabular-nums shrink-0",
                        activeGroup.tone === "red"
                          ? "text-red-300"
                          : activeGroup.tone === "amber"
                            ? "text-amber-300"
                            : "text-[var(--denoise-cream-muted)]"
                      )}
                    >
                      {format(t.dueDate, "MMM d")}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[var(--denoise-cream-muted)] truncate mt-0.5">
                  {t.project.name}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
