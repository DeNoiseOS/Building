"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReferenceCard } from "./reference-card";
import { ReferenceEditorSheet } from "./reference-editor-sheet";

interface ReferenceGridProps {
  projectId: string;
  section: string;
  sectionLabel: string;
  references: Array<{
    id: string;
    projectId: string;
    title: string;
    description: string | null;
    imageUrl: string | null;
    link: string | null;
    section: string;
  }>;
}

export function ReferenceGrid({
  projectId,
  section,
  sectionLabel,
  references,
}: ReferenceGridProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {references.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.06] bg-white/[0.015] py-10 px-4 text-center space-y-3">
          <p className="text-sm text-muted-foreground">No references yet.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
            className="bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.06]"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add a reference
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {references.map((reference) => (
              <ReferenceCard
                key={reference.id}
                reference={reference}
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
              Add reference
            </Button>
          </div>
        </div>
      )}

      <ReferenceEditorSheet
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
