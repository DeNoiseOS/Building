import type { LucideIcon } from "lucide-react";
import {
  Activity as ActivityIconLucide,
  BarChart3,
  Bell,
  Boxes,
  Building2,
  Calendar as CalendarIcon,
  CheckSquare,
  ClipboardList,
  Clock,
  DollarSign,
  Film,
  FolderKanban,
  Gauge,
  Hash,
  Inbox,
  LayoutDashboard,
  ListTodo,
  Megaphone,
  MessageCircle,
  Package,
  Sparkles,
  Target,
  Users,
  Video,
  Wallet,
  Zap,
} from "lucide-react";
import type { WidgetType, WidgetConfig } from "./schema";
import {
  ActivityConfigSchema,
  CalendarConfigSchema,
  ComingSoonConfigSchema,
  KpiConfigSchema,
  ProjectsConfigSchema,
  TasksConfigSchema,
  TimelineConfigSchema,
} from "./schema";
import type { ZodTypeAny } from "zod";

/**
 * V0.28 — Widget registry.
 *
 * Every widget type advertises: display metadata, grid constraints, a
 * default configuration, and (in Phase C) a renderer + configuration
 * UI. This file is the ONE place a new widget type needs to be added.
 *
 * Renderers + config UIs land in Phase C — the definitions here carry
 * only the fields Phase A + B need to enumerate available widgets,
 * seed defaults, and add instances to a layout.
 */

export type WidgetCategory =
  | "Work"
  | "Production"
  | "Finance"
  | "Team"
  | "Content"
  | "System"
  | "AI";

export interface WidgetDefinition<T extends WidgetType = WidgetType> {
  type: T;
  name: string;
  description: string;
  icon: LucideIcon;
  category: WidgetCategory;
  /** Grid units. */
  minW: number;
  minH: number;
  maxW?: number;
  maxH?: number;
  defaultW: number;
  defaultH: number;
  /** Zod schema for `config` on a WidgetInstance of this type. */
  configSchema: ZodTypeAny;
  /** Default configuration used by the add-widget flow + defaults. */
  defaultConfig: () => WidgetConfig;
  /**
   * true for widgets whose renderer + config UI ship in Phase C.
   * false for future-scoped widgets that render as "coming soon".
   */
  implemented: boolean;
}

// ─── Implemented widgets ────────────────────────────────────────────

const KPI: WidgetDefinition<"kpi"> = {
  type: "kpi",
  name: "KPI",
  description: "A single number — open tasks, budget used, approvals, more.",
  icon: Hash,
  category: "System",
  minW: 2,
  minH: 1,
  maxW: 6,
  maxH: 3,
  defaultW: 3,
  defaultH: 1,
  configSchema: KpiConfigSchema,
  defaultConfig: () => ({
    type: "kpi",
    config: KpiConfigSchema.parse({
      metric: "open_tasks",
      scope: { kind: "all" },
    }),
  }),
  implemented: true,
};

const TASKS: WidgetDefinition<"tasks"> = {
  type: "tasks",
  name: "Tasks",
  description: "Any slice of tasks by scope, assignee, status, or due date.",
  icon: ListTodo,
  category: "Work",
  minW: 2,
  minH: 1,
  defaultW: 4,
  defaultH: 3,
  configSchema: TasksConfigSchema,
  defaultConfig: () => ({
    type: "tasks",
    config: TasksConfigSchema.parse({}),
  }),
  implemented: true,
};

const CALENDAR: WidgetDefinition<"calendar"> = {
  type: "calendar",
  name: "Calendar",
  description: "Tasks, projects and dates on a calendar surface.",
  icon: CalendarIcon,
  category: "Work",
  minW: 3,
  minH: 2,
  defaultW: 6,
  defaultH: 4,
  configSchema: CalendarConfigSchema,
  defaultConfig: () => ({
    type: "calendar",
    config: CalendarConfigSchema.parse({}),
  }),
  implemented: true,
};

const TIMELINE: WidgetDefinition<"timeline"> = {
  type: "timeline",
  name: "Timeline",
  description: "Production sequence — upcoming tasks and scheduled scenes.",
  icon: Clock,
  category: "Work",
  minW: 3,
  minH: 2,
  defaultW: 4,
  defaultH: 3,
  configSchema: TimelineConfigSchema,
  defaultConfig: () => ({
    type: "timeline",
    config: TimelineConfigSchema.parse({}),
  }),
  implemented: true,
};

const ACTIVITY: WidgetDefinition<"activity"> = {
  type: "activity",
  name: "Activity",
  description: "Recent events across accessible projects.",
  icon: ActivityIconLucide,
  category: "Work",
  minW: 3,
  minH: 2,
  defaultW: 4,
  defaultH: 4,
  configSchema: ActivityConfigSchema,
  defaultConfig: () => ({
    type: "activity",
    config: ActivityConfigSchema.parse({}),
  }),
  implemented: true,
};

const PROJECTS: WidgetDefinition<"projects"> = {
  type: "projects",
  name: "Project Pulse",
  description: "Health, progress and budget across active productions.",
  icon: Gauge,
  category: "Production",
  minW: 3,
  minH: 2,
  defaultW: 4,
  defaultH: 3,
  configSchema: ProjectsConfigSchema,
  defaultConfig: () => ({
    type: "projects",
    config: ProjectsConfigSchema.parse({}),
  }),
  implemented: true,
};

// ─── Coming-soon widgets ────────────────────────────────────────────
// Each is registered so it appears in the add-widget picker, but its
// renderer will show a "coming soon" tile until Phase C+ lands its
// real implementation.

function comingSoon(
  type: WidgetType,
  name: string,
  description: string,
  icon: LucideIcon,
  category: WidgetCategory,
  defaultW = 3,
  defaultH = 2
): WidgetDefinition {
  return {
    type,
    name,
    description,
    icon,
    category,
    minW: 2,
    minH: 1,
    defaultW,
    defaultH,
    configSchema: ComingSoonConfigSchema,
    defaultConfig: () =>
      ({
        type,
        config: { widgetType: type, label: name },
      }) as WidgetConfig,
    implemented: false,
  };
}

const COMING_SOON: WidgetDefinition[] = [
  comingSoon("scenes", "Scenes", "Scene planning across productions.", Video, "Production"),
  comingSoon("shoot_days", "Shoot Days", "Upcoming shoot days.", Film, "Production"),
  comingSoon("milestones", "Milestones", "Production milestones.", Target, "Production"),
  comingSoon("production_health", "Production Health", "Cross-project health signals.", Gauge, "Production"),
  comingSoon("budget", "Budget", "Budget allocation & utilization.", Wallet, "Finance"),
  comingSoon("expenses", "Expenses", "Expense activity & approvals.", DollarSign, "Finance"),
  comingSoon("approvals", "Approvals", "Pending approvals across departments.", CheckSquare, "Finance"),
  comingSoon("team", "Team", "People and roles.", Users, "Team"),
  comingSoon("workload", "Workload", "Load per assignee.", ClipboardList, "Team"),
  comingSoon("departments", "Departments", "Departments overview.", Building2, "Team"),
  comingSoon("assets", "Assets", "Media & references.", Package, "Content"),
  comingSoon("deliverables", "Deliverables", "Deliverables tracker.", Boxes, "Content"),
  comingSoon("announcements", "Announcements", "Latest announcements.", Megaphone, "Content"),
  comingSoon("mentions", "Mentions", "Your mentions across projects.", MessageCircle, "Content"),
  comingSoon("inbox", "Inbox", "Notifications.", Inbox, "Content"),
  comingSoon("charts", "Charts", "Custom analytics charts.", BarChart3, "System", 4, 3),
  comingSoon("quick_actions", "Quick Actions", "One-tap shortcuts.", Zap, "System"),
  comingSoon("smart_insights", "Smart Insights", "AI-suggested next steps.", Sparkles, "AI", 3, 2),
];

// ─── Registry map ───────────────────────────────────────────────────

export const WIDGET_REGISTRY: Record<WidgetType, WidgetDefinition> = {
  kpi: KPI,
  tasks: TASKS,
  calendar: CALENDAR,
  timeline: TIMELINE,
  activity: ACTIVITY,
  projects: PROJECTS,
  ...Object.fromEntries(COMING_SOON.map((d) => [d.type, d])),
} as Record<WidgetType, WidgetDefinition>;

export function widgetDefinition(type: WidgetType): WidgetDefinition {
  const d = WIDGET_REGISTRY[type];
  if (!d) throw new Error(`Unknown widget type: ${type}`);
  return d;
}

/** Group registry entries by category for the add-widget picker. */
export function widgetsByCategory(): Record<WidgetCategory, WidgetDefinition[]> {
  const out: Record<WidgetCategory, WidgetDefinition[]> = {
    Work: [],
    Production: [],
    Finance: [],
    Team: [],
    Content: [],
    System: [],
    AI: [],
  };
  for (const d of Object.values(WIDGET_REGISTRY)) {
    out[d.category].push(d);
  }
  return out;
}

// Icons re-exported so registry consumers don't need to import from
// lucide-react directly.
export {
  ActivityIconLucide,
  CalendarIcon,
  Clock,
  FolderKanban,
  Gauge,
  Hash,
  LayoutDashboard,
  ListTodo,
  Bell,
};
