import { z } from "zod";

/**
 * V0.28 — Home Command Center: Zod schemas.
 *
 * The persisted shape is `HomeLayoutSchema.widgets: WidgetInstance[]`.
 * Every widget instance carries: grid geometry (x, y, w, h) + a
 * `WidgetConfig` discriminated union that owns the per-instance
 * configuration for its widget type.
 *
 * Zod is the source of truth. Both the reader (lib/widgets/layout-server)
 * and every server action call `.parse()`, so a corrupt row can never
 * poison the render.
 */

// ─────────────────────────────────────────────────────────────────────
// Vocabularies (kept aligned with lib/roles.ts + the activity-type set)
// ─────────────────────────────────────────────────────────────────────

export const TASK_STATUS_VALUES = [
  "todo",
  "in_progress",
  "waiting_approval",
  "done",
] as const;

export const TASK_PRIORITY_VALUES = ["low", "medium", "high"] as const;

// Only kinds our data currently emits (see getCalendarEventsForUser).
export const CALENDAR_EVENT_KIND_VALUES = [
  "task_due",
  "project_start",
  "project_end",
  "shoot_day",
] as const;

export const DATE_WINDOW_VALUES = [
  "overdue",
  "today",
  "tomorrow",
  "this_week",
  "next_7d",
  "next_30d",
  "no_due",
] as const;

// ─────────────────────────────────────────────────────────────────────
// Scope unions used across multiple widget configs
// ─────────────────────────────────────────────────────────────────────

export const ProjectScopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("all") }),
  z.object({ kind: z.literal("mine") }),
  z.object({ kind: z.literal("assigned") }),
  z.object({
    kind: z.literal("role"),
    roles: z.array(z.string()).min(1),
  }),
  z.object({
    kind: z.literal("specific"),
    projectIds: z.array(z.string()).min(1),
  }),
]);
export type ProjectScope = z.infer<typeof ProjectScopeSchema>;

export const AssigneeScopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("me") }),
  z.object({ kind: z.literal("unassigned") }),
  z.object({ kind: z.literal("everyone") }),
  z.object({
    kind: z.literal("specific"),
    userIds: z.array(z.string()).min(1),
  }),
]);
export type AssigneeScope = z.infer<typeof AssigneeScopeSchema>;

export const DateWindowSchema = z.union([
  z.enum(DATE_WINDOW_VALUES),
  z.object({
    kind: z.literal("custom"),
    from: z.string(), // ISO date
    to: z.string(),
  }),
]);
export type DateWindow = z.infer<typeof DateWindowSchema>;

// ─────────────────────────────────────────────────────────────────────
// Per-widget configuration schemas
// ─────────────────────────────────────────────────────────────────────

export const KPI_METRIC_VALUES = [
  "open_tasks",
  "overdue_tasks",
  "completed_tasks",
  "projects_active",
  "budget_used_pct",
  "pending_approvals",
  "expenses_count",
  "scenes_count",
  "activity_count",
] as const;

export const KpiConfigSchema = z.object({
  metric: z.enum(KPI_METRIC_VALUES),
  scope: ProjectScopeSchema.default({ kind: "all" }),
  dateRange: DateWindowSchema.optional(),
  label: z.string().optional(),
});
export type KpiConfig = z.infer<typeof KpiConfigSchema>;

export const TasksConfigSchema = z.object({
  scope: ProjectScopeSchema.default({ kind: "all" }),
  assignee: AssigneeScopeSchema.default({ kind: "me" }),
  statuses: z.array(z.enum(TASK_STATUS_VALUES)).default(["todo", "in_progress"]),
  priorities: z.array(z.enum(TASK_PRIORITY_VALUES)).default(["low", "medium", "high"]),
  dateWindows: z.array(DateWindowSchema).default([]),
  groupBy: z.enum(["project", "assignee", "status", "due", "none"]).default("none"),
  sortBy: z.enum(["due", "priority", "updated", "created", "project"]).default("due"),
  display: z.enum(["count", "list", "grouped", "metrics_list"]).default("list"),
  title: z.string().optional(),
});
export type TasksConfig = z.infer<typeof TasksConfigSchema>;

export const CalendarConfigSchema = z.object({
  scope: ProjectScopeSchema.default({ kind: "all" }),
  eventKinds: z
    .array(z.enum(CALENDAR_EVENT_KIND_VALUES))
    .default(["task_due", "project_start", "project_end"]),
  view: z.enum(["agenda", "day", "3day", "week", "month"]).default("agenda"),
});
export type CalendarConfig = z.infer<typeof CalendarConfigSchema>;

export const TimelineConfigSchema = z.object({
  sources: z.array(z.enum(["tasks", "scenes"])).default(["tasks", "scenes"]),
  scope: ProjectScopeSchema.default({ kind: "all" }),
  dateRange: DateWindowSchema.default("next_7d"),
  groupBy: z.enum(["day", "project", "department", "phase"]).default("day"),
});
export type TimelineConfig = z.infer<typeof TimelineConfigSchema>;

export const ActivityConfigSchema = z.object({
  scope: ProjectScopeSchema.default({ kind: "all" }),
  types: z.array(z.string()).optional(), // undefined => all types
  dateRange: DateWindowSchema.default("next_7d"),
  display: z.enum(["count", "feed", "grouped"]).default("feed"),
  actorFilter: z
    .union([z.enum(["mine", "all"]), z.object({ userIds: z.array(z.string()).min(1) })])
    .default("all"),
});
export type ActivityConfig = z.infer<typeof ActivityConfigSchema>;

export const ProjectsConfigSchema = z.object({
  scope: ProjectScopeSchema.default({ kind: "all" }),
  display: z.enum(["grid", "pulse"]).default("pulse"),
  fields: z
    .object({
      cover: z.boolean().default(true),
      progress: z.boolean().default(true),
      health: z.boolean().default(true),
      budget: z.boolean().default(true),
      openTasks: z.boolean().default(true),
      overdueTasks: z.boolean().default(false),
      dates: z.boolean().default(false),
      team: z.boolean().default(false),
    })
    .default({
      cover: true,
      progress: true,
      health: true,
      budget: true,
      openTasks: true,
      overdueTasks: false,
      dates: false,
      team: false,
    }),
  atRiskOnly: z.boolean().default(false),
});
export type ProjectsConfig = z.infer<typeof ProjectsConfigSchema>;

// Coming-soon widgets carry only their advertised label + the future
// registry key they represent.
export const ComingSoonConfigSchema = z.object({
  widgetType: z.string(),
  label: z.string(),
});
export type ComingSoonConfig = z.infer<typeof ComingSoonConfigSchema>;

// ─────────────────────────────────────────────────────────────────────
// Widget type + discriminated union
// ─────────────────────────────────────────────────────────────────────

export const IMPLEMENTED_WIDGET_TYPES = [
  "kpi",
  "tasks",
  "activity",
  "timeline",
  "projects",
  "calendar",
] as const;

export const FUTURE_WIDGET_TYPES = [
  "scenes",
  "shoot_days",
  "milestones",
  "production_health",
  "budget",
  "expenses",
  "approvals",
  "team",
  "workload",
  "departments",
  "assets",
  "deliverables",
  "announcements",
  "mentions",
  "inbox",
  "charts",
  "quick_actions",
  "smart_insights",
] as const;

export const WIDGET_TYPE_VALUES = [
  ...IMPLEMENTED_WIDGET_TYPES,
  ...FUTURE_WIDGET_TYPES,
] as const;

export type WidgetType = (typeof WIDGET_TYPE_VALUES)[number];

/** Discriminated union tying widget type → its config schema. */
export const WidgetConfigSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("kpi"), config: KpiConfigSchema }),
  z.object({ type: z.literal("tasks"), config: TasksConfigSchema }),
  z.object({ type: z.literal("calendar"), config: CalendarConfigSchema }),
  z.object({ type: z.literal("timeline"), config: TimelineConfigSchema }),
  z.object({ type: z.literal("activity"), config: ActivityConfigSchema }),
  z.object({ type: z.literal("projects"), config: ProjectsConfigSchema }),
  // All future widget types share one placeholder config shape so they
  // can be dropped onto the canvas today and rendered as "coming soon"
  // without waiting for their real implementation.
  ...FUTURE_WIDGET_TYPES.map((t) =>
    z.object({ type: z.literal(t), config: ComingSoonConfigSchema }),
  ),
]);
export type WidgetConfig = z.infer<typeof WidgetConfigSchema>;

// ─────────────────────────────────────────────────────────────────────
// Widget instance + layout
// ─────────────────────────────────────────────────────────────────────

/** Grid geometry. Grid is 12 cols; rows are unbounded. */
export const WidgetGeometrySchema = z.object({
  x: z.number().int().min(0).max(11),
  y: z.number().int().min(0),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1).max(24),
});
export type WidgetGeometry = z.infer<typeof WidgetGeometrySchema>;

export const WidgetInstanceSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().optional(),
    hidden: z.boolean().optional(),
  })
  .merge(WidgetGeometrySchema)
  .and(WidgetConfigSchema);
export type WidgetInstance = z.infer<typeof WidgetInstanceSchema>;

export const HomeLayoutSchema = z.object({
  version: z.literal(1),
  widgets: z.array(WidgetInstanceSchema),
});
export type HomeLayout = z.infer<typeof HomeLayoutSchema>;

/** Safe parse a value stored in Prisma.Json. Returns `null` if invalid. */
export function parseHomeLayoutJson(raw: unknown): HomeLayout | null {
  const r = HomeLayoutSchema.safeParse(raw);
  return r.success ? r.data : null;
}
