"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Globe, Plus, Sparkles } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/roles";
import { coverFor } from "@/lib/cover";
import { CreateProjectSheet } from "@/components/projects/create-project-sheet";

export interface ProjectChoice {
  id: string;
  name: string;
  /** Project's headline role (Project.role). */
  role: string;
  /** V0.3: caller's ProjectMember.role on this project. */
  memberRole: string;
}

interface ProjectSwitcherProps {
  projects: ProjectChoice[];
  /** id of the currently scoped project, or null for global mode */
  activeProjectId: string | null;
}

export function ProjectSwitcher({
  projects,
  activeProjectId,
}: ProjectSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const active = activeProjectId
    ? projects.find((p) => p.id === activeProjectId)
    : null;

  function selectGlobal() {
    setOpen(false);
    router.push("/home");
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "h-9 gap-2.5 px-3 rounded-lg border-white/10 bg-white/[0.03] hover:bg-white/[0.07]",
              "min-w-[200px] justify-between font-medium"
            )}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              {active ? (
                <span
                  className={cn(
                    "h-5 w-5 rounded-md shrink-0",
                    coverFor(active.id)
                  )}
                />
              ) : (
                <Globe className="h-4 w-4 text-primary" />
              )}
              <span className="truncate text-sm">
                {active ? active.name : "All Projects"}
              </span>
            </span>
            <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="center"
          className="w-[320px] p-1.5 rounded-xl shadow-soft"
        >
          <button
            onClick={selectGlobal}
            className={cn(
              "w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition-colors",
              "hover:bg-white/[0.05]",
              !active && "bg-white/[0.05]"
            )}
          >
            <span className="h-8 w-8 rounded-md bg-primary/15 border border-primary/20 flex items-center justify-center">
              <Globe className="h-4 w-4 text-primary" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium">All Projects</span>
              <span className="block text-xs text-muted-foreground">
                Global view
              </span>
            </span>
            {!active && <Check className="h-3.5 w-3.5 text-primary" />}
          </button>

          {projects.length > 0 && (
            <div className="my-1.5 h-px bg-white/[0.06]" />
          )}

          <div className="max-h-[280px] overflow-y-auto">
            {projects.map((project) => {
              const isActive = active?.id === project.id;
              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "w-full flex items-center gap-3 px-2.5 py-2 rounded-lg transition-colors",
                    "hover:bg-white/[0.05]",
                    isActive && "bg-white/[0.05]"
                  )}
                >
                  <span
                    className={cn(
                      "h-8 w-8 rounded-md border border-white/10 shrink-0",
                      coverFor(project.id)
                    )}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate">
                      {project.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {ROLE_LABELS[project.memberRole] ?? project.memberRole}
                    </span>
                  </span>
                  {isActive && (
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                  )}
                </Link>
              );
            })}
          </div>

          {projects.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              <Sparkles className="h-4 w-4 mx-auto mb-1.5 opacity-60" />
              No projects yet — create your first one below.
            </div>
          )}

          <div className="my-1.5 h-px bg-white/[0.06]" />

          <button
            onClick={() => {
              setOpen(false);
              setCreateOpen(true);
            }}
            className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition-colors hover:bg-white/[0.05] text-primary"
          >
            <span className="h-8 w-8 rounded-md bg-primary/15 border border-primary/20 flex items-center justify-center">
              <Plus className="h-4 w-4 text-primary" />
            </span>
            <span className="text-sm font-medium">New Project</span>
          </button>
        </PopoverContent>
      </Popover>

      <CreateProjectSheet open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
