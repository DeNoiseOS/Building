import Link from "next/link";
import { format, isToday, isTomorrow, isSameDay } from "date-fns";
import { Camera, ListTodo } from "lucide-react";
import { Panel, SectionHeader } from "./section-header";
import { cn } from "@/lib/utils";

export interface TimelineItem {
  key: string;
  kind: "task" | "scene";
  when: Date;
  title: string;
  href: string;
  projectName: string;
  projectId: string;
  meta?: string;
}

/**
 * V0.27.1 — Timeline. Vertical date-column list. Compact empty state
 * inside the panel — no giant blank rectangle.
 */
export function TimelineOverview({ items }: { items: TimelineItem[]; now?: Date }) {
  const groups = groupByDay(items);
  return (
    <Panel>
      <SectionHeader title="Timeline" count={items.length} href="/calendar" />
      {groups.length === 0 ? (
        <p className="px-4 py-6 text-[12px] text-[var(--denoise-cream-muted)] leading-relaxed">
          Nothing scheduled in the next week.{" "}
          <span className="text-[var(--denoise-cream)]/70">
            Timeline populates from scheduled scenes and dated tasks.
          </span>
        </p>
      ) : (
        <ol className="divide-y divide-[var(--denoise-border)]">
          {groups.slice(0, 6).map(({ day, items: dayItems }) => (
            <li key={day.toISOString()} className="grid grid-cols-[72px_1fr]">
              <div className="px-3 py-3 border-r border-[var(--denoise-border)] bg-[var(--denoise-bg)]/40">
                <div
                  className={cn(
                    "text-[10px] uppercase tracking-[0.16em] font-medium",
                    isToday(day)
                      ? "text-[var(--denoise-copper)]"
                      : "text-[var(--denoise-cream-muted)]",
                  )}
                >
                  {format(day, "MMM").toUpperCase()}
                </div>
                <div className="text-[18px] tabular-nums text-[var(--denoise-cream)] leading-none mt-0.5">
                  {format(day, "d")}
                </div>
                <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--denoise-cream-muted)] mt-1">
                  {isToday(day) ? "Today" : isTomorrow(day) ? "Tmrw" : format(day, "EEE")}
                </div>
              </div>
              <ul>
                {dayItems.slice(0, 3).map((it) => {
                  const Icon = it.kind === "scene" ? Camera : ListTodo;
                  return (
                    <li key={it.key}>
                      <Link
                        href={it.href}
                        className="flex items-center gap-2.5 px-3 py-2 hover:bg-[var(--denoise-surface-2)] transition-colors"
                      >
                        <span
                          className={cn(
                            "h-5 w-5 rounded-sm flex items-center justify-center shrink-0",
                            it.kind === "scene"
                              ? "bg-[var(--denoise-copper-muted)] text-[var(--denoise-copper)]"
                              : "bg-white/[0.04] text-[var(--denoise-cream-muted)]",
                          )}
                        >
                          <Icon className="h-2.5 w-2.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] text-[var(--denoise-cream)] truncate">
                            {it.title}
                          </p>
                          <p className="text-[10px] text-[var(--denoise-cream-muted)] truncate">
                            {it.projectName}
                            {it.meta ? ` · ${it.meta}` : ""}
                          </p>
                        </div>
                        <span className="text-[9px] uppercase tracking-[0.14em] text-[var(--denoise-cream-muted)] shrink-0">
                          {it.kind === "scene" ? "Scene" : "Task"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function groupByDay(items: TimelineItem[]) {
  const sorted = [...items].sort((a, b) => a.when.getTime() - b.when.getTime());
  const out: { day: Date; items: TimelineItem[] }[] = [];
  for (const it of sorted) {
    const dayStart = new Date(it.when);
    dayStart.setHours(0, 0, 0, 0);
    const last = out[out.length - 1];
    if (last && isSameDay(last.day, dayStart)) {
      last.items.push(it);
    } else {
      out.push({ day: dayStart, items: [it] });
    }
  }
  return out;
}
