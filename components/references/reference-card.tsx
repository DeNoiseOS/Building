"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { ExternalLink, ImageOff } from "lucide-react";
import { ReferenceEditorSheet } from "./reference-editor-sheet";

interface ReferenceCardData {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  link: string | null;
  section: string;
}

interface ReferenceCardProps {
  reference: ReferenceCardData;
  sectionLabel: string;
}

export function ReferenceCard({
  reference,
  sectionLabel,
}: ReferenceCardProps) {
  const [open, setOpen] = useState(false);
  const [imageErrored, setImageErrored] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group text-left rounded-xl border border-white/[0.05] bg-card/60 overflow-hidden hover:border-white/[0.12] hover:shadow-hover transition-all flex flex-col"
      >
        <div className="aspect-video bg-gradient-to-br from-white/[0.04] to-white/[0.01] flex items-center justify-center overflow-hidden relative">
          {reference.imageUrl && !imageErrored ? (
            <img
              src={reference.imageUrl}
              alt={reference.title}
              className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-700"
              onError={() => setImageErrored(true)}
              loading="lazy"
            />
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-muted-foreground/40">
              <ImageOff className="h-7 w-7" />
              <span className="text-[10px] uppercase tracking-wider">
                No image
              </span>
            </div>
          )}
          {reference.link && (
            <div className="absolute top-2 right-2 h-6 w-6 rounded-md bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <ExternalLink className="h-3 w-3 text-white" />
            </div>
          )}
        </div>
        <div className="p-3 space-y-1 flex-1">
          <p className="font-semibold text-sm leading-tight line-clamp-2">
            {reference.title}
          </p>
          {reference.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {reference.description}
            </p>
          )}
        </div>
      </button>

      <ReferenceEditorSheet
        open={open}
        onOpenChange={setOpen}
        mode="edit"
        projectId={reference.projectId}
        section={reference.section}
        sectionLabel={sectionLabel}
        reference={reference}
      />
    </>
  );
}
