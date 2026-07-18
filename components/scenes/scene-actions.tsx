"use client";

/**
 * V0.17.1 — Scene actions menu for Director / AD / Producer / EP / Owner.
 *
 * Status change + Edit + Delete. Lives in the scene detail header.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2, MoreHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileUploader } from "@/components/shared/file-uploader";
import { AttachmentList } from "@/components/shared/attachment-list";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import {
  SCENE_STATUS,
  SCENE_TYPES,
  SCENE_TIME_OF_DAY,
} from "@/lib/scene-data";

interface SceneShape {
  id: string;
  number: string;
  title: string;
  description: string | null;
  location: string | null;
  type: string;
  timeOfDay: string;
  status: string;
  notes: string | null;
  attachments: Array<{ title: string; url: string }>;
  /** V0.19 — Gallery thumbnail. Only Director/AD can set this. */
  coverImageUrl: string | null;
}

export function SceneActions({
  projectId,
  scene,
}: {
  projectId: string;
  scene: SceneShape;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [status, setStatus] = useState(scene.status);

  function changeStatus(next: string) {
    setStatus(next);
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/scenes/${scene.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to update status.");
        setStatus(scene.status);
        return;
      }
      toast.success("Status updated.");
      router.refresh();
    });
  }

  async function handleDelete() {
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/scenes/${scene.id}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to delete.");
        return;
      }
      toast.success("Scene deleted.");
      router.push(`/projects/${projectId}/scenes`);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Select value={status} onValueChange={changeStatus} disabled={pending}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCENE_STATUS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit scene
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete scene
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <SceneEditSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        projectId={projectId}
        scene={scene}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete scene #{scene.number}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the scene and every department workspace under
              it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={pending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {pending ? "Deleting…" : "Delete scene"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SceneEditSheet({
  open,
  onOpenChange,
  projectId,
  scene,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  scene: SceneShape;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [number, setNumber] = useState(scene.number);
  const [title, setTitle] = useState(scene.title);
  const [location, setLocation] = useState(scene.location ?? "");
  const [description, setDescription] = useState(scene.description ?? "");
  const [notes, setNotes] = useState(scene.notes ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(scene.coverImageUrl ?? "");
  const [type, setType] = useState(scene.type);
  const [timeOfDay, setTimeOfDay] = useState(scene.timeOfDay);
  const [attachments, setAttachments] = useState<
    Array<{ title: string; url: string }>
  >(scene.attachments ?? []);
  const [attTitle, setAttTitle] = useState("");
  const [attUrl, setAttUrl] = useState("");
  const [filesRefreshKey, setFilesRefreshKey] = useState(0);

  function addAttachment() {
    if (!attTitle.trim() || !attUrl.trim()) return;
    try {
      new URL(attUrl.trim());
    } catch {
      return toast.error("Attachment URL is not a valid URL.");
    }
    setAttachments((cur) => [
      ...cur,
      { title: attTitle.trim(), url: attUrl.trim() },
    ]);
    setAttTitle("");
    setAttUrl("");
  }

  function removeAttachment(i: number) {
    setAttachments((cur) => cur.filter((_, idx) => idx !== i));
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!number.trim() || !title.trim()) {
      return toast.error("Number and title are required.");
    }
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/scenes/${scene.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            number: number.trim(),
            title: title.trim(),
            location: location.trim() || null,
            description: description.trim() || null,
            notes: notes.trim() || null,
            coverImageUrl: coverImageUrl.trim() || null,
            type,
            timeOfDay,
            attachments,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save.");
        return;
      }
      toast.success("Scene updated.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <form onSubmit={save} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>Edit scene #{scene.number}</SheetTitle>
            <SheetDescription>
              Updates apply immediately.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ed-num">Number</Label>
                <Input
                  id="ed-num"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  required
                  maxLength={20}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="ed-title">Title</Label>
                <Input
                  id="ed-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  maxLength={200}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ed-loc">Location</Label>
              <Input
                id="ed-loc"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SCENE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Time of day</Label>
                <Select value={timeOfDay} onValueChange={setTimeOfDay}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SCENE_TIME_OF_DAY.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ed-desc">Description</Label>
              <Textarea
                id="ed-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={4000}
              />
            </div>
            {/* V0.19 — Gallery cover image (Director/AD only). V0.27 —
                upload or paste a URL, instead of URL-paste only. */}
            <div className="space-y-2">
              <Label>Gallery thumbnail</Label>
              {coverImageUrl && (
                <div className="relative rounded-md overflow-hidden border border-white/[0.06] bg-black/40 aspect-video">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverImageUrl}
                    alt="Cover preview"
                    className="w-full h-full object-cover"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={() => setCoverImageUrl("")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              <FileUploader
                projectId={projectId}
                ownerType="scene_cover"
                ownerId={scene.id}
                multiple={false}
                accept="image/*"
                label="Drop an image, or click to browse"
                onUploaded={(a) => setCoverImageUrl(a.url ?? "")}
                onUrlPaste={(url) => setCoverImageUrl(url)}
              />
              <p className="text-[11px] text-muted-foreground">
                Shown in the Scenes gallery view. Only Director / AD can set
                this.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ed-notes">Notes</Label>
              <Textarea
                id="ed-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={4000}
                placeholder="Production notes for everyone working this scene."
              />
            </div>

            {/* V0.17.1 — Attachments (URL paste) */}
            <div className="space-y-2">
              <Label>Attachments</Label>
              <div className="space-y-2">
                {attachments.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{a.title}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {a.url}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAttachment(i)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  value={attTitle}
                  onChange={(e) => setAttTitle(e.target.value)}
                  placeholder="Title"
                  maxLength={120}
                />
                <Input
                  value={attUrl}
                  onChange={(e) => setAttUrl(e.target.value)}
                  placeholder="https://… (image, PDF, doc)"
                  type="url"
                  className="col-span-2"
                  maxLength={800}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAttachment}
              >
                Add attachment
              </Button>
              <p className="text-[11px] text-muted-foreground">
                For external links (image hosts, Drive, Dropbox). For files
                from this device, use Files below.
              </p>
            </div>

            {/* V0.27 — Real file uploads (images, PDFs, docs) for this scene. */}
            <div className="space-y-2">
              <Label>Files</Label>
              <AttachmentList
                projectId={projectId}
                ownerType="scene"
                ownerId={scene.id}
                canDelete
                refreshKey={filesRefreshKey}
              />
              <FileUploader
                projectId={projectId}
                ownerType="scene"
                ownerId={scene.id}
                label="Drop images, PDFs, or docs, or click to browse"
                hideUrlPaste
                onUploaded={() => setFilesRefreshKey((k) => k + 1)}
              />
            </div>
          </div>
          <SheetFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
