"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

type Mode = "create" | "edit";

interface NoteEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: Mode;
  projectId: string;
  /** Workspace section this note belongs to. Required for both create and edit. */
  section: string;
  sectionLabel: string;
  /** When editing, the existing note. */
  note?: {
    id: string;
    title: string;
    body: string;
    section: string;
  };
}

export function NoteEditorSheet({
  open,
  onOpenChange,
  mode,
  projectId,
  section,
  sectionLabel,
  note,
}: NoteEditorSheetProps) {
  const router = useRouter();
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [loading, setLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(note?.title ?? "");
    setBody(note?.body ?? "");
  }, [open, note]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required.");
      return;
    }
    setLoading(true);
    const url = mode === "create" ? "/api/notes" : `/api/notes/${note?.id}`;
    const method = mode === "create" ? "POST" : "PATCH";
    const payload =
      mode === "create"
        ? { projectId, title: title.trim(), body, section }
        : { title: title.trim(), body };

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Failed to save note.");
      return;
    }

    toast.success(mode === "create" ? "Note added." : "Note saved.");
    onOpenChange(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!note?.id) return;
    setDeletePending(true);
    const res = await fetch(`/api/notes/${note.id}`, { method: "DELETE" });
    setDeletePending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Failed to delete note.");
      return;
    }
    toast.success("Note deleted.");
    setDeleteOpen(false);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col">
          <SheetHeader>
            <SheetTitle>
              {mode === "create" ? "New Note" : "Edit Note"}
            </SheetTitle>
            <SheetDescription>
              In <span className="font-medium">{sectionLabel}</span>
            </SheetDescription>
          </SheetHeader>

          <form
            onSubmit={handleSubmit}
            className="flex-1 flex flex-col gap-4 px-4 overflow-y-auto"
          >
            <div className="space-y-2">
              <Label htmlFor="note-title">Title</Label>
              <Input
                id="note-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
                maxLength={200}
                placeholder="What is this note about?"
              />
            </div>

            <div className="space-y-2 flex-1 flex flex-col">
              <Label htmlFor="note-body">Body</Label>
              <Textarea
                id="note-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Capture the thought here. Plain text for V0.1."
                rows={12}
                maxLength={20000}
                className="flex-1 min-h-[200px]"
              />
            </div>
          </form>

          <SheetFooter className="border-t flex-row justify-between">
            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={loading}>
                {loading
                  ? "Saving..."
                  : mode === "create"
                    ? "Add Note"
                    : "Save"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
            {mode === "edit" && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setDeleteOpen(true)}
                aria-label="Delete note"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the note. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deletePending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deletePending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
