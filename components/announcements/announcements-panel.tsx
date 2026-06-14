"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Megaphone,
  Plus,
  Pin,
  PinOff,
  Trash2,
  Pencil,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface Announcement {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  expiresAt: string | null;
  author: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

interface Props {
  projectId: string;
  canManage: boolean;
  currentUser: { id: string; name: string };
  announcements: Announcement[];
}

function relative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function AnnouncementsPanel({
  projectId,
  canManage,
  currentUser,
  announcements,
}: Props) {
  void currentUser;
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Announcement | null>(null);

  return (
    <div className="space-y-6 pt-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Announcements</h2>
            <p className="text-sm text-muted-foreground">
              Official communication from owner / producer / director.
            </p>
          </div>
        </div>
        {canManage && (
          <Button className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New announcement
          </Button>
        )}
      </div>

      {announcements.length === 0 ? (
        <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft p-10 text-center">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
            <Megaphone className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold">
            No announcements yet
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {canManage
              ? "Post one to broadcast it to every project member."
              : "Important project notices will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <AnnouncementCard
              key={a.id}
              projectId={projectId}
              announcement={a}
              canManage={canManage}
              onEdit={() => setEditTarget(a)}
            />
          ))}
        </div>
      )}

      {canManage && (
        <AnnouncementSheet
          open={createOpen}
          onOpenChange={setCreateOpen}
          projectId={projectId}
          mode="create"
        />
      )}
      {canManage && editTarget && (
        <AnnouncementSheet
          open={!!editTarget}
          onOpenChange={(v) => !v && setEditTarget(null)}
          projectId={projectId}
          mode="edit"
          announcement={editTarget}
        />
      )}
    </div>
  );
}

function AnnouncementCard({
  projectId,
  announcement,
  canManage,
  onEdit,
}: {
  projectId: string;
  announcement: Announcement;
  canManage: boolean;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function togglePin() {
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/announcements/${announcement.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pinned: !announcement.pinned }),
        }
      );
      if (!res.ok) {
        toast.error("Failed to update pin.");
        return;
      }
      toast.success(announcement.pinned ? "Unpinned." : "Pinned.");
      router.refresh();
    });
  }

  async function remove() {
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/announcements/${announcement.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        toast.error("Failed to delete.");
        return;
      }
      toast.success("Deleted.");
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {announcement.pinned && (
              <Badge
                variant="outline"
                className="border-primary/30 bg-primary/10 text-primary gap-1"
              >
                <Pin className="h-3 w-3" />
                Pinned
              </Badge>
            )}
            <h3 className="text-base font-semibold tracking-tight">
              {announcement.title}
            </h3>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1">
            <span>{announcement.author.name}</span>
            <span>·</span>
            <span>{relative(announcement.createdAt)}</span>
            {announcement.expiresAt && (
              <>
                <span>·</span>
                <Clock className="h-3 w-3" />
                <span>
                  Expires{" "}
                  {new Date(announcement.expiresAt).toLocaleDateString()}
                </span>
              </>
            )}
          </div>
          <p className="text-sm whitespace-pre-wrap mt-3 text-foreground/85">
            {announcement.body}
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePin}
              disabled={pending}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              aria-label={announcement.pinned ? "Unpin" : "Pin"}
            >
              {announcement.pinned ? (
                <PinOff className="h-3.5 w-3.5" />
              ) : (
                <Pin className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onEdit}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              aria-label="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={remove}
              disabled={pending}
              className="h-7 w-7 text-muted-foreground hover:text-red-300"
              aria-label="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function AnnouncementSheet({
  open,
  onOpenChange,
  projectId,
  mode,
  announcement,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  mode: "create" | "edit";
  announcement?: Announcement;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(announcement?.title ?? "");
  const [body, setBody] = useState(announcement?.body ?? "");
  const [pinned, setPinned] = useState(announcement?.pinned ?? false);
  const [expiresAt, setExpiresAt] = useState(
    announcement?.expiresAt ? announcement.expiresAt.slice(0, 10) : ""
  );
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast.error("Title and body are required.");
      return;
    }
    const payload = {
      title: title.trim(),
      body: body.trim(),
      pinned,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    };
    startTransition(async () => {
      const url =
        mode === "create"
          ? `/api/projects/${projectId}/announcements`
          : `/api/projects/${projectId}/announcements/${announcement?.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save.");
        return;
      }
      toast.success(mode === "create" ? "Announcement posted." : "Updated.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <form onSubmit={submit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>
              {mode === "create" ? "New announcement" : "Edit announcement"}
            </SheetTitle>
            <SheetDescription>
              Broadcasts to every project member as a notification.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 px-5 py-4 overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="ann-title">Title</Label>
              <Input
                id="ann-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Client review moved to Thursday"
                required
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ann-body">Body</Label>
              <Textarea
                id="ann-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                maxLength={10000}
                placeholder="The full announcement…"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-start gap-2 rounded-lg bg-white/[0.03] border border-white/[0.05] px-3 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-[12px]">
                  <span className="font-medium">Pin</span>
                  <span className="block text-[11px] text-muted-foreground">
                    Sort to top.
                  </span>
                </span>
              </label>
              <div className="space-y-1.5">
                <Label htmlFor="ann-exp">Expires (optional)</Label>
                <Input
                  id="ann-exp"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            </div>
          </div>
          <SheetFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : mode === "create" ? "Post" : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
