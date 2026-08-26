import Link from "next/link";
import { format, isToday } from "date-fns";
import { AlertCircle, CheckCircle2, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TasksConfig } from "@/lib/widgets/schema";
import type { TasksResult } from "@/lib/widgets/data/tasks";
import type { Density } from "@/components/home/canvas/use-density";

/**
 * V0.28 Phase B — Tasks widget.
 *
 * The widget's information density is a pure function of the tier
 * passed in (which is derived from the grid footprint by useDensity).
 * The widget itself is not visually scaled.
 *
 *   micro    (1x1)      → single count
 *   compact  (2x1, 3x1) → count + one sub-line
 *   standard (2x2..4x2) → short list, no metadata
 *   expanded (3x3..)    → grouped list with due chips
 *   full     (5x4+)     → full detail rows with assignee + project
 */
export function TasksWidget({
  config,
  data,
  density,
}: {
  config: TasksConfig;
  data: TasksResult;
  density: Density;
}) {
  const { tasks, totalCount, overdueCount, todayCount } = data;

  if (totalCount === 0) {
    return (
      <div className="h-full flex items-center gap-2 px-4 py-3 text-[12px] text-[var(--denoise-cream-muted)]">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400/70 shrink-0" />
        No tasks match this configuration.
      </div>
    );
  }

  if (density === "micro") {
    return (
      <div className="h-full flex flex-col justify-center px-4 py-3">
        <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--denoise-cream-muted)]">
          Tasks
        </div>
        <div className="text-[28px] font-semibold text-[var(--denoise-cream)] tabular-nums leading-none mt-2">
          {totalCount}
        </div>
      </div>
    );
  }

  if (density === "compact") {
    return (
      <div className="h-full flex flex-col justify-center px-4 py-3">
        <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--denoise-cream-muted)]">
          Tasks
        </div>
        <div className="text-[28px] font-semibold text-[var(--denoise-cream)] tabular-nums leading-none mt-1.5">
          {totalCount}
        </div>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--denoise-cream-muted)]">
          {overdueCount > 0 && (
            <span className="text-[var(--denoise-copper)] tabular-nums">
              {overdueCount} overdue
            </span>
          )}
          {overdueCount > 0 && todayCount > 0 && (
            <span className="opacity-40">·</span>
          )}
          {todayCount > 0 && <span className="tabular-nums">{todayCount} today</span>}
          {overdueCount === 0 && todayCount === 0 && <span>All clear</span>}
        </div>
      </div>
    );
  }

  if (density === "standard") {
    // Grouped by "overdue then upcoming" — no per-task metadata.
    const overdue = tasks.filter(
      (t) =>
        t.status !== "done" &&
        t.dueDate &&
        t.dueDate.getTime() < startOfToday().getTime()
    );
    const rest = tasks.filter((t) => !overdue.includes(t));
    return (
      <div className="h-full flex flex-col min-h-0">
        <MetricStrip
          total={totalCount}
          overdue={overdueCount}
          today={todayCount}
        />
        <div className="flex-1 min-h-0 overflow-auto">
          {overdue.length > 0 && (
            <Group label="Overdue" tone="copper">
              {overdue.slice(0, 6).map((t) => (
                <MiniRow key={t.id} title={t.title} href={taskHref(t)} />
              ))}
            </Group>
          )}
          {rest.length > 0 && (
            <Group label="Upcoming" tone="muted">
              {rest.slice(0, 8).map((t) => (
                <MiniRow
                  key={t.id}
                  title={t.title}
                  href={taskHref(t)}
                  meta={t.dueDate ? shortDue(t.dueDate) : undefined}
                />
              ))}
            </Group>
          )}
        </div>
      </div>
    );
  }

  if (density === "expanded") {
    // Full row per task — title + project + due chip
    return (
      <div className="h-full flex flex-col min-h-0">
        <MetricStrip
          total={totalCount}
          overdue={overdueCount}
          today={todayCount}
        />
        <ul className="flex-1 min-h-0 overflow-auto divide-y divide-[var(--denoise-border)]">
          {tasks.map((t) => (
            <li key={t.id}>
              <Link
                href={taskHref(t)}
                className="grid grid-cols-[1fr_auto] gap-2 px-4 py-2 hover:bg-[var(--denoise-surface-2)] transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-[13px] text-[var(--denoise-cream)] truncate">
                    {t.title}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--denoise-cream-muted)] mt-0.5 truncate">
                    {t.project.name}
                    {config.assignee.kind !== "me" && t.assignee
                      ? ` · ${t.assignee.name}`
                      : ""}
                  </p>
                </div>
                {t.dueDate && (
                  <DueChip date={t.dueDate} status={t.status} />
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // full — dense multi-column table
  return (
    <div className="h-full flex flex-col min-h-0">
      <MetricStrip
        total={totalCount}
        overdue={overdueCount}
        today={todayCount}
      />
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-[12px]">
          <thead className="text-[10px] uppercase tracking-[0.14em] text-[var(--denoise-cream-muted)] sticky top-0 bg-[var(--denoise-surface)]">
            <tr className="border-b border-[var(--denoise-border)]">
              <th className="text-left px-4 py-2 font-medium">Task</th>
              <th className="text-left px-2 py-2 font-medium">Project</th>
              <th className="text-left px-2 py-2 font-medium">Assignee</th>
              <th className="text-left px-2 py-2 font-medium">Priority</th>
              <th className="text-left px-2 py-2 font-medium">Due</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr
                key={t.id}
                className="border-b border-[var(--denoise-border)] hover:bg-[var(--denoise-surface-2)] transition-colors"
              >
                <td className="px-4 py-2 truncate max-w-[220px]">
                  <Link
                    href={taskHref(t)}
                    className="text-[var(--denoise-cream)] hover:text-[var(--denoise-copper)]"
                  >
                    {t.title}
                  </Link>
                </td>
                <td className="px-2 py-2 text-[var(--denoise-cream-muted)] truncate max-w-[140px]">
                  {t.project.name}
                </td>
                <td className="px-2 py-2 text-[var(--denoise-cream-muted)] truncate max-w-[120px]">
                  {t.assignee?.name ?? "—"}
                </td>
                <td className="px-2 py-2">
                  <PriorityDot priority={t.priority} />
                </td>
                <td className="px-2 py-2 tabular-nums text-[var(--denoise-cream-muted)]">
                  {t.dueDate ? format(t.dueDate, "MMM d") : "—"}
                </td>
                <td className="px-4 py-2 text-[var(--denoise-cream-muted)] uppercase tracking-[0.12em] text-[10px]">
                  {t.status.replace(/_/g, " ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── sub-components ──────────────────────────────────────────────────

function MetricStrip({
  total,
  overdue,
  today,
}: {
  total: number;
  overdue: number;
  today: number;
}) {
  return (
    <div className="px-4 py-2 border-b border-[var(--denoise-border)] flex items-center gap-4 text-[11px] text-[var(--denoise-cream-muted)]">
      <span className="inline-flex items-center gap-1.5">
        <ListTodo className="h-3 w-3" />
        <span className="tabular-nums text-[var(--denoise-cream)]">{total}</span>
        total
      </span>
      {overdue > 0 && (
        <span className="text-[var(--denoise-copper)] tabular-nums">
          {overdue} overdue
        </span>
      )}
      {today > 0 && (
        <span className="tabular-nums">{today} today</span>
      )}
    </div>
  );
}

function Group({
  label,
  tone,
  children,
}: {
  label: string;
  tone: "copper" | "muted";
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-[var(--denoise-border)] last:border-b-0">
      <div
        className={cn(
          "px-4 pt-2 pb-1 text-[10px] uppercase tracking-[0.16em] flex items-center gap-1",
          tone === "copper"
            ? "text-[var(--denoise-copper)]"
            : "text-[var(--denoise-cream-muted)]"
        )}
      >
        {tone === "copper" && <AlertCircle className="h-3 w-3" />}
        {label}
      </div>
      <ul>{children}</ul>
    </div>
  );
}

function MiniRow({
  title,
  href,
  meta,
}: {
  title: string;
  href: string;
  meta?: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-2 px-4 py-1.5 hover:bg-[var(--denoise-surface-2)] transition-colors"
      >
        <span className="text-[12.5px] text-[var(--denoise-cream)] truncate flex-1">
          {title}
        </span>
        {meta && (
          <span className="text-[10px] tabular-nums text-[var(--denoise-cream-muted)] shrink-0">
            {meta}
          </span>
        )}
      </Link>
    </li>
  );
}

function DueChip({ date, status }: { date: Date; status: string }) {
  const isOverdue = status !== "done" && date.getTime() < startOfToday().getTime();
  const today = isToday(date);
  return (
    <span
      className={cn(
        "text-[10px] uppercase tracking-[0.14em] tabular-nums shrink-0 self-center",
        isOverdue
          ? "text-[var(--denoise-copper)]"
          : today
            ? "text-amber-300"
            : "text-[var(--denoise-cream-muted)]"
      )}
    >
      {format(date, "MMM d")}
    </span>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  const color =
    priority === "high"
      ? "bg-[var(--denoise-copper)]"
      : priority === "medium"
        ? "bg-amber-400/70"
        : "bg-white/[0.15]";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-1.5 w-1.5 rounded-full", color)} />
      <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--denoise-cream-muted)]">
        {priority}
      </span>
    </span>
  );
}

// ── helpers ─────────────────────────────────────────────────────────

function taskHref(t: { project: { id: string } }) {
  return `/projects/${t.project.id}/tasks`;
}
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function shortDue(d: Date): string {
  if (isToday(d)) return "Today";
  return format(d, "MMM d");
}
