import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getProjectForUser,
  getActivityForUser,
  getProjectDepartmentFilterContext,
} from "@/lib/server-data";
import { ActivityFeed } from "@/components/shared/activity-feed";
import { DepartmentFilter } from "@/components/shared/department-filter";
import { parseDeptFilter } from "@/lib/department-filter";
import { Activity as ActivityIcon } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ dept?: string }>;
}

export default async function ProjectActivityPage({
  params,
  searchParams,
}: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const { dept: deptParam } = await searchParams;
  const project = await getProjectForUser(session.user.id, id);
  if (!project) notFound();

  // V0.6 — Activity defaults to "My department" per directive.
  const deptFilter = parseDeptFilter(deptParam ?? "mine");
  const filterCtx = await getProjectDepartmentFilterContext(
    session.user.id,
    project.id
  );

  const items = await getActivityForUser(
    session.user.id,
    100,
    project.id,
    deptFilter
  );

  return (
    <div className="space-y-6 pt-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
            <ActivityIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Activity</h2>
            <p className="text-sm text-muted-foreground">
              The narrative of this production.
            </p>
          </div>
        </div>
        <DepartmentFilter
          departments={filterCtx.departments}
          hasOwnDepartments={filterCtx.myDepartmentIds.length > 0}
        />
      </div>

      <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft p-6">
        <ActivityFeed
          items={items}
          showProject={false}
          emptyLabel="Activity will appear here as you work on this project."
        />
      </div>
    </div>
  );
}
