import Link from "next/link";
import { HealthBadge } from "@/components/shared/health-badge";
import { coverFor } from "@/lib/cover";
import { Panel, SectionHeader } from "./section-header";
import { computeProjectStats } from "@/lib/project-stats";
import { cn } from "@/lib/utils";

export interface ProjectPulseInput {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  currency: string | null;
  tasks: { status: string; dueDate: Date | null }[];
  departments: { id: string }[];
  departmentBudgets: { approvedAmount: number | null }[];
  spent: number;
}

/**
 * V0.27.1 — Project Pulse as a narrow operational column. Each project
 * is one dense row: cover chip + name/depts, progress ring, health,
 * budget bar, open-task count.
 */
export function ProjectPulseGrid({
  projects,
  now,
}: {
  projects: ProjectPulseInput[];
  now: Date;
}) {
  return (
    <Panel>
      <SectionHeader
        title="Project Pulse"
        count={projects.length}
        href="/projects"
      />
      {projects.length === 0 ? (
        <p className="px-4 py-6 text-[12px] text-[var(--denoise-cream-muted)]">
          No active productions.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--denoise-border)]">
          {projects.map((p) => {
            const stats = computeProjectStats({
              startDate: p.startDate,
              endDate: p.endDate,
              tasks: p.tasks,
              now,
            });
            const approved = p.departmentBudgets.reduce(
              (s, b) => s + (b.approvedAmount ?? 0),
              0
            );
            const utilization =
              approved > 0
                ? Math.min(100, Math.round((p.spent / approved) * 100))
                : null;
            const open = p.tasks.filter((t) => t.status !== "done").length;
            return (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-[var(--denoise-surface-2)] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={cn(
                        "h-9 w-9 rounded-md shrink-0 overflow-hidden relative",
                        coverFor(p.id)
                      )}
                    >
                      <span className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] text-[var(--denoise-cream)] truncate font-medium">
                        {p.name}
                      </p>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--denoise-cream-muted)] mt-0.5">
                        {p.departments.length} Dept
                        {p.departments.length === 1 ? "" : "s"} · {open} Open
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <MiniProgress
                      percent={stats.progressPercent}
                      color="var(--denoise-copper)"
                    />
                    {utilization !== null && (
                      <MiniProgress
                        percent={utilization}
                        color={
                          utilization >= 90
                            ? "oklch(0.68 0.20 25)"
                            : utilization >= 70
                              ? "oklch(0.78 0.16 80)"
                              : "var(--denoise-cream-muted)"
                        }
                      />
                    )}
                  </div>

                  <HealthBadge health={stats.health} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
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
