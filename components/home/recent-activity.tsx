import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { ActivityIcon } from "@/components/shared/activity-icon";
import { formatActivityLine } from "@/lib/activity-display";
import { Panel, SectionHeader } from "./section-header";

export interface HomeActivityItem {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  actorId: string | null;
  actorName: string | null;
  project?: { id: string; name: string };
}

/**
 * V0.27.1 — Recent Activity as a dense narrow stream. Small icon +
 * one-line message + project + relative time. Empty state stays inside
 * the panel.
 */
export function RecentActivity({ items }: { items: HomeActivityItem[] }) {
  return (
    <Panel>
      <SectionHeader
        title="Recent Activity"
        href="/activity"
      />
      {items.length === 0 ? (
        <p className="px-4 py-6 text-[12px] text-[var(--denoise-cream-muted)]">
          Nothing yet. Activity appears as your team works.
        </p>
      ) : (
        <ol className="divide-y divide-[var(--denoise-border)]">
          {items.slice(0, 8).map((event) => (
            <li key={event.id} className="flex items-start gap-3 px-4 py-2.5">
              <div className="mt-0.5 h-6 w-6 rounded-sm bg-white/[0.04] border border-[var(--denoise-border)] flex items-center justify-center shrink-0 text-[var(--denoise-cream-muted)]">
                <ActivityIcon type={event.type} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] text-[var(--denoise-cream)]/95 leading-snug truncate">
                  {formatActivityLine(event.actorName, event.message)}
                </p>
                <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--denoise-cream-muted)] mt-0.5 truncate">
                  {event.project && (
                    <>
                      <Link
                        href={`/projects/${event.project.id}`}
                        className="hover:text-[var(--denoise-copper)] transition-colors"
                      >
                        {event.project.name}
                      </Link>
                      {" · "}
                    </>
                  )}
                  {formatDistanceToNowStrict(new Date(event.createdAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
