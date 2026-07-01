"use client";

/**
 * V0.23 — FileUploader.
 *
 * Drag-drop OR click-to-browse. Multi-file. Streams each file directly
 * to Supabase Storage via a signed URL (browser never touches Vercel
 * for the file bytes) then POSTs the metadata to /attachments to
 * record it in the DB.
 *
 * Also has a "Paste URL" tab for external links (Google Drive,
 * YouTube, Dropbox) that don't need to be re-uploaded.
 */

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadCloud, Link as LinkIcon, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploaderProps {
  projectId: string;
  ownerType: string;
  ownerId: string;
  /** Called after each file record is created. */
  onUploaded?: (attachment: {
    id: string;
    url: string | null;
    fileName: string;
    mimeType: string;
  }) => void;
  /** true = allow multiple files at once. */
  multiple?: boolean;
  /** accept="image/*" | "application/pdf" | "*" */
  accept?: string;
  /** Hide the URL-paste tab (some fields don't want it). */
  hideUrlPaste?: boolean;
  /** Optional label on the drop zone. */
  label?: string;
  /** Called when the user submits a URL-paste. Falls back to onUploaded
   * with `null` id if not provided. */
  onUrlPaste?: (url: string, title: string) => void;
}

type ProgressState = Record<
  string,
  { name: string; pct: number; error?: string }
>;

export function FileUploader({
  projectId,
  ownerType,
  ownerId,
  onUploaded,
  multiple = true,
  accept = "*",
  hideUrlPaste = false,
  label = "Drop files here, or click to browse",
  onUrlPaste,
}: FileUploaderProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"file" | "url">("file");
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<ProgressState>({});
  const [urlInput, setUrlInput] = useState("");
  const [urlTitle, setUrlTitle] = useState("");
  const [pending, startTransition] = useTransition();

  async function uploadOne(file: File) {
    const key = `${file.name}-${Date.now()}-${Math.random()}`;
    setProgress((p) => ({ ...p, [key]: { name: file.name, pct: 5 } }));

    // Step 1: ask for a signed URL.
    let signRes: Response;
    try {
      signRes = await fetch(`/api/projects/${projectId}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerType,
          ownerId,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
        }),
      });
    } catch (err) {
      setProgress((p) => ({
        ...p,
        [key]: { name: file.name, pct: 0, error: (err as Error).message },
      }));
      return;
    }
    if (!signRes.ok) {
      const data = await signRes.json().catch(() => ({}));
      setProgress((p) => ({
        ...p,
        [key]: {
          name: file.name,
          pct: 0,
          error: data.error ?? "Sign request failed.",
        },
      }));
      return;
    }
    const { signedUrl, storagePath, token } = await signRes.json();
    setProgress((p) => ({ ...p, [key]: { name: file.name, pct: 15 } }));

    // Step 2: PUT the file directly to Supabase via the signed URL.
    // XHR gives us upload progress; fetch() doesn't.
    const putResult = await new Promise<{ ok: boolean; msg?: string }>(
      (resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", signedUrl);
        xhr.setRequestHeader(
          "Content-Type",
          file.type || "application/octet-stream"
        );
        // Supabase signed uploads accept the token via header too.
        if (token) xhr.setRequestHeader("x-upsert", "false");
        xhr.upload.onprogress = (e) => {
          if (!e.lengthComputable) return;
          const pct = Math.round((e.loaded / e.total) * 80) + 15;
          setProgress((p) => ({ ...p, [key]: { name: file.name, pct } }));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({ ok: true });
          } else {
            resolve({
              ok: false,
              msg: `Upload failed (${xhr.status}) ${xhr.responseText}`,
            });
          }
        };
        xhr.onerror = () => resolve({ ok: false, msg: "Network error." });
        xhr.send(file);
      }
    );
    if (!putResult.ok) {
      setProgress((p) => ({
        ...p,
        [key]: { name: file.name, pct: 0, error: putResult.msg },
      }));
      return;
    }

    // Step 3: record the Attachment in the DB.
    setProgress((p) => ({ ...p, [key]: { name: file.name, pct: 95 } }));
    const recRes = await fetch(
      `/api/projects/${projectId}/attachments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerType,
          ownerId,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          storagePath,
        }),
      }
    );
    const recData = await recRes.json().catch(() => ({}));
    if (!recRes.ok) {
      setProgress((p) => ({
        ...p,
        [key]: {
          name: file.name,
          pct: 0,
          error: recData.error ?? "Record failed.",
        },
      }));
      return;
    }

    setProgress((p) => ({ ...p, [key]: { name: file.name, pct: 100 } }));
    onUploaded?.({
      id: recData.id,
      url: recData.url,
      fileName: file.name,
      mimeType: file.type,
    });

    // Auto-hide the completed line after a moment.
    setTimeout(() => {
      setProgress((p) => {
        const next = { ...p };
        delete next[key];
        return next;
      });
    }, 1200);
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    startTransition(() => {
      Array.from(files).forEach((f) => uploadOne(f));
    });
    router.refresh();
  }

  function submitUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!urlInput.trim()) return;
    try {
      new URL(urlInput.trim());
    } catch {
      return toast.error("That doesn't look like a valid URL.");
    }
    if (onUrlPaste) {
      onUrlPaste(urlInput.trim(), urlTitle.trim() || urlInput.trim());
    } else {
      toast.error("URL-paste isn't wired up for this field yet.");
      return;
    }
    setUrlInput("");
    setUrlTitle("");
  }

  return (
    <div className="space-y-2">
      {!hideUrlPaste && (
        <div className="inline-flex rounded-md border border-white/[0.06] bg-white/[0.02] p-0.5">
          <button
            type="button"
            onClick={() => setTab("file")}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 h-7 text-[11px] rounded-[5px]",
              tab === "file"
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <UploadCloud className="h-3 w-3" />
            Upload
          </button>
          <button
            type="button"
            onClick={() => setTab("url")}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 h-7 text-[11px] rounded-[5px]",
              tab === "url"
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LinkIcon className="h-3 w-3" />
            Paste URL
          </button>
        </div>
      )}

      {tab === "file" ? (
        <>
          <div
            className={cn(
              "rounded-lg border-2 border-dashed transition-colors px-4 py-6 flex flex-col items-center gap-2 cursor-pointer",
              dragging
                ? "border-primary/40 bg-primary/5"
                : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04]"
            )}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
          >
            <UploadCloud className="h-6 w-6 text-muted-foreground" />
            <p className="text-xs text-muted-foreground text-center">
              {label}
            </p>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              multiple={multiple}
              accept={accept}
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
          {Object.entries(progress).map(([k, s]) => (
            <div
              key={k}
              className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs"
            >
              <div className="flex items-center gap-2">
                {s.pct >= 100 ? (
                  <div className="h-3.5 w-3.5 rounded-full bg-emerald-500/70" />
                ) : s.error ? (
                  <X className="h-3.5 w-3.5 text-red-400" />
                ) : (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
                <span className="flex-1 truncate">{s.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  {s.error ? "failed" : `${s.pct}%`}
                </span>
              </div>
              {s.error && (
                <p className="mt-1 text-[11px] text-red-300 font-mono">
                  {s.error}
                </p>
              )}
              {!s.error && (
                <div className="mt-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${s.pct}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </>
      ) : (
        <form onSubmit={submitUrl} className="space-y-2">
          <div className="space-y-1">
            <Label className="text-[11px]">Title</Label>
            <Input
              value={urlTitle}
              onChange={(e) => setUrlTitle(e.target.value)}
              placeholder="Reference image"
              className="h-8 text-xs"
              maxLength={200}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">URL</Label>
            <Input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://…"
              className="h-8 text-xs"
              maxLength={800}
            />
          </div>
          <Button
            type="submit"
            size="sm"
            variant="outline"
            className="h-8 text-xs w-full"
            disabled={pending}
          >
            Add link
          </Button>
        </form>
      )}
    </div>
  );
}
