"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { AssigneeAvatar } from "@/components/shared/assignee-avatar";
import { TaskEditSheet } from "./task-edit-sheet";
import { relativeDue } from "@/lib/dates";
import { humanizeSectionKey } from "@/lib/sections";
import { cn } from "@/lib/utils";

export interface TaskRowData {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  section: string | null;
  dueDate: string | null;
  assigneeId: string | null;
  assignee: { id: string; name: string } | null;
  project: { id: string; name: string; role: string };
  /** V0.6 — when false the row is view-only (no drag, no inline edit). */
  canEdit?: boolean;
  /** V0.6 — owner department. */
  departmentId?: string | null;
}

interface TaskRowProps {
  task: TaskRowData;
  showProject?: boolean;
  currentUser: { id: string; name: string };
}

const PRIORITY_ACCENT: Record<string, string> = {
  high: "bg-red-400",
  medium: "bg-amber-400",
  low: "bg-white/20",
};

export function TaskRow({ task, showProject = false, currentUser }: TaskRowProps) {
  const [editOpen, setEditOpen] = useState(false);

  const due = task.dueDate ? new Date(task.dueDate) : null;
  const dueInfo = due ? relativeDue(due) : null;
  const isDone = task.status === "done";

  return (
    <>
      <button
        type="button"
        onClick={() => setEditOpen(true)}
        className={cn(
          "w-full text-left group flex items-center gap-3 pl-2 pr-3 py-2.5 rounded-xl border border-white/[0.04] bg-white/[0.015] hover:bg-white/[0.04] transition-all",
          isDone && "opacity-50"
        )}
      >
        {/* Priority accent strip */}
        <span
          className={cn(
            "h-8 w-0.5 rounded-full",
            PRIORITY_ACCENT[task.priority] ?? "bg-white/20"
          )}
        />

        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-sm font-medium leading-snug truncate",
              isDone && "line-through text-muted-foreground"
            )}
          >
            {task.title}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground flex-wrap">
            {showProject && (
              <span className="truncate">{task.project.name}</span>
            )}
            {task.section && (
              <>
                {showProject && <span className="opacity-30">·</span>}
                <Badge
                  variant="outline"
                  className="bg-white/[0.04] border-white/[0.06] text-[10px] py-0 px-1.5 h-4"
                >
                  {humanizeSectionKey(task.section)}
                </Badge>
              </>
            )}
            {dueInfo && (
              <>
                <span className="opacity-30">·</span>
                <span
                  className={cn(
                    dueInfo.tone === "destructive" &&
                      "text-red-400 font-medium"
                  )}
                >
                  {dueInfo.label}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <AssigneeAvatar assignee={task.assignee} size="xs" />
          <PriorityBadge priority={task.priority} />
          <StatusBadge status={task.status} />
        </div>
      </button>

      <TaskEditSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        task={task}
        currentUser={currentUser}
        readOnly={task.canEdit === false}
      />
    </>
  );
}
