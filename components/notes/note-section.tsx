"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NoteCard } from "./note-card";
import { NoteEditorSheet } from "./note-editor-sheet";

interface NoteSectionProps {
  projectId: string;
  section: string;
  sectionLabel: string;
  notes: Array<{
    id: string;
    projectId: string;
    title: string;
    body: string;
    section: string;
    updatedAt: string;
  }>;
}

export function NoteSection({
  projectId,
  section,
  sectionLabel,
  notes,
}: NoteSectionProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {notes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.06] bg-white/[0.015] py-10 px-4 text-center space-y-3">
          <p className="text-sm text-muted-foreground">No notes here yet.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
            className="bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.06]"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add a note
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                sectionLabel={sectionLabel}
              />
            ))}
          </div>
          <div className="pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(true)}
              className="text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add note
            </Button>
          </div>
        </div>
      )}

      <NoteEditorSheet
        open={open}
        onOpenChange={setOpen}
        mode="create"
        projectId={projectId}
        section={section}
        sectionLabel={sectionLabel}
      />
    </>
  );
}
