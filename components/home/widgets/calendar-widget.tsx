import Link from "next/link";
import { format, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import type { CalendarResult, CalendarEvent } from "@/lib/widgets/data/calendar";
import type { Density } from "@/components/home/canvas/use-density";

/**
 * V0.28 Phase B — Calendar widget.
 *
 * Density behavior:
 *   micro/compact → event count
 *   standard      → agenda list, 4-6 events
 *   expanded      → agenda list, all events with metadata
 *   full          → agenda list grouped by day
 */
export function CalendarWidget({
  data,
  density,
}: {
  data: CalendarResult;
  density: Density;
}) {
  if (data.events.length === 0) {
    return (
      <div className="h-full flex items-center px-4 py-3 text-[12px] text-[var(--denoise-cream-muted)]">
        Nothing on the calendar in this range.
      </div>
    );
  }

  if (density === "micro" || density === "compact") {
    return (
      <div className="h-full flex flex-col justify-center px-4 py-3">
        <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--denoise-cream-muted)]">
          Calendar
        </div>
        <div className="text-[28px] font-semibold tabular-nums leading-none mt-2 text-[var(--denoise-cream)]">
          {data.events.length}
        </div>
        {density === "compact" && (
          <div className="mt-2 text-[11px] text-[var(--denoise-cream-muted)] truncate">
            through {format(data.rangeEnd, "MMM d")}
          </div>
        )}
      </div>
    );
  }

  const limit = density === "standard" ? 6 : density === "expanded" ? 12 : 40;
  const groupedByDay = groupByDay(data.events);

  return (
    <ol className="h-full overflow-auto divide-y divide-[var(--denoise-border)]">
      {groupedByDay.slice(0, limit).map(({ day, items }) => (
        <li key={day.toISOString()}>
          <div className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-[0.16em] text-[var(--denoise-cream-muted)]">
            {format(day, "EEE, MMM d")}
          </div>
          <ul>
            {items.map((e) => (
              <li key={eventKey(e)}>
                <Link
                  href={eventHref(e)}
                  className="flex items-center gap-2 px-4 py-1.5 hover:bg-[var(--denoise-surface-2)] transition-colors"
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full shrink-0",
                      e.kind === "task_due"
                        ? "bg-[var(--denoise-copper)]"
                        : "bg-white/[0.15]",
                    )}
                  />
                  <span className="text-[12px] text-[var(--denoise-cream)] truncate flex-1">
                    {e.title}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--denoise-cream-muted)] shrink-0">
                    {e.projectName}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

function groupByDay(events: CalendarEvent[]) {
  const out: { day: Date; items: CalendarEvent[] }[] = [];
  for (const e of events) {
    const dayStart = new Date(e.when);
    dayStart.setHours(0, 0, 0, 0);
    const last = out[out.length - 1];
    if (last && isSameDay(last.day, dayStart)) last.items.push(e);
    else out.push({ day: dayStart, items: [e] });
  }
  return out;
}
function eventKey(e: CalendarEvent) {
  return `${e.kind}-${e.taskId ?? e.projectId}-${e.when.getTime()}`;
}
function eventHref(e: CalendarEvent) {
  if (e.kind === "task_due") return `/projects/${e.projectId}/tasks`;
  if (e.kind === "shoot_day") return `/projects/${e.projectId}/scheduling`;
  return `/projects/${e.projectId}`;
}
