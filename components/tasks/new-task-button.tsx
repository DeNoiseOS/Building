"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskEditSheet, type ProjectChoice } from "./task-edit-sheet";
import { cn } from "@/lib/utils";

interface NewTaskButtonProps {
  /** When inside a project context, pass projectId so the sheet is pre-bound. */
  projectId?: string;
  /** When on the global Tasks page, pass the user's projects for a picker. */
  projectChoices?: ProjectChoice[];
  /** Pre-set section when launched from a workspace section header. */
  initialSection?: string;
  currentUser: { id: string; name: string };
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  label?: string;
  className?: string;
}

export function NewTaskButton({
  projectId,
  projectChoices,
  initialSection,
  currentUser,
  variant = "default",
  size = "default",
  label = "New Task",
  className,
}: NewTaskButtonProps) {
  const [open, setOpen] = useState(false);

  const disabled =
    !projectId && (!projectChoices || projectChoices.length === 0);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        className={cn(
          variant === "default" &&
            "bg-gradient-to-br from-primary to-violet-600 hover:from-primary/95 hover:to-violet-600/95 text-white border-0 shadow-soft",
          className
        )}
        disabled={disabled}
        title={
          disabled
            ? "Create a project first to add tasks."
            : undefined
        }
      >
        <Plus className="h-4 w-4 mr-1.5" />
        {label}
      </Button>
      <TaskEditSheet
        open={open}
        onOpenChange={setOpen}
        mode="create"
        projectId={projectId}
        projectChoices={projectChoices}
        initialSection={initialSection}
        currentUser={currentUser}
      />
    </>
  );
}
