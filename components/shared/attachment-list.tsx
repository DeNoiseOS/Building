"use client";

/**
 * V0.23 — AttachmentList.
 *
 * Renders the attachments for one (ownerType, ownerId). Types render
 * differently: images get a thumbnail + lightbox; PDFs / docs get a
 * type icon + click-to-open; video/audio get inline players.
 *
 * Fetches its own data on mount so callers don't have to plumb it
 * through server components.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  FileText,
  FileType,
  Film,
  Music2,
  ImageIcon,
  ExternalLink,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export interface AttachmentDTO {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  url: string | null;
  thumbnailUrl: string | null;
  uploadedBy: { id: string; name: string } | null;
  createdAt: string;
}

function iconFor(mime: string) {
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime === "application/pdf") return FileText;
  if (mime.startsWith("video/")) return Film;
  if (mime.startsWith("audio/")) return Music2;
  return FileType;
}
function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentList({
  projectId,
  ownerType,
  ownerId,
  canDelete = false,
  refreshKey = 0,
}: {
  projectId: string;
  ownerType: string;
  ownerId: string;
  canDelete?: boolean;
  /** Bump this to force a re-fetch (e.g. right after an upload). */
  refreshKey?: number;
}) {
  const router = useRouter();
  const [items, setItems] = useState<AttachmentDTO[] | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const res = await fetch(
        `/api/projects/${projectId}/attachments?ownerType=${encodeURIComponent(
          ownerType
        )}&ownerId=${encodeURIComponent(ownerId)}`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => ({ attachments: [] }));
      if (!cancel) setItems(data.attachments ?? []);
    })();
    return () => {
      cancel = true;
    };
  }, [projectId, ownerType, ownerId, refreshKey]);

  async function remove(id: string) {
    if (!confirm("Delete this file?")) return;
    const res = await fetch(
      `/api/projects/${projectId}/attachments/${id}`,
      { method: "DELETE" }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Failed.");
      return;
    }
    toast.success("Deleted.");
    setItems((cur) => cur?.filter((a) => a.id !== id) ?? null);
    router.refresh();
  }

  if (items === null) return null;
  if (items.length === 0) return null;

  const imageItems = items
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.mimeType.startsWith("image/") && a.url);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        {items.map((a, idx) => {
          const Icon = iconFor(a.mimeType);
          const isImage = a.mimeType.startsWith("image/") && a.url;
          const isVideo = a.mimeType.startsWith("video/") && a.url;
          const isAudio = a.mimeType.startsWith("audio/") && a.url;

          return (
            <div
              key={a.id}
              className="group relative rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden"
            >
              {isImage ? (
                <button
                  type="button"
                  className="w-full aspect-video bg-black/40 relative"
                  onClick={() => {
                    const imgIdx = imageItems.findIndex((x) => x.i === idx);
                    if (imgIdx >= 0) setLightboxIdx(imgIdx);
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.url!}
                    alt={a.fileName}
                    className="w-full h-full object-cover"
                  />
                </button>
              ) : isVideo ? (
                <video
                  src={a.url!}
                  controls
                  className="w-full aspect-video bg-black"
                />
              ) : isAudio ? (
                <div className="p-3 bg-black/40 flex items-center gap-2">
                  <Music2 className="h-5 w-5 text-primary shrink-0" />
                  <audio src={a.url!} controls className="w-full h-8" />
                </div>
              ) : (
                <a
                  href={a.url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-4 bg-white/[0.02] hover:bg-white/[0.04]"
                >
                  <div className="h-10 w-10 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium truncate">
                      {a.fileName}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {humanSize(a.size)}
                    </div>
                  </div>
                  <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                </a>
              )}

              {/* Meta strip + delete */}
              <div className="px-3 py-1.5 flex items-center gap-2 text-[10px] border-t border-white/[0.04]">
                <div className="flex-1 min-w-0 truncate text-muted-foreground">
                  {a.uploadedBy?.name ?? "—"}
                </div>
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => remove(a.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* V0.23 — Lightbox for images */}
      {lightboxIdx !== null && imageItems[lightboxIdx] && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxIdx(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIdx(null);
            }}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          {imageItems.length > 1 && (
            <>
              <button
                type="button"
                className="absolute left-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIdx((v) =>
                    v === null
                      ? 0
                      : (v - 1 + imageItems.length) % imageItems.length
                  );
                }}
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                className="absolute right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIdx((v) =>
                    v === null ? 0 : (v + 1) % imageItems.length
                  );
                }}
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageItems[lightboxIdx].a.url!}
            alt={imageItems[lightboxIdx].a.fileName}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
