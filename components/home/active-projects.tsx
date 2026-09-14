import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { HealthBadge } from "@/components/shared/health-badge";
import { ROLE_LABELS } from "@/lib/roles";
import { coverFor } from "@/lib/cover";
import { cn } from "@/lib/utils";
import { Panel, SectionHeader } from "./section-header";
import type { ProjectCardData } from "@/components/projects/project-card";

/**
 * V0.27.1 — Active Projects. Compact cinematic tiles (2-col on desktop,
 * 1-col on narrow). Home-local composition so the reference layout is
 * hit without touching the shared /projects ProjectCard.
 */
export function ActiveProjects({ projects }: { projects: ProjectCardData[] }) {
  return (
    <Panel>
      <SectionHeader title="Active Projects" count={projects.length} href="/projects" />
      {projects.length === 0 ? (
        <p className="px-4 py-6 text-[12px] text-[var(--denoise-cream-muted)]">
          No active productions yet.
        </p>
      ) : (
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {projects.slice(0, 4).map((p) => (
            <ActiveTile key={p.id} project={p} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function ActiveTile({ project }: { project: ProjectCardData }) {
  const palette = coverFor(project.id);
  const start = new Date(project.startDate);
  const end = new Date(project.endDate);
  return (
    <Link
      href={`/projects/${project.id}`}
      className="group block overflow-hidden rounded-[var(--radius-home)] border border-[var(--denoise-border)] bg-[var(--denoise-surface-2)] hover:border-[var(--denoise-border-strong)] transition-colors"
    >
      <div className="relative aspect-[16/9] overflow-hidden">
        <div
          className={cn(
            "absolute inset-0 transition-transform duration-700 group-hover:scale-[1.03]",
            palette,
          )}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
        <div className="absolute top-2 right-2">
          <Badge
            variant="outline"
            className="bg-black/40 backdrop-blur-md border-white/10 text-white text-[9px] uppercase tracking-[0.16em] font-medium h-5 px-1.5"
          >
            {ROLE_LABELS[project.memberRole] ?? project.memberRole}
          </Badge>
        </div>
        <div className="absolute bottom-2 left-2">
          <HealthBadge health={project.stats.health} />
        </div>
      </div>
      <div className="px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-medium text-[var(--denoise-cream)] truncate">
            {project.name}
          </p>
          <span className="text-[10px] tabular-nums text-[var(--denoise-cream-muted)]">
            {project.stats.progressPercent}%
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.14em] text-[var(--denoise-cream-muted)]">
          <span className="truncate">
            {format(start, "MMM d")} → {format(end, "MMM d, yyyy")}
          </span>
        </div>
        <div className="mt-2 h-[3px] rounded-full bg-white/[0.05] overflow-hidden">
          <div
            className="h-full bg-[var(--denoise-copper)] transition-[width] duration-500"
            style={{ width: `${project.stats.progressPercent}%` }}
          />
        </div>
      </div>
    </Link>
  );
}
