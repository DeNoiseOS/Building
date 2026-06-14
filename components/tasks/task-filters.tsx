"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TASK_STATUS } from "@/lib/roles";
import { cn } from "@/lib/utils";

export interface ProjectFilterOption {
  id: string;
  name: string;
}

interface TaskFiltersProps {
  projects: ProjectFilterOption[];
  /** Currently selected. */
  projectId?: string;
  statuses: string[];
  mineOnly: boolean;
}

/**
 * Filter row for the global Tasks page. URL-driven so refresh and shared
 * links preserve filters.
 */
export function TaskFilters({
  projects,
  projectId,
  statuses,
  mineOnly,
}: TaskFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function update(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "") sp.delete(key);
      else sp.set(key, value);
    }
    const qs = sp.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  }

  function toggleStatus(status: string) {
    const current = new Set(statuses);
    if (current.has(status)) current.delete(status);
    else current.add(status);
    update({
      status: current.size > 0 ? [...current].join(",") : null,
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Project
        </span>
        <Select
          value={projectId ?? "__all__"}
          onValueChange={(v) =>
            update({ project: v === "__all__" ? null : v })
          }
        >
          <SelectTrigger className="h-8 min-w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Status
        </span>
        <div className="flex items-center gap-1">
          {TASK_STATUS.map((s) => {
            const active = statuses.includes(s.value);
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => toggleStatus(s.value)}
                className={cn(
                  "h-8 px-2.5 text-xs rounded-md border transition-colors",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => update({ mine: mineOnly ? null : "1" })}
        className={cn(
          "h-8 px-3 text-xs rounded-md border transition-colors",
          mineOnly
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-card text-muted-foreground hover:text-foreground"
        )}
      >
        Mine only
      </button>
    </div>
  );
}
