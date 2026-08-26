import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { HealthBadge } from "@/components/shared/health-badge";
import { ROLE_LABELS } from "@/lib/roles";
import { coverFor } from "@/lib/cover";
import { cn } from "@/lib/utils";
import type { ProjectsConfig } from "@/lib/widgets/schema";
import type { ProjectsResult, ResolvedProject } from "@/lib/widgets/data/projects";
import type { Density } from "@/components/home/canvas/use-density";

/**
 * V0.28 Phase B — Projects / Project Pulse widget.
 *
 * `display` chooses between an operational row-per-project ("pulse")
 * and a cinematic tile grid ("grid"). Density controls how many
 * fields each row/tile reveals.
 */
export function ProjectsWidget({
  config,
  data,
  density,
}: {
  config: ProjectsConfig;
  data: ProjectsResult;
  density: Density;
}) {
  if (data.projects.length === 0) {
    return (
      <div className="h-full flex items-center px-4 py-3 text-[12px] text-[var(--denoise-cream-muted)]">
        No projects match this configuration.
      </div>
    );
  }

  if (density === "micro") {
    return (
      <div className="h-full flex flex-col justify-center px-4 py-3">
        <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--denoise-cream-muted)]">
          Projects
        </div>
        <div className="text-[28px] font-semibold tabular-nums leading-none mt-2 text-[var(--denoise-cream)]">
          {data.projects.length}
        </div>
      </div>
    );
  }

  if (config.display === "grid" && density !== "compact") {
    return (
      <div className="h-full overflow-auto p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 auto-rows-min">
        {data.projects.map((p) => (
          <ProjectTile key={p.id} project={p} showDates={config.fields.dates} />
        ))}
      </div>
    );
  }

  // pulse rows
  return (
    <ul className="h-full overflow-auto divide-y divide-[var(--denoise-border)]">
      {data.projects.map((p) => (
        <li key={p.id}>
          <Link
            href={`/projects/${p.id}`}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-2.5 hover:bg-[var(--denoise-surface-2)] transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              {config.fields.cover !== false && (
                <span
                  className={cn(
                    "h-8 w-8 rounded-md shrink-0 overflow-hidden relative",
                    coverFor(p.id)
                  )}
                >
                  <span className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                </span>
              )}
              <div className="min-w-0">
                <p className="text-[13px] text-[var(--denoise-cream)] truncate font-medium">
                  {p.name}
                </p>
                <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--denoise-cream-muted)] mt-0.5">
                  {p.departmentCount} Dept{p.departmentCount === 1 ? "" : "s"} · {p.openTasks} Open
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {config.fields.progress !== false && (
                <MiniProgress percent={p.progressPercent} color="var(--denoise-copper)" />
              )}
              {config.fields.budget !== false && p.budgetUsedPct !== null && density !== "compact" && (
                <MiniProgress
                  percent={p.budgetUsedPct}
                  color={
                    p.budgetUsedPct >= 90
                      ? "oklch(0.68 0.20 25)"
                      : p.budgetUsedPct >= 70
                        ? "oklch(0.78 0.16 80)"
                        : "var(--denoise-cream-muted)"
                  }
                />
              )}
            </div>
            {config.fields.health !== false && <HealthBadge health={p.health} />}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function MiniProgress({ percent, color }: { percent: number; color: string }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-14 rounded-full bg-white/[0.05] overflow-hidden">
        <div
          className="h-full transition-[width] duration-500"
          style={{ width: `${p}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] tabular-nums text-[var(--denoise-cream-muted)] w-8 text-right">
        {p}%
      </span>
    </div>
  );
}

function ProjectTile({
  project,
  showDates,
}: {
  project: ResolvedProject;
  showDates?: boolean;
}) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="block overflow-hidden rounded-[var(--radius-home)] border border-[var(--denoise-border)] bg-[var(--denoise-surface-2)] hover:border-[var(--denoise-border-strong)] transition-colors group"
    >
      <div className="relative aspect-[16/9] overflow-hidden">
        <div
          className={cn(
            "absolute inset-0 transition-transform duration-700 group-hover:scale-[1.03]",
            coverFor(project.id)
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
          <HealthBadge health={project.health} />
        </div>
      </div>
      <div className="px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-medium text-[var(--denoise-cream)] truncate">
            {project.name}
          </p>
          <span className="text-[10px] tabular-nums text-[var(--denoise-cream-muted)]">
            {project.progressPercent}%
          </span>
        </div>
        {showDates && (
          <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--denoise-cream-muted)] truncate">
            {format(project.startDate, "MMM d")} → {format(project.endDate, "MMM d, yyyy")}
          </div>
        )}
        <div className="mt-2 h-[3px] rounded-full bg-white/[0.05] overflow-hidden">
          <div
            className="h-full bg-[var(--denoise-copper)] transition-[width] duration-500"
            style={{ width: `${project.progressPercent}%` }}
          />
        </div>
      </div>
    </Link>
  );
}
