import Link from "next/link";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  isSameDay,
} from "date-fns";
import { cn } from "@/lib/utils";
import { coverFor } from "@/lib/cover";
import type { CalendarEventSummary } from "@/lib/server-data";

interface CalendarGridProps {
  events: CalendarEventSummary[];
  /** The month to render (any date inside it). */
  monthDate: Date;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarGrid({ events, monthDate }: CalendarGridProps) {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div className="rounded-2xl border border-white/[0.05] bg-card/40 overflow-hidden">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-white/[0.04]">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 auto-rows-fr">
        {days.map((day) => {
          const dayEvents = events.filter((e) =>
            isSameDay(new Date(e.date), day)
          );
          const inMonth = isSameMonth(day, monthDate);
          const today = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "border-r border-b border-white/[0.04] min-h-[100px] p-1.5 flex flex-col gap-1",
                !inMonth && "bg-white/[0.005]",
                today && "bg-primary/[0.04]"
              )}
            >
              <div
                className={cn(
                  "text-xs font-medium px-1 flex items-center justify-between",
                  !inMonth && "text-muted-foreground/40",
                  today && "text-primary"
                )}
              >
                <span>{format(day, "d")}</span>
                {today && (
                  <span className="h-1 w-1 rounded-full bg-primary" />
                )}
              </div>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {dayEvents.slice(0, 3).map((event, idx) => (
                  <CalendarEventPill key={`${event.kind}-${idx}`} event={event} />
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-[10px] text-muted-foreground px-1">
                    +{dayEvents.length - 3} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalendarEventPill({ event }: { event: CalendarEventSummary }) {
  const styles: Record<CalendarEventSummary["kind"], string> = {
    project_start: cn("bg-white/10 text-white/90 border", coverFor(event.project.id)),
    project_end: cn("bg-white/10 text-white/90 border", coverFor(event.project.id)),
    task_due:
      event.priority === "high"
        ? "bg-red-400/15 text-red-300 border border-red-400/25"
        : event.priority === "medium"
          ? "bg-amber-400/15 text-amber-300 border border-amber-400/25"
          : "bg-white/[0.04] text-foreground/80 border border-white/[0.06]",
  };

  return (
    <Link
      href={`/projects/${event.project.id}`}
      className={cn(
        "block px-1.5 py-0.5 rounded-md text-[10px] font-medium truncate transition-opacity hover:opacity-80",
        styles[event.kind]
      )}
      title={event.title}
    >
      {event.kind === "project_start" && "▶ "}
      {event.kind === "project_end" && "▣ "}
      {event.title}
    </Link>
  );
}
