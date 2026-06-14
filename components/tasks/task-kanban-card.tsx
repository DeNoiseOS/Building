"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Pencil, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { AssigneeAvatar } from "@/components/shared/assignee-avatar";
import { TaskEditSheet } from "./task-edit-sheet";
import { relativeDue } from "@/lib/dates";
import { humanizeSectionKey } from "@/lib/sections";
import { cn } from "@/lib/utils";
import type { TaskRowData } from "./task-row";

interface TaskKanbanCardProps {
  task: TaskRowData;
  showProject?: boolean;
  currentUser: { id: string; name: string };
}

const PRIORITY_BAR: Record<string, string> = {
  high: "bg-gradient-to-r from-red-400 to-rose-500",
  medium: "bg-gradient-to-r from-amber-400 to-orange-500",
  low: "bg-white/10",
};

export function TaskKanbanCard({
  task,
  showProject = false,
  currentUser,
}: TaskKanbanCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const readOnly = task.canEdit === false;
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: task.id,
      data: { task },
      disabled: readOnly,
    });

  const due = task.dueDate ? new Date(task.dueDate) : null;
  const dueInfo = due ? relativeDue(due) : null;

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "group relative rounded-xl border border-white/[0.06] bg-card/80 backdrop-blur-sm overflow-hidden",
          readOnly
            ? "cursor-default opacity-70"
            : "cursor-grab active:cursor-grabbing touch-none select-none",
          "shadow-soft hover:shadow-hover hover:border-white/[0.1] transition-all",
          isDragging && "ring-2 ring-primary/40 border-primary/30 shadow-hover"
        )}
        {...(!readOnly ? listeners : {})}
        {...(!readOnly ? attributes : {})}
        onClick={readOnly ? () => setEditOpen(true) : undefined}
      >
        {/* Priority accent strip */}
        <div
          className={cn(
            "absolute top-0 left-0 right-0 h-0.5",
            PRIORITY_BAR[task.priority] ?? "bg-white/10"
          )}
        />

        <div className="p-3 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-sm leading-snug line-clamp-2 flex-1">
              {task.title}
            </p>
            {readOnly ? (
              <span
                className="shrink-0 p-1 text-muted-foreground/70"
                title="View only — outside your edit scope"
              >
                <Lock className="h-3 w-3" />
              </span>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditOpen(true);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1 rounded-md hover:bg-white/[0.06]"
                aria-label={`Edit ${task.title}`}
              >
                <Pencil className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <PriorityBadge priority={task.priority} />
            {task.section && (
              <Badge
                variant="outline"
                className="bg-white/[0.04] border-white/[0.06] text-[10px] py-0 px-1.5 h-4"
              >
                {humanizeSectionKey(task.section)}
              </Badge>
            )}
          </div>

          {(showProject || dueInfo || task.assignee) && (
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground pt-1 border-t border-white/[0.03]">
              {showProject && task.project ? (
                <span className="truncate flex-1 mt-2">
                  {task.project.name}
                </span>
              ) : (
                <span className="flex-1" />
              )}
              <div className="flex items-center gap-1.5 shrink-0 mt-2">
                {dueInfo && (
                  <span
                    className={cn(
                      dueInfo.tone === "destructive" &&
                        "text-red-400 font-medium"
                    )}
                  >
                    {dueInfo.label}
                  </span>
                )}
                <AssigneeAvatar assignee={task.assignee} size="xs" />
              </div>
            </div>
          )}
        </div>
      </div>

      <TaskEditSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        task={task}
        currentUser={currentUser}
        readOnly={readOnly}
      />
    </>
  );
}
