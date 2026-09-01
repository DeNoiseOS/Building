import "server-only";

/**
 * Backwards-compatibility shim (Phase 4 of the backend cleanup).
 *
 * Every read helper lives in `lib/queries/*.ts` now. This file
 * re-exports them all so existing `@/lib/server-data` imports keep
 * working. A follow-up commit will migrate consumers to the new
 * paths and then this file goes away.
 */

export {
  getProjectsForUser,
  getProjectForUser,
  getProjectChoicesForUser,
  type ProjectDetail,
} from "@/lib/queries/projects";

export { getDashboardForUser, type DashboardData } from "@/lib/queries/dashboard";

export { getTasksForUser, type TaskSummary, type TaskFilters } from "@/lib/queries/tasks";

export { getProjectDepartmentFilterContext } from "@/lib/queries/filters";

export { getActivityForUser, type ActivitySummary } from "@/lib/queries/activity";

export {
  getCalendarEventsForUser,
  type CalendarEventSummary,
} from "@/lib/queries/calendar";
