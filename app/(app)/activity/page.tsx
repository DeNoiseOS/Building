import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getActivityForUser } from "@/lib/server-data";
import { ActivityFeed } from "@/components/shared/activity-feed";
import { Activity as ActivityIcon } from "lucide-react";

export default async function GlobalActivityPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const items = await getActivityForUser(session.user.id, 100);

  return (
    <div className="px-8 py-7 max-w-4xl mx-auto space-y-6">
      <header>
        <div className="flex items-center gap-3 mb-1">
          <div className="h-9 w-9 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
            <ActivityIcon className="h-4.5 w-4.5" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Activity</h1>
        </div>
        <p className="text-muted-foreground mt-1.5">
          Everything happening across your productions, newest first.
        </p>
      </header>

      <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft p-6">
        <ActivityFeed
          items={items}
          emptyLabel="Activity will appear here as you work on your productions."
        />
      </div>
    </div>
  );
}
