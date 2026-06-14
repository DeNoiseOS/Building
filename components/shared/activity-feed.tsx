import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ActivityIcon } from "@/components/shared/activity-icon";
import { formatActivityLine } from "@/lib/activity-display";

export interface ActivityFeedItem {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  actorId?: string | null;
  actorName?: string | null;
  project?: { id: string; name: string };
}

interface ActivityFeedProps {
  items: ActivityFeedItem[];
  /** When true, the project name renders under the message as a link. */
  showProject?: boolean;
  /** Custom empty-state copy. */
  emptyLabel?: string;
}

export function ActivityFeed({
  items,
  showProject = true,
  emptyLabel = "Nothing yet. Activity will appear as you work on your productions.",
}: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ol className="space-y-2.5">
      {items.map((event) => (
        <li key={event.id} className="flex items-start gap-3 text-sm group">
          <div className="mt-0.5 h-7 w-7 rounded-lg bg-white/[0.04] border border-white/[0.04] flex items-center justify-center shrink-0 text-muted-foreground group-hover:text-foreground group-hover:bg-white/[0.06] transition-colors">
            <ActivityIcon type={event.type} />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-foreground/90 leading-snug">
              {formatActivityLine(event.actorName, event.message)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {showProject && event.project && (
                <>
                  <Link
                    href={`/projects/${event.project.id}`}
                    className="hover:text-foreground underline-offset-2 hover:underline"
                  >
                    {event.project.name}
                  </Link>
                  {" · "}
                </>
              )}
              {formatDistanceToNow(new Date(event.createdAt), {
                addSuffix: true,
              })}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
