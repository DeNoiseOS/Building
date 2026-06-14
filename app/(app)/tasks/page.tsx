import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getTasksForUser,
  getProjectChoicesForUser,
  getProjectDepartmentFilterContext,
} from "@/lib/server-data";
import { DepartmentFilter } from "@/components/shared/department-filter";
import { parseDeptFilter } from "@/lib/department-filter";
import { TaskListView } from "@/components/tasks/task-list-view";
import { TaskKanbanView } from "@/components/tasks/task-kanban-view";
import { NewTaskButton } from "@/components/tasks/new-task-button";
import { ViewToggle } from "@/components/tasks/view-toggle";
import { parseViewMode } from "@/components/tasks/view-mode";
import { TaskFilters } from "@/components/tasks/task-filters";
import { ListTodo } from "lucide-react";
import { TASK_STATUS, type TaskStatus } from "@/lib/roles";

const STATUS_VALUES = new Set(TASK_STATUS.map((s) => s.value));

interface PageProps {
  searchParams: Promise<{
    view?: string;
    project?: string;
    status?: string;
    mine?: string;
    dept?: string;
  }>;
}

export default async function TasksPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const sp = await searchParams;
  const view = parseViewMode(sp.view);
  const projectId = sp.project || undefined;
  const statuses = (sp.status ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && STATUS_VALUES.has(s as TaskStatus));
  const mineOnly = sp.mine === "1";
  const deptFilter = parseDeptFilter(sp.dept);
  const filterCtx = projectId
    ? await getProjectDepartmentFilterContext(session.user.id, projectId)
    : null;

  const [tasks, projects] = await Promise.all([
    getTasksForUser(session.user.id, {
      projectId,
      status: statuses.length > 0 ? statuses : undefined,
      mineOnly,
      departmentFilter: projectId ? deptFilter : undefined,
    }),
    getProjectChoicesForUser(session.user.id),
  ]);

  const currentUser = {
    id: session.user.id,
    name: session.user.name ?? "Me",
  };

  const filtersActive = !!projectId || statuses.length > 0 || mineOnly;

  return (
    <div className="px-8 py-7 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground mt-1.5">
            Every task across every production.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {filterCtx && (
            <DepartmentFilter
              departments={filterCtx.departments}
              hasOwnDepartments={filterCtx.myDepartmentIds.length > 0}
            />
          )}
          <ViewToggle current={view} />
          <NewTaskButton
            projectChoices={projects}
            currentUser={currentUser}
          />
        </div>
      </header>

      {projects.length > 0 && (
        <TaskFilters
          projects={projects}
          projectId={projectId}
          statuses={statuses}
          mineOnly={mineOnly}
        />
      )}

      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Tasks live inside projects. Create your first production to start tracking work."
        />
      ) : tasks.length === 0 ? (
        <EmptyState
          title={
            filtersActive ? "No tasks match these filters" : "No tasks yet"
          }
          description={
            filtersActive
              ? "Try clearing filters or pick a different project."
              : "Add a task on any project to get started. They'll show up here."
          }
          showCreate={!filtersActive}
          projectChoices={projects}
          currentUser={currentUser}
        />
      ) : view === "kanban" ? (
        <TaskKanbanView
          tasks={tasks}
          showProject={true}
          currentUser={currentUser}
        />
      ) : (
        <TaskListView
          tasks={tasks}
          showProject={true}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}

function EmptyState({
  title,
  description,
  showCreate = false,
  projectChoices = [],
  currentUser,
}: {
  title: string;
  description: string;
  showCreate?: boolean;
  projectChoices?: Array<{ id: string; name: string }>;
  currentUser?: { id: string; name: string };
}) {
  return (
    <div className="rounded-2xl bg-card/40 border border-dashed border-white/[0.08] py-16 px-6 flex flex-col items-center text-center gap-4">
      <div className="h-12 w-12 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center">
        <ListTodo className="h-5 w-5 text-primary" />
      </div>
      <div className="space-y-1.5 max-w-md">
        <h3 className="text-xl font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {showCreate && currentUser && (
        <NewTaskButton
          projectChoices={projectChoices}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
