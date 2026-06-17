import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getProjectForUser,
  getTasksForUser,
  getProjectDepartmentFilterContext,
  type TaskSummary,
} from "@/lib/server-data";
import { TaskListView } from "@/components/tasks/task-list-view";
import { TaskKanbanView } from "@/components/tasks/task-kanban-view";
import { NewTaskButton } from "@/components/tasks/new-task-button";
import { ViewToggle } from "@/components/tasks/view-toggle";
import { parseViewMode } from "@/components/tasks/view-mode";
import { DepartmentFilter } from "@/components/shared/department-filter";
import { parseDeptFilter } from "@/lib/department-filter";
import { ListTodo } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string; dept?: string }>;
}

export default async function ProjectTasksTab({
  params,
  searchParams,
}: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const { view: viewParam, dept: deptParam } = await searchParams;
  const view = parseViewMode(viewParam);

  const project = await getProjectForUser(session.user.id, id);
  if (!project) notFound();

  const filterCtx = await getProjectDepartmentFilterContext(
    session.user.id,
    project.id
  );
  // V0.12.3 — default view is "my department" when caller has any
  // dept (assigned member OR resolved head). Project-wide roles
  // with no dept fall back to "all".
  const deptFilter =
    deptParam === undefined && filterCtx.myDepartmentIds.length > 0
      ? ({ mode: "mine" as const, departmentIds: [] })
      : parseDeptFilter(deptParam);

  const tasks: TaskSummary[] = await getTasksForUser(session.user.id, {
    projectId: project.id,
    departmentFilter: deptFilter,
  });

  const currentUser = {
    id: session.user.id,
    name: session.user.name ?? "Me",
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Tasks</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tasks.length === 0
              ? "No tasks yet."
              : `${tasks.length} task${tasks.length === 1 ? "" : "s"} on this production.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DepartmentFilter
            departments={filterCtx.departments}
            hasOwnDepartments={filterCtx.myDepartmentIds.length > 0}
          />
          <ViewToggle current={view} />
          <NewTaskButton
            projectId={project.id}
            currentUser={currentUser}
          />
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-2xl bg-card/40 border border-dashed border-white/[0.08] py-16 px-6 flex flex-col items-center text-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center">
            <ListTodo className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1.5 max-w-md">
            <h3 className="text-xl font-semibold">No tasks yet</h3>
            <p className="text-sm text-muted-foreground">
              Add a task to start tracking work on this production. Use the
              Kanban view to drag tasks across statuses.
            </p>
          </div>
          <NewTaskButton
            projectId={project.id}
            currentUser={currentUser}
          />
        </div>
      ) : view === "kanban" ? (
        <TaskKanbanView
          tasks={tasks}
          showProject={false}
          currentUser={currentUser}
        />
      ) : (
        <TaskListView
          tasks={tasks}
          showProject={false}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
