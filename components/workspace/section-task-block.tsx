"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskListView } from "@/components/tasks/task-list-view";
import { TaskEditSheet } from "@/components/tasks/task-edit-sheet";
import type { TaskSummary } from "@/lib/server-data";

interface SectionTaskBlockProps {
  projectId: string;
  section: string;
  sectionLabel: string;
  items: TaskSummary[];
  currentUser: { id: string; name: string };
}

/**
 * Thin client wrapper around the generic TaskListView + TaskEditSheet for
 * tasks inside a workspace section. Pre-fills the section on the create
 * sheet so new tasks land in the right section.
 */
export function SectionTaskBlock({
  projectId,
  section,
  sectionLabel,
  items,
  currentUser,
}: SectionTaskBlockProps) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      {items.length === 0 ? (
        <div className="border border-dashed rounded-md py-8 px-4 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            No tasks in {sectionLabel} yet.
          </p>
          <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add a task
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <TaskListView
            tasks={items}
            showProject={false}
            currentUser={currentUser}
          />
          <div className="pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add task
            </Button>
          </div>
        </div>
      )}

      <TaskEditSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        projectId={projectId}
        initialSection={section}
        currentUser={currentUser}
      />
    </>
  );
}
