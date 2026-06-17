"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { EditProjectSheet } from "./edit-project-sheet";

interface ProjectActionsMenuProps {
  project: {
    id: string;
    name: string;
    description: string | null;
    role: string;
    startDate: string;
    endDate: string;
    status: string;
  };
  /** V0.12.1 — gates Edit + Archive. Server enforces too. */
  canEdit?: boolean;
  /** V0.12.1 — owner-only. Hides Delete when false. */
  canDelete?: boolean;
}

export function ProjectActionsMenu({
  project,
  canEdit = false,
  canDelete = false,
}: ProjectActionsMenuProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [archivePending, setArchivePending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);

  const isArchived = project.status === "archived";

  async function handleArchiveToggle() {
    setArchivePending(true);
    const res = await fetch(`/api/projects/${project.id}/archive`, {
      method: "POST",
    });
    setArchivePending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Failed to update project status.");
      return;
    }
    toast.success(isArchived ? "Project restored." : "Project archived.");
    router.refresh();
  }

  async function handleDelete() {
    setDeletePending(true);
    const res = await fetch(`/api/projects/${project.id}`, {
      method: "DELETE",
    });
    setDeletePending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Failed to delete project.");
      return;
    }
    toast.success("Project deleted.");
    setDeleteOpen(false);
    router.push("/projects");
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
            className="gap-2"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        )}

        {(canEdit || canDelete) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {canEdit && (
                <DropdownMenuItem
                  onClick={handleArchiveToggle}
                  disabled={archivePending}
                >
                  {isArchived ? (
                    <>
                      <ArchiveRestore className="h-4 w-4 mr-2" />
                      Restore project
                    </>
                  ) : (
                    <>
                      <Archive className="h-4 w-4 mr-2" />
                      Archive project
                    </>
                  )}
                </DropdownMenuItem>
              )}
              {canEdit && canDelete && <DropdownMenuSeparator />}
              {canDelete && (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete project
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <EditProjectSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <strong>{project.name}</strong> along with
              every task, note, reference, and activity entry attached to it.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deletePending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deletePending ? "Deleting..." : "Delete project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
