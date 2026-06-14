import { NoteSection } from "@/components/notes/note-section";
import { ReferenceGrid } from "@/components/references/reference-grid";
import { SectionTaskBlock } from "./section-task-block";
import type { SectionDef } from "@/lib/sections";
import type {
  NoteSummary,
  ReferenceSummary,
} from "@/lib/workspace-data";
import type { TaskSummary } from "@/lib/server-data";

export type SectionPayload =
  | { type: "notes"; items: NoteSummary[] }
  | { type: "references"; items: ReferenceSummary[] }
  | { type: "tasks"; items: TaskSummary[] };

interface SectionBlockProps {
  projectId: string;
  def: SectionDef;
  payload: SectionPayload;
  currentUser: { id: string; name: string };
}

export function SectionBlock({
  projectId,
  def,
  payload,
  currentUser,
}: SectionBlockProps) {
  const Icon = def.icon;
  const count = payload.items.length;

  return (
    <section className="rounded-2xl border border-white/[0.05] bg-card/40 shadow-soft overflow-hidden">
      <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-white/[0.04]">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold leading-tight">
                {def.label}
              </h3>
              <span className="text-xs text-muted-foreground tabular-nums">
                {count}
              </span>
            </div>
            {def.description && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {def.description}
              </p>
            )}
          </div>
        </div>
      </header>

      <div className="p-5">
        {payload.type === "notes" && (
          <NoteSection
            projectId={projectId}
            section={def.key}
            sectionLabel={def.label}
            notes={payload.items}
          />
        )}

        {payload.type === "references" && (
          <ReferenceGrid
            projectId={projectId}
            section={def.key}
            sectionLabel={def.label}
            references={payload.items}
          />
        )}

        {payload.type === "tasks" && (
          <SectionTaskBlock
            projectId={projectId}
            section={def.key}
            sectionLabel={def.label}
            items={payload.items}
            currentUser={currentUser}
          />
        )}
      </div>
    </section>
  );
}
