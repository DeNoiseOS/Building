import Link from "next/link";
import { format, isToday, isTomorrow, isSameDay } from "date-fns";
import { Camera, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimelineResult, TimelineEntry } from "@/lib/widgets/data/timeline";
import type { Density } from "@/components/home/canvas/use-density";

export function TimelineWidget({
  data,
  density,
}: {
  data: TimelineResult;
  density: Density;
}) {
  if (data.entries.length === 0) {
    return (
      <div className="h-full flex items-center px-4 py-3 text-[12px] text-[var(--denoise-cream-muted)]">
        Nothing scheduled in this range.
      </div>
    );
  }

  if (density === "micro") {
    return (
      <div className="h-full flex flex-col justify-center px-4 py-3">
        <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--denoise-cream-muted)]">
          Timeline
        </div>
        <div className="text-[28px] font-semibold tabular-nums leading-none mt-2 text-[var(--denoise-cream)]">
          {data.entries.length}
        </div>
      </div>
    );
  }

  if (density === "compact") {
    return (
      <ul className="h-full overflow-auto">
        {data.entries.slice(0, 4).map((it) => (
          <li key={it.key}>
            <Link
              href={it.href}
              className="flex items-center gap-2 px-4 py-1.5 hover:bg-[var(--denoise-surface-2)] transition-colors"
            >
              <span className="text-[10px] tabular-nums text-[var(--denoise-cream-muted)] w-10 shrink-0">
                {format(it.when, "MMM d")}
              </span>
              <span className="text-[12px] text-[var(--denoise-cream)] truncate">
                {it.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  const groups = groupByDay(data.entries);
  const maxGroups = density === "standard" ? 3 : density === "expanded" ? 6 : 10;

  return (
    <ol className="h-full overflow-auto divide-y divide-[var(--denoise-border)]">
      {groups.slice(0, maxGroups).map(({ day, items }) => (
        <li key={day.toISOString()} className="grid grid-cols-[64px_1fr]">
          <div className="px-3 py-2 border-r border-[var(--denoise-border)] bg-[var(--denoise-bg)]/40">
            <div
              className={cn(
                "text-[9px] uppercase tracking-[0.14em] font-medium",
                isToday(day)
                  ? "text-[var(--denoise-copper)]"
                  : "text-[var(--denoise-cream-muted)]"
              )}
            >
              {format(day, "MMM").toUpperCase()}
            </div>
            <div className="text-[16px] tabular-nums text-[var(--denoise-cream)] leading-none mt-0.5">
              {format(day, "d")}
            </div>
            <div className="text-[9px] uppercase tracking-[0.14em] text-[var(--denoise-cream-muted)] mt-0.5">
              {isToday(day) ? "Today" : isTomorrow(day) ? "Tmrw" : format(day, "EEE")}
            </div>
          </div>
          <ul>
            {items.slice(0, density === "full" ? 6 : 3).map((it) => {
              const Icon = it.kind === "scene" ? Camera : ListTodo;
              return (
                <li key={it.key}>
                  <Link
                    href={it.href}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--denoise-surface-2)] transition-colors"
                  >
                    <span
                      className={cn(
                        "h-4 w-4 rounded-sm flex items-center justify-center shrink-0",
                        it.kind === "scene"
                          ? "bg-[var(--denoise-copper-muted)] text-[var(--denoise-copper)]"
                          : "bg-white/[0.04] text-[var(--denoise-cream-muted)]"
                      )}
                    >
                      <Icon className="h-2.5 w-2.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] text-[var(--denoise-cream)] truncate">
                        {it.title}
                      </p>
                      {density !== "standard" && (
                        <p className="text-[10px] text-[var(--denoise-cream-muted)] truncate">
                          {it.projectName}
                          {it.meta ? ` · ${it.meta}` : ""}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ol>
  );
}

function groupByDay(entries: TimelineEntry[]) {
  const sorted = [...entries].sort((a, b) => a.when.getTime() - b.when.getTime());
  const out: { day: Date; items: TimelineEntry[] }[] = [];
  for (const it of sorted) {
    const dayStart = new Date(it.when);
    dayStart.setHours(0, 0, 0, 0);
    const last = out[out.length - 1];
    if (last && isSameDay(last.day, dayStart)) last.items.push(it);
    else out.push({ day: dayStart, items: [it] });
  }
  return out;
}
