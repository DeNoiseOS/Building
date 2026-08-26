import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { HealthBadge } from "@/components/shared/health-badge";
import { ROLE_LABELS } from "@/lib/roles";
import { coverFor } from "@/lib/cover";
import { cn } from "@/lib/utils";
import type { ProjectStats } from "@/lib/project-stats";

export interface ProjectCardData {
  id: string;
  name: string;
  description?: string | null;
  /** Legacy: project's headline role. Not displayed. */
  role: string;
  /** V0.4: the current viewer's role on the project. Displayed in the chip. */
  memberRole: string;
  startDate: string;
  endDate: string;
  status: string;
  stats: ProjectStats;
}

interface ProjectCardProps {
  project: ProjectCardData;
  /** Compact = no description; used by Dashboard. */
  compact?: boolean;
  /** V0.27 — "denoise" swaps the violet progress gradient for the
   * DeNoise copper accent + tightens the card surface for Home.
   * Default keeps the existing /projects experience unchanged. */
  variant?: "default" | "denoise";
}

export function ProjectCard({
  project,
  compact = false,
  variant = "default",
}: ProjectCardProps) {
  const isDenoise = variant === "denoise";
  const start = new Date(project.startDate);
  const end = new Date(project.endDate);
  const palette = coverFor(project.id);

  return (
    <Link
      href={`/projects/${project.id}`}
      className={cn(
        "group block overflow-hidden transition-all",
        isDenoise
          ? "rounded-[var(--radius-home)] border border-[var(--denoise-border)] bg-[var(--denoise-surface)] hover:border-[var(--denoise-border-strong)] hover:bg-[var(--denoise-surface-2)]"
          : "rounded-2xl border border-white/[0.05] bg-card/60 shadow-soft hover:shadow-hover",
      )}
    >
      {/* Cinematic cover */}
      <div className="relative aspect-[2/1] overflow-hidden">
        <div
          className={cn(
            "absolute inset-0 transition-transform duration-700 group-hover:scale-[1.04]",
            palette,
          )}
        />
        {/* Subtle vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        {/* Role chip top-right */}
        <div className="absolute top-3 right-3">
          <Badge
            variant="outline"
            className="bg-black/30 backdrop-blur-md border-white/15 text-white text-[10px] font-medium"
          >
            {ROLE_LABELS[project.memberRole] ?? project.memberRole}
          </Badge>
        </div>
        {/* Health badge bottom-left */}
        <div className="absolute bottom-3 left-3">
          <HealthBadge health={project.stats.health} />
        </div>
        {/* Progress bottom-right */}
        <div className="absolute bottom-3 right-3 text-right">
          <div className="text-[10px] uppercase tracking-wider text-white/70 font-medium">
            Progress
          </div>
          <div className="text-lg font-semibold text-white tabular-nums leading-none">
            {project.stats.progressPercent}%
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight truncate leading-tight">
            {project.name}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {format(start, "MMM d")} → {format(end, "MMM d, yyyy")}
          </p>
        </div>

        {!compact && project.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {project.description}
          </p>
        )}

        {/* Progress bar */}
        <div className="h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              isDenoise
                ? "bg-[var(--denoise-copper)]"
                : "bg-gradient-to-r from-primary to-violet-500",
            )}
            style={{ width: `${project.stats.progressPercent}%` }}
          />
        </div>

        {/* Task stats */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5 text-muted-foreground">
            <span>
              <span className="text-foreground font-medium">
                {project.stats.completedTasks}
              </span>{" "}
              done
            </span>
            <span className="opacity-30">·</span>
            <span>
              <span className="text-foreground font-medium">
                {project.stats.pendingTasks}
              </span>{" "}
              pending
            </span>
          </div>
          {project.stats.overdueTasks > 0 && (
            <span className="text-red-400 font-medium">
              {project.stats.overdueTasks} overdue
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
