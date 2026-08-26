import { randomBytes } from "node:crypto";
import type { HomeLayout, WidgetInstance } from "./schema";
import {
  ActivityConfigSchema,
  KpiConfigSchema,
  ProjectsConfigSchema,
  TasksConfigSchema,
  TimelineConfigSchema,
} from "./schema";

/**
 * V0.28 — Default home layout.
 *
 * Mirrors the V0.27.3 hand-crafted Home top-to-bottom, but every
 * section is now a real WidgetInstance the user can move, resize,
 * duplicate or replace.
 *
 * Grid is 12 columns wide. Rows are implicit.
 *
 *   ┌──── 3 ────┬──── 3 ────┬──── 3 ────┬──── 3 ────┐   ← KPI row (h=1)
 *   ├────────── 4 ─────────┬────── 4 ──┬────── 4 ───┤   ← operational row (h=3)
 *   ├────────── 4 ─────────┬────── 4 ──┬────── 4 ───┤   ← secondary row (h=4)
 */
export function defaultHomeLayout(): HomeLayout {
  const widgets: WidgetInstance[] = [
    // KPI row — 4 tiles
    {
      id: id(),
      x: 0,
      y: 0,
      w: 3,
      h: 1,
      type: "kpi",
      config: KpiConfigSchema.parse({
        metric: "open_tasks",
        scope: { kind: "all" },
      }),
    },
    {
      id: id(),
      x: 3,
      y: 0,
      w: 3,
      h: 1,
      type: "kpi",
      config: KpiConfigSchema.parse({
        metric: "overdue_tasks",
        scope: { kind: "all" },
      }),
    },
    {
      id: id(),
      x: 6,
      y: 0,
      w: 3,
      h: 1,
      type: "kpi",
      config: KpiConfigSchema.parse({
        metric: "budget_used_pct",
        scope: { kind: "all" },
      }),
    },
    {
      id: id(),
      x: 9,
      y: 0,
      w: 3,
      h: 1,
      type: "kpi",
      config: KpiConfigSchema.parse({
        metric: "pending_approvals",
        scope: { kind: "all" },
      }),
    },

    // Operational row — Tasks (Overdue/My) | Tasks (Today/My) | Project Pulse
    {
      id: id(),
      x: 0,
      y: 1,
      w: 4,
      h: 3,
      title: "My Overdue",
      type: "tasks",
      config: TasksConfigSchema.parse({
        scope: { kind: "all" },
        assignee: { kind: "me" },
        statuses: ["todo", "in_progress", "waiting_approval"],
        dateWindows: ["overdue"],
        sortBy: "due",
        display: "list",
      }),
    },
    {
      id: id(),
      x: 4,
      y: 1,
      w: 4,
      h: 3,
      title: "My Work — This Week",
      type: "tasks",
      config: TasksConfigSchema.parse({
        scope: { kind: "all" },
        assignee: { kind: "me" },
        statuses: ["todo", "in_progress", "waiting_approval"],
        dateWindows: ["today", "next_7d"],
        sortBy: "due",
        display: "list",
      }),
    },
    {
      id: id(),
      x: 8,
      y: 1,
      w: 4,
      h: 3,
      type: "projects",
      config: ProjectsConfigSchema.parse({
        scope: { kind: "all" },
        display: "pulse",
      }),
    },

    // Secondary row — Projects grid | Timeline | Activity
    {
      id: id(),
      x: 0,
      y: 4,
      w: 4,
      h: 4,
      title: "Active Projects",
      type: "projects",
      config: ProjectsConfigSchema.parse({
        scope: { kind: "all" },
        display: "grid",
      }),
    },
    {
      id: id(),
      x: 4,
      y: 4,
      w: 4,
      h: 4,
      type: "timeline",
      config: TimelineConfigSchema.parse({
        sources: ["tasks", "scenes"],
        scope: { kind: "all" },
        dateRange: "next_7d",
        groupBy: "day",
      }),
    },
    {
      id: id(),
      x: 8,
      y: 4,
      w: 4,
      h: 4,
      type: "activity",
      config: ActivityConfigSchema.parse({
        scope: { kind: "all" },
        dateRange: "next_30d",
        display: "feed",
      }),
    },
  ];

  return { version: 1, widgets };
}

/** Short random id — nanoid-style without the extra dep. */
function id(): string {
  return randomBytes(9).toString("base64url");
}
