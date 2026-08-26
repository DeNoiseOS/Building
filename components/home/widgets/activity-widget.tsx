import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { ActivityIcon } from "@/components/shared/activity-icon";
import { formatActivityLine } from "@/lib/activity-display";
import type { ActivityResult } from "@/lib/widgets/data/activity";
import type { Density } from "@/components/home/canvas/use-density";

export function ActivityWidget({
  data,
  density,
}: {
  data: ActivityResult;
  density: Density;
}) {
  if (data.totalCount === 0) {
    return (
      <div className="h-full flex items-center px-4 py-3 text-[12px] text-[var(--denoise-cream-muted)]">
        No recent activity.
      </div>
    );
  }

  if (density === "micro") {
    return (
      <div className="h-full flex flex-col justify-center px-4 py-3">
        <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--denoise-cream-muted)]">
          Activity
        </div>
        <div className="text-[28px] font-semibold tabular-nums leading-none mt-2 text-[var(--denoise-cream)]">
          {data.totalCount}
        </div>
      </div>
    );
  }

  const limit =
    density === "compact"
      ? 3
      : density === "standard"
        ? 6
        : density === "expanded"
          ? 10
          : 20;

  return (
    <ol className="h-full overflow-auto divide-y divide-[var(--denoise-border)]">
      {data.events.slice(0, limit).map((event) => (
        <li key={event.id} className="flex items-start gap-2.5 px-4 py-2">
          <div className="mt-0.5 h-5 w-5 rounded-sm bg-white/[0.04] border border-[var(--denoise-border)] flex items-center justify-center shrink-0 text-[var(--denoise-cream-muted)]">
            <ActivityIcon type={event.type} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] text-[var(--denoise-cream)]/95 leading-snug truncate">
              {formatActivityLine(event.actorName, event.message)}
            </p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--denoise-cream-muted)] mt-0.5 truncate">
              <Link
                href={`/projects/${event.project.id}`}
                className="hover:text-[var(--denoise-copper)]"
              >
                {event.project.name}
              </Link>
              {" · "}
              {formatDistanceToNowStrict(new Date(event.createdAt), {
                addSuffix: true,
              })}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
