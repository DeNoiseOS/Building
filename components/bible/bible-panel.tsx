"use client";

/**
 * V0.20 — Production Bible panel.
 *
 * Cross-dept reference library. Filter chips at top (All + one chip
 * per department + Direction & Production), card grid below with
 * thumbnails. Pinned entries float to the top of each section.
 *
 * Permissions: the parent server page tells us which sections the
 * caller can write to (via editableDeptIds + canEditDirection); the
 * "Add" button + ⋮ menu visibility derives from that.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Pin,
  PinOff,
  MoreHorizontal,
  Trash2,
  Pencil,
  FileText,
  Link as LinkIcon,
  Image as ImageIcon,
  Video,
  Palette,
  FileType,
  BookOpen,
  ExternalLink,
  Paperclip,
} from "lucide-react";
import { AttachmentList } from "@/components/shared/attachment-list";
import { FileUploader } from "@/components/shared/file-uploader";

export interface BibleEntry {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  body: string | null;
  type: string;
  pinned: boolean;
  createdAt: string;
  department: { id: string; name: string; kind: string } | null;
  addedBy: { id: string; name: string } | null;
}

export interface DeptOption {
  id: string;
  name: string;
  kind: string;
}

const TYPE_LABELS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  note: { label: "Note", icon: FileText },
  link: { label: "Link", icon: LinkIcon },
  image: { label: "Image", icon: ImageIcon },
  document: { label: "Document", icon: FileType },
  video: { label: "Video", icon: Video },
  mood_board: { label: "Mood board", icon: Palette },
  other: { label: "Other", icon: BookOpen },
};

const DIRECTION_KEY = "__direction__";

export function BiblePanel({
  projectId,
  entries,
  departments,
  editableDeptIds,
  canEditDirection,
}: {
  projectId: string;
  entries: BibleEntry[];
  departments: DeptOption[];
  /** Set of department IDs the caller can write to. */
  editableDeptIds: string[];
  /** Whether the caller can write to "Direction & Production". */
  canEditDirection: boolean;
}) {
  const [filter, setFilter] = useState<string>("all");
  const editableSet = useMemo(
    () => new Set(editableDeptIds),
    [editableDeptIds]
  );

  const filtered = useMemo(() => {
    if (filter === "all") return entries;
    if (filter === DIRECTION_KEY)
      return entries.filter((e) => e.department === null);
    return entries.filter((e) => e.department?.id === filter);
  }, [entries, filter]);

  function canEditEntry(e: BibleEntry): boolean {
    if (e.department === null) return canEditDirection;
    return editableSet.has(e.department.id);
  }

  const totalEditableSections =
    editableDeptIds.length + (canEditDirection ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Production Bible</h2>
          <p className="text-sm text-muted-foreground">
            Shared reference library. Every department contributes;
            everyone can browse.
          </p>
        </div>
        {totalEditableSections > 0 && (
          <AddEntryButton
            projectId={projectId}
            departments={departments.filter((d) => editableSet.has(d.id))}
            canEditDirection={canEditDirection}
          />
        )}
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Chip
          label={`All · ${entries.length}`}
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        <Chip
          label={`Direction & Production · ${entries.filter((e) => e.department === null).length}`}
          active={filter === DIRECTION_KEY}
          onClick={() => setFilter(DIRECTION_KEY)}
        />
        {departments.map((d) => {
          const count = entries.filter((e) => e.department?.id === d.id).length;
          return (
            <Chip
              key={d.id}
              label={`${d.name} · ${count}`}
              active={filter === d.id}
              onClick={() => setFilter(d.id)}
            />
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.08] py-16 text-center">
          <BookOpen className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {entries.length === 0
              ? "Nothing in the Bible yet. Heads can start adding references for their departments."
              : "No entries in this section yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((e) => (
            <BibleCard
              key={e.id}
              projectId={projectId}
              entry={e}
              canEdit={canEditEntry(e)}
              departments={departments}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center px-3 h-8 rounded-full text-xs transition-colors border ${
        active
          ? "bg-primary/15 border-primary/30 text-primary"
          : "bg-white/[0.02] border-white/[0.06] text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function BibleCard({
  projectId,
  entry,
  canEdit,
  departments,
}: {
  projectId: string;
  entry: BibleEntry;
  canEdit: boolean;
  departments: DeptOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const TypeIcon = TYPE_LABELS[entry.type]?.icon ?? BookOpen;

  function togglePin() {
    startTransition(async () => {
      const res = await fetch(`/api/projects/${projectId}/bible/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !entry.pinned }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error ?? "Failed.");
        return;
      }
      router.refresh();
    });
  }
  function handleDelete() {
    startTransition(async () => {
      const res = await fetch(`/api/projects/${projectId}/bible/${entry.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error ?? "Failed.");
        return;
      }
      toast.success("Removed.");
      router.refresh();
    });
  }

  const isImage =
    entry.type === "image" || entry.type === "mood_board";
  const showThumbnail = isImage && entry.url;

  return (
    <>
      <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft overflow-hidden flex flex-col group">
        {showThumbnail ? (
          <a
            href={entry.url!}
            target="_blank"
            rel="noopener noreferrer"
            className="block relative aspect-video bg-black/40 overflow-hidden"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={entry.url!}
              alt={entry.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            {entry.pinned && (
              <Badge
                variant="outline"
                className="absolute top-2 left-2 bg-black/60 backdrop-blur border-white/10 text-white text-[10px] gap-1"
              >
                <Pin className="h-3 w-3" />
                Pinned
              </Badge>
            )}
          </a>
        ) : (
          <div className="px-4 pt-4 pb-2 flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <TypeIcon className="h-4 w-4" />
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex-1">
              {TYPE_LABELS[entry.type]?.label ?? entry.type}
            </div>
            {entry.pinned && (
              <Pin className="h-3.5 w-3.5 text-amber-300" />
            )}
          </div>
        )}

        <div className="p-4 flex-1 flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              {entry.url && !showThumbnail ? (
                <a
                  href={entry.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium leading-tight hover:text-primary inline-flex items-center gap-1.5"
                >
                  {entry.title}
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </a>
              ) : (
                <div className="font-medium leading-tight">{entry.title}</div>
              )}
            </div>
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 -mt-1 -mr-1">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => setEditOpen(true)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={togglePin} disabled={pending}>
                    {entry.pinned ? (
                      <>
                        <PinOff className="h-4 w-4 mr-2" />
                        Unpin
                      </>
                    ) : (
                      <>
                        <Pin className="h-4 w-4 mr-2" />
                        Pin to top
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {entry.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {entry.description}
            </p>
          )}
          {entry.body && (
            <p className="text-xs text-foreground/85 whitespace-pre-wrap line-clamp-4">
              {entry.body}
            </p>
          )}
          {/* V0.23 — file attachments on this entry */}
          <div className="space-y-1.5">
            <AttachmentList
              projectId={projectId}
              ownerType="bible"
              ownerId={entry.id}
              canDelete={canEdit}
            />
            {canEdit && (
              <details className="text-[11px]">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                  <Paperclip className="h-3 w-3" />
                  Attach a file
                </summary>
                <div className="mt-2">
                  <FileUploader
                    projectId={projectId}
                    ownerType="bible"
                    ownerId={entry.id}
                    hideUrlPaste
                    label="Drop a PDF, image, or doc."
                  />
                </div>
              </details>
            )}
          </div>
          <div className="mt-auto pt-2 text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className="text-[10px] bg-white/[0.04]">
              {entry.department?.name ?? "Direction & Production"}
            </Badge>
            {entry.addedBy && <span>· {entry.addedBy.name}</span>}
          </div>
        </div>
      </div>

      <EntryEditSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        projectId={projectId}
        entry={entry}
        departments={departments}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{entry.title}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes it from the Production Bible. Other content
              isn&apos;t affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={pending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {pending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* -------- Add / Edit sheets share form scaffolding -------- */

function AddEntryButton({
  projectId,
  departments,
  canEditDirection,
}: {
  projectId: string;
  departments: DeptOption[];
  canEditDirection: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add entry
        </Button>
      </SheetTrigger>
      <EntryForm
        projectId={projectId}
        departments={departments}
        canEditDirection={canEditDirection}
        onDone={() => setOpen(false)}
      />
    </Sheet>
  );
}

function EntryEditSheet({
  open,
  onOpenChange,
  projectId,
  entry,
  departments,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  entry: BibleEntry;
  departments: DeptOption[];
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <EntryForm
        projectId={projectId}
        departments={departments}
        canEditDirection={true}
        existing={entry}
        onDone={() => onOpenChange(false)}
      />
    </Sheet>
  );
}

function EntryForm({
  projectId,
  departments,
  canEditDirection,
  existing,
  onDone,
}: {
  projectId: string;
  departments: DeptOption[];
  canEditDirection: boolean;
  existing?: BibleEntry;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [url, setUrl] = useState(existing?.url ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [type, setType] = useState(existing?.type ?? "link");
  const [departmentId, setDepartmentId] = useState<string>(
    existing
      ? existing.department?.id ?? DIRECTION_KEY
      : canEditDirection
        ? DIRECTION_KEY
        : departments[0]?.id ?? DIRECTION_KEY
  );
  const [pinned, setPinned] = useState(existing?.pinned ?? false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return toast.error("Title is required.");
    if (!url.trim() && !body.trim()) {
      return toast.error("Add either a URL or a text body (or both).");
    }
    startTransition(async () => {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        url: url.trim() || null,
        body: body.trim() || null,
        type,
        pinned,
        departmentId:
          departmentId === DIRECTION_KEY ? null : departmentId,
      };
      const res = await fetch(
        existing
          ? `/api/projects/${projectId}/bible/${existing.id}`
          : `/api/projects/${projectId}/bible`,
        {
          method: existing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed.");
        return;
      }
      toast.success(existing ? "Updated." : "Added to the Bible.");
      onDone();
      router.refresh();
    });
  }

  return (
    <SheetContent className="w-full sm:max-w-md flex flex-col">
      <form onSubmit={submit} className="flex h-full flex-col">
        <SheetHeader>
          <SheetTitle>
            {existing ? "Edit entry" : "Add to Production Bible"}
          </SheetTitle>
          <SheetDescription>
            URL paste for now. File upload coming later.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="space-y-2">
            <Label>Section</Label>
            <Select
              value={departmentId}
              onValueChange={setDepartmentId}
              disabled={!!existing}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {canEditDirection && (
                  <SelectItem value={DIRECTION_KEY}>
                    Direction & Production
                  </SelectItem>
                )}
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
              placeholder="e.g. Café interior mood board"
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>URL (image, PDF, Drive, etc.)</Label>
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              maxLength={800}
            />
          </div>
          <div className="space-y-2">
            <Label>Text note</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              maxLength={20_000}
              placeholder="Optional long-form note (director's statement, etc.)"
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              placeholder="Short caption shown on the card."
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="rounded"
            />
            Pin to top of this section
          </label>
        </div>
        <SheetFooter>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : existing ? "Save" : "Add"}
          </Button>
        </SheetFooter>
      </form>
    </SheetContent>
  );
}
