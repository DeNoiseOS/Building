"use client";

import { TaskRow, type TaskRowData } from "./task-row";

interface TaskListViewProps {
  tasks: TaskRowData[];
  showProject?: boolean;
  currentUser: { id: string; name: string };
}

export function TaskListView({
  tasks,
  showProject = false,
  currentUser,
}: TaskListViewProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center border rounded-md">
        No tasks match the current filters.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          showProject={showProject}
          currentUser={currentUser}
        />
      ))}
    </div>
  );
}
