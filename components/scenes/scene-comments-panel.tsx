"use client";

/**
 * V0.24 — Scene comments panel.
 *
 * Simple threaded strip on the scene detail page. Everyone in the
 * project can post; author or project owner can delete. Feeds the
 * creative feedback loop between production and the agency.
 */

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, MessageSquare } from "lucide-react";

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string } | null;
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export function SceneCommentsPanel({
  projectId,
  sceneId,
  currentUserId,
}: {
  projectId: string;
  sceneId: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancel = false;
    (async () => {
      const res = await fetch(
        `/api/projects/${projectId}/scenes/${sceneId}/comments`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => ({ comments: [] }));
      if (!cancel) setComments(data.comments ?? []);
    })();
    return () => {
      cancel = true;
    };
  }, [projectId, sceneId]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    startTransition(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/scenes/${sceneId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: text.trim() }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed.");
        return;
      }
      setText("");
      // Re-fetch.
      const refetch = await fetch(
        `/api/projects/${projectId}/scenes/${sceneId}/comments`,
        { cache: "no-store" }
      );
      const refetched = await refetch.json().catch(() => ({ comments: [] }));
      setComments(refetched.comments ?? []);
      router.refresh();
    });
  }

  async function remove(id: string) {
    if (!confirm("Delete this comment?")) return;
    const res = await fetch(
      `/api/projects/${projectId}/scenes/${sceneId}/comments/${id}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Failed.");
      return;
    }
    setComments((cur) => cur?.filter((c) => c.id !== id) ?? null);
  }

  return (
    <section className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
      <div className="px-5 py-4 border-b border-white/[0.04] flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Feedback</h2>
        <span className="text-xs text-muted-foreground">
          {comments?.length ?? 0}
        </span>
      </div>
      <div className="p-5 space-y-4">
        {comments && comments.length > 0 && (
          <div className="space-y-3">
            {comments.map((c) => (
              <div
                key={c.id}
                className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
              >
                <div className="flex items-center gap-2 text-xs mb-1">
                  <span className="font-medium">
                    {c.author?.name ?? "Someone"}
                  </span>
                  <span className="text-muted-foreground">
                    · {timeAgo(c.createdAt)}
                  </span>
                  {c.author?.id === currentUserId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 ml-auto text-muted-foreground hover:text-destructive"
                      onClick={() => remove(c.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap">{c.body}</p>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={submit} className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={4000}
            placeholder="Add a comment or feedback…"
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={pending || !text.trim()}
            >
              {pending ? "Posting…" : "Post"}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
