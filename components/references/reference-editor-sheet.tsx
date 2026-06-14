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

interface ReferenceEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: Mode;
  projectId: string;
  section: string;
  sectionLabel: string;
  reference?: {
    id: string;
    title: string;
    description: string | null;
    imageUrl: string | null;
    link: string | null;
    section: string;
  };
}

export function ReferenceEditorSheet({
  open,
  onOpenChange,
  mode,
  projectId,
  section,
  sectionLabel,
  reference,
}: ReferenceEditorSheetProps) {
  const router = useRouter();
  const [title, setTitle] = useState(reference?.title ?? "");
  const [description, setDescription] = useState(reference?.description ?? "");
  const [imageUrl, setImageUrl] = useState(reference?.imageUrl ?? "");
  const [link, setLink] = useState(reference?.link ?? "");
  const [loading, setLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(reference?.title ?? "");
    setDescription(reference?.description ?? "");
    setImageUrl(reference?.imageUrl ?? "");
    setLink(reference?.link ?? "");
  }, [open, reference]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required.");
      return;
    }
    setLoading(true);
    const url =
      mode === "create" ? "/api/references" : `/api/references/${reference?.id}`;
    const method = mode === "create" ? "POST" : "PATCH";
    const payload =
      mode === "create"
        ? {
            projectId,
            title: title.trim(),
            description: description.trim() || null,
            imageUrl: imageUrl.trim() || null,
            link: link.trim() || null,
            section,
          }
        : {
            title: title.trim(),
            description: description.trim() || null,
            imageUrl: imageUrl.trim() || null,
            link: link.trim() || null,
          };

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Failed to save reference.");
      return;
    }

    toast.success(mode === "create" ? "Reference added." : "Reference saved.");
    onOpenChange(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!reference?.id) return;
    setDeletePending(true);
    const res = await fetch(`/api/references/${reference.id}`, {
      method: "DELETE",
    });
    setDeletePending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Failed to delete reference.");
      return;
    }
    toast.success("Reference deleted.");
    setDeleteOpen(false);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md flex flex-col">
          <SheetHeader>
            <SheetTitle>
              {mode === "create" ? "New Reference" : "Edit Reference"}
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
              <Label htmlFor="ref-title">Title</Label>
              <Input
                id="ref-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
                maxLength={200}
                placeholder="What is this reference?"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ref-image">Image URL</Label>
              <Input
                id="ref-image"
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://…"
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground">
                Paste a link to an image. File upload arrives in a later phase.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ref-link">Source link</Label>
              <Input
                id="ref-link"
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://…"
                maxLength={2000}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ref-description">Description</Label>
              <Textarea
                id="ref-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Optional context for this reference."
              />
            </div>
          </form>

          <SheetFooter className="border-t flex-row justify-between">
            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={loading}>
                {loading
                  ? "Saving..."
                  : mode === "create"
                    ? "Add Reference"
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
                aria-label="Delete reference"
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
            <AlertDialogTitle>Delete this reference?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the reference. This action cannot be
              undone.
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
