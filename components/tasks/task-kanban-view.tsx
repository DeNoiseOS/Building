"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { TASK_STATUS, TASK_STATUS_LABELS, type TaskStatus } from "@/lib/roles";
import { TaskKanbanCard } from "./task-kanban-card";
import { cn } from "@/lib/utils";
import type { TaskRowData } from "./task-row";

interface TaskKanbanViewProps {
  tasks: TaskRowData[];
  showProject?: boolean;
  currentUser: { id: string; name: string };
}

const COLUMNS = TASK_STATUS.map((s) => s.value) as TaskStatus[];

function KanbanColumn({
  status,
  tasks,
  showProject,
  currentUser,
  isOver,
}: {
  status: TaskStatus;
  tasks: TaskRowData[];
  showProject?: boolean;
  currentUser: { id: string; name: string };
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: `column-${status}` });

  const dotColor: Record<TaskStatus, string> = {
    todo: "bg-white/30",
    in_progress: "bg-sky-400",
    waiting_approval: "bg-amber-400",
    done: "bg-emerald-400",
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-2xl border border-white/[0.04] bg-card/30 min-h-[400px] transition-all",
        isOver && "ring-2 ring-primary/40 border-primary/30 bg-primary/[0.04]"
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <span className={cn("h-1.5 w-1.5 rounded-full", dotColor[status])} />
          <h3 className="text-sm font-semibold tracking-tight">
            {TASK_STATUS_LABELS[status]}
          </h3>
        </div>
        <span className="text-xs text-muted-foreground font-medium tabular-nums">
          {tasks.length}
        </span>
      </div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto">
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8 px-3 border border-dashed border-white/[0.04] rounded-xl mx-1">
            Drop tasks here
          </p>
        ) : (
          tasks.map((task) => (
            <TaskKanbanCard
              key={task.id}
              task={task}
              showProject={showProject}
              currentUser={currentUser}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function TaskKanbanView({
  tasks: initialTasks,
  showProject,
  currentUser,
}: TaskKanbanViewProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskRowData[]>(initialTasks);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [hoverColumn, setHoverColumn] = useState<TaskStatus | null>(null);

  // Sync prop changes (e.g. router.refresh() brings fresh server data after a
  // drop). Phase 3B verification fix: was using useMemo for a setState side
  // effect, which doesn't reliably re-run and triggers React warnings.
  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const columns = useMemo(() => {
    const grouped: Record<TaskStatus, TaskRowData[]> = {
      todo: [],
      in_progress: [],
      waiting_approval: [],
      done: [],
    };
    for (const t of tasks) {
      const status = (t.status as TaskStatus) ?? "todo";
      if (grouped[status]) grouped[status].push(t);
      else grouped.todo.push(t);
    }
    return grouped;
  }, [tasks]);

  const activeTask = activeTaskId
    ? tasks.find((t) => t.id === activeTaskId) ?? null
    : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveTaskId(String(event.active.id));
  }

  function handleDragOver(event: DragEndEvent) {
    const overId = event.over?.id;
    if (typeof overId === "string" && overId.startsWith("column-")) {
      setHoverColumn(overId.replace("column-", "") as TaskStatus);
    } else {
      setHoverColumn(null);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTaskId(null);
    setHoverColumn(null);

    const overId = event.over?.id;
    if (typeof overId !== "string" || !overId.startsWith("column-")) return;

    const newStatus = overId.replace("column-", "") as TaskStatus;
    const taskId = String(event.active.id);
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    const previousStatus = task.status as TaskStatus;

    // Optimistic update.
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: newStatus,
              completedAt:
                newStatus === "done"
                  ? new Date().toISOString()
                  : previousStatus === "done"
                    ? null
                    : t.dueDate,
            }
          : t
      )
    );

    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    if (!res.ok) {
      // Roll back.
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: previousStatus } : t
        )
      );
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Failed to update task.");
      return;
    }

    if (newStatus === "done") {
      toast.success(`Completed '${task.title}'`);
    } else if (previousStatus === "done") {
      toast.success(`Re-opened '${task.title}'`);
    }

    // Refresh server data so dashboards / activity feeds update.
    router.refresh();
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={columns[status]}
            showProject={showProject}
            currentUser={currentUser}
            isOver={hoverColumn === status}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? (
          <div className="rotate-2">
            <TaskKanbanCard
              task={activeTask}
              showProject={showProject}
              currentUser={currentUser}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
