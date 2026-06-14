"use client";

import { useEffect, useState, useTransition, useRef, useMemo } from "react";
import { toast } from "sonner";
import { MessageCircle, Send, Trash2, Pencil, Check, X, CornerDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { bodySegments } from "@/lib/mentions";

export type CommentTargetType =
  | "task"
  | "purchase_request"
  | "budget_allocation"
  | "note"
  | "reference"
  | "department_discussion"
  | "announcement";

interface CommentItem {
  id: string;
  authorId: string;
  author: { id: string; name: string };
  body: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MentionableMember {
  id: string;
  name: string;
}

interface Props {
  targetType: CommentTargetType;
  targetId: string;
  currentUser: { id: string; name: string };
  /**
   * Optional project ID to populate the @-mention autocomplete.
   * If omitted, mentions are still typeable but no picker assistance.
   */
  projectId?: string;
  compact?: boolean;
  /** Allow replies — defaults to true for department discussions. */
  allowReplies?: boolean;
}

function relative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.round(diff / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function RenderedBody({ body }: { body: string }) {
  const segs = bodySegments(body);
  return (
    <p className="text-sm whitespace-pre-wrap mt-0.5">
      {segs.map((s, i) =>
        s.type === "text" ? (
          <span key={i}>{s.value}</span>
        ) : (
          <span
            key={i}
            className="inline-flex items-center px-1 rounded bg-primary/15 text-primary text-[12px] font-medium"
          >
            @{s.name}
          </span>
        )
      )}
    </p>
  );
}

export function CommentThread({
  targetType,
  targetId,
  currentUser,
  projectId,
  compact = false,
  allowReplies = false,
}: Props) {
  const [items, setItems] = useState<CommentItem[]>([]);
  const [members, setMembers] = useState<MentionableMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/comments?targetType=${targetType}&targetId=${targetId}`)
      .then((r) => (r.ok ? r.json() : { comments: [] }))
      .then((j) => {
        if (cancelled) return;
        setItems(j.comments ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [targetType, targetId]);

  // V0.7 — load mentionable members for autocomplete.
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    fetch(`/api/projects/${projectId}/members`)
      .then((r) => (r.ok ? r.json() : { members: [] }))
      .then((j) => {
        if (cancelled) return;
        const list: MentionableMember[] = (j.members ?? []).map(
          (m: { userId: string; name: string }) => ({
            id: m.userId,
            name: m.name,
          })
        );
        setMembers(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function refresh() {
    const j = await fetch(
      `/api/comments?targetType=${targetType}&targetId=${targetId}`
    ).then((r) => r.json());
    setItems(j.comments ?? []);
  }

  function send(parentId: string | null) {
    if (!draft.trim()) return;
    startTransition(async () => {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId,
          body: draft.trim(),
          parentId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to post.");
        return;
      }
      setDraft("");
      await refresh();
    });
  }

  // Group: top-level + replies map.
  const grouped = useMemo(() => {
    const tops: CommentItem[] = [];
    const repliesByParent = new Map<string, CommentItem[]>();
    for (const c of items) {
      if (c.parentId) {
        const arr = repliesByParent.get(c.parentId) ?? [];
        arr.push(c);
        repliesByParent.set(c.parentId, arr);
      } else {
        tops.push(c);
      }
    }
    return { tops, repliesByParent };
  }, [items]);

  return (
    <div
      className={cn(
        "space-y-3",
        !compact && "rounded-2xl border border-white/[0.05] bg-card/40 p-4"
      )}
    >
      <div className="flex items-center gap-2 text-sm">
        <MessageCircle className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">Comments</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          ({items.length})
        </span>
      </div>

      <div className="space-y-2">
        {loading ? (
          <p className="text-xs text-muted-foreground py-2">Loading…</p>
        ) : grouped.tops.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            No comments yet. Start the discussion.
          </p>
        ) : (
          grouped.tops.map((c) => (
            <div key={c.id} className="space-y-1.5">
              <CommentRow
                comment={c}
                isMine={c.authorId === currentUser.id}
                onChange={refresh}
              />
              {(grouped.repliesByParent.get(c.id) ?? []).map((r) => (
                <div key={r.id} className="pl-8">
                  <CommentRow
                    comment={r}
                    isMine={r.authorId === currentUser.id}
                    onChange={refresh}
                  />
                </div>
              ))}
              {allowReplies && (
                <ReplyComposer
                  targetType={targetType}
                  targetId={targetId}
                  parentId={c.id}
                  members={members}
                  onSent={refresh}
                />
              )}
            </div>
          ))
        )}
      </div>

      <div className="space-y-2">
        <MentionTextarea
          ref={textareaRef}
          value={draft}
          onChange={setDraft}
          members={members}
          placeholder="Add a comment… type @ to mention someone"
          rows={2}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => send(null)}
            disabled={pending || !draft.trim()}
          >
            <Send className="h-3 w-3" />
            Send
          </Button>
        </div>
      </div>
    </div>
  );

  function CommentRow({
    comment,
    isMine,
    onChange,
  }: {
    comment: CommentItem;
    isMine: boolean;
    onChange: () => void;
  }) {
    const [editing, setEditing] = useState(false);
    const [editDraft, setEditDraft] = useState(comment.body);
    const [rowPending, rowTransition] = useTransition();

    async function save() {
      rowTransition(async () => {
        const res = await fetch(`/api/comments/${comment.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: editDraft.trim() }),
        });
        if (!res.ok) {
          toast.error("Failed to update.");
          return;
        }
        setEditing(false);
        onChange();
      });
    }
    async function remove() {
      rowTransition(async () => {
        const res = await fetch(`/api/comments/${comment.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          toast.error("Failed to delete.");
          return;
        }
        onChange();
      });
    }

    return (
      <div className="flex items-start gap-2.5">
        <div className="h-7 w-7 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-primary text-[10px] font-medium shrink-0">
          {initials(comment.author.name) || "?"}
        </div>
        <div className="flex-1 min-w-0 rounded-xl bg-white/[0.03] border border-white/[0.05] px-3 py-2">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">
              {comment.author.name}
            </span>
            <span>·</span>
            <span>{relative(comment.createdAt)}</span>
            {comment.updatedAt !== comment.createdAt && <span>· edited</span>}
            {isMine && !editing && (
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(true);
                    setEditDraft(comment.body);
                  }}
                  className="text-muted-foreground hover:text-foreground p-0.5"
                  aria-label="Edit comment"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={remove}
                  className="text-muted-foreground hover:text-red-300 p-0.5"
                  aria-label="Delete comment"
                  disabled={rowPending}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
          {editing ? (
            <div className="mt-1 space-y-1.5">
              <MentionTextarea
                value={editDraft}
                onChange={setEditDraft}
                members={members}
                rows={2}
              />
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  className="h-6 text-xs gap-1"
                  onClick={save}
                  disabled={rowPending || !editDraft.trim()}
                >
                  <Check className="h-3 w-3" />
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs gap-1"
                  onClick={() => setEditing(false)}
                  disabled={rowPending}
                >
                  <X className="h-3 w-3" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <RenderedBody body={comment.body} />
          )}
        </div>
      </div>
    );
  }
}

function ReplyComposer({
  targetType,
  targetId,
  parentId,
  members,
  onSent,
}: {
  targetType: CommentTargetType;
  targetId: string;
  parentId: string;
  members: MentionableMember[];
  onSent: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();

  function send() {
    if (!draft.trim()) return;
    startTransition(async () => {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId,
          body: draft.trim(),
          parentId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to reply.");
        return;
      }
      setDraft("");
      setOpen(false);
      onSent();
    });
  }

  return (
    <div className="pl-8">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <CornerDownRight className="h-3 w-3" />
          Reply
        </button>
      ) : (
        <div className="space-y-1.5">
          <MentionTextarea
            value={draft}
            onChange={setDraft}
            members={members}
            rows={2}
          />
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              className="h-6 text-xs gap-1"
              disabled={pending || !draft.trim()}
              onClick={send}
            >
              Reply
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Lightweight @-autocomplete textarea. When the user types `@`, a popover
 * lists matching members; selecting one inserts `@[Name](userId)`.
 */
function MentionTextarea({
  value,
  onChange,
  members,
  rows = 2,
  placeholder,
  ref,
}: {
  value: string;
  onChange: (v: string) => void;
  members: MentionableMember[];
  rows?: number;
  placeholder?: string;
  ref?: React.Ref<HTMLTextAreaElement>;
}) {
  const localRef = useRef<HTMLTextAreaElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [anchor, setAnchor] = useState<number>(-1);

  const filtered = useMemo(() => {
    if (!query) return members.slice(0, 6);
    const q = query.toLowerCase();
    return members.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 6);
  }, [query, members]);

  function onValueChange(next: string, caretPos: number) {
    onChange(next);
    // Find latest @-trigger before caret.
    const seg = next.slice(0, caretPos);
    const at = seg.lastIndexOf("@");
    if (at >= 0) {
      const after = seg.slice(at + 1);
      // Must not be inside a completed token already and must look like a name fragment.
      if (after.length <= 30 && !after.includes(" ") && !after.includes("]")) {
        setAnchor(at);
        setQuery(after);
        setOpen(true);
        return;
      }
    }
    setOpen(false);
    setAnchor(-1);
    setQuery("");
  }

  function insertMention(member: MentionableMember) {
    if (anchor < 0) return;
    const token = `@[${member.name}](${member.id}) `;
    const before = value.slice(0, anchor);
    const after = value.slice(anchor + 1 + query.length);
    const next = `${before}${token}${after}`;
    onChange(next);
    setOpen(false);
    setAnchor(-1);
    setQuery("");
    // restore focus
    setTimeout(() => {
      const t = localRef.current;
      if (t) {
        const newCaret = before.length + token.length;
        t.focus();
        t.setSelectionRange(newCaret, newCaret);
      }
    }, 0);
  }

  return (
    <div className="relative">
      <Textarea
        ref={(node) => {
          localRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref && "current" in ref)
            (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current =
              node;
        }}
        value={value}
        onChange={(e) =>
          onValueChange(e.target.value, e.target.selectionStart ?? 0)
        }
        rows={rows}
        maxLength={4000}
        placeholder={placeholder}
        className="text-sm"
      />
      {open && filtered.length > 0 && (
        <div className="absolute bottom-full mb-1 left-0 z-50 min-w-[200px] rounded-xl border border-white/[0.06] bg-card shadow-soft p-1">
          {filtered.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => insertMention(m)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left hover:bg-white/[0.05]"
            >
              <span className="h-6 w-6 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-primary text-[9px] font-medium">
                {initials(m.name)}
              </span>
              <span className="truncate">{m.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
