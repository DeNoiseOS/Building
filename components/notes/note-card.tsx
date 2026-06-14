"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { NoteEditorSheet } from "./note-editor-sheet";

interface NoteCardData {
  id: string;
  projectId: string;
  title: string;
  body: string;
  section: string;
  updatedAt: string;
}

interface NoteCardProps {
  note: NoteCardData;
  sectionLabel: string;
}

function snippet(text: string, n = 220) {
  if (text.length <= n) return text;
  return text.slice(0, n).trimEnd() + "…";
}

export function NoteCard({ note, sectionLabel }: NoteCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group w-full text-left rounded-xl border border-white/[0.05] bg-card/60 p-4 hover:bg-white/[0.04] hover:border-white/[0.1] hover:shadow-soft transition-all space-y-2"
      >
        <p className="font-semibold text-sm leading-snug line-clamp-2">
          {note.title}
        </p>
        {note.body && (
          <p className="text-xs text-muted-foreground line-clamp-4 whitespace-pre-wrap leading-relaxed">
            {snippet(note.body)}
          </p>
        )}
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium pt-1">
          {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
        </p>
      </button>

      <NoteEditorSheet
        open={open}
        onOpenChange={setOpen}
        mode="edit"
        projectId={note.projectId}
        section={note.section}
        sectionLabel={sectionLabel}
        note={note}
      />
    </>
  );
}
