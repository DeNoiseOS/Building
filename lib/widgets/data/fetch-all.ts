import "server-only";
import { log } from "@/lib/logger";
import type { WidgetInstance } from "@/lib/widgets/schema";
import { resolveKpi } from "./kpi";
import { resolveTasks } from "./tasks";
import { resolveActivity } from "./activity";
import { resolveTimeline } from "./timeline";
import { resolveProjects } from "./projects";
import { resolveCalendar } from "./calendar";

/**
 * V0.28 — Server-side batch fetch of every widget's data for a layout.
 *
 * Returns a map keyed by widget-instance id. Called once per Home
 * render; the client canvas hydrates from this map.
 *
 * Every resolver goes through resolveProjectScope() → intersected with
 * the caller's access filter, so an instance configured with
 * `scope: "all"` still returns only projects the user can see.
 */
export type WidgetData =
  | { type: "kpi"; value: Awaited<ReturnType<typeof resolveKpi>> }
  | { type: "tasks"; value: Awaited<ReturnType<typeof resolveTasks>> }
  | { type: "activity"; value: Awaited<ReturnType<typeof resolveActivity>> }
  | { type: "timeline"; value: Awaited<ReturnType<typeof resolveTimeline>> }
  | { type: "projects"; value: Awaited<ReturnType<typeof resolveProjects>> }
  | { type: "calendar"; value: Awaited<ReturnType<typeof resolveCalendar>> }
  | { type: "coming_soon" };

export async function fetchAllWidgetData(
  userId: string,
  widgets: WidgetInstance[],
): Promise<Record<string, WidgetData>> {
  const out: Record<string, WidgetData> = {};
  await Promise.all(
    widgets.map(async (w) => {
      try {
        switch (w.type) {
          case "kpi": {
            const value = await resolveKpi(userId, w.config);
            out[w.id] = { type: "kpi", value };
            return;
          }
          case "tasks": {
            const value = await resolveTasks(userId, w.config);
            out[w.id] = { type: "tasks", value };
            return;
          }
          case "activity": {
            const value = await resolveActivity(userId, w.config);
            out[w.id] = { type: "activity", value };
            return;
          }
          case "timeline": {
            const value = await resolveTimeline(userId, w.config);
            out[w.id] = { type: "timeline", value };
            return;
          }
          case "projects": {
            const value = await resolveProjects(userId, w.config);
            out[w.id] = { type: "projects", value };
            return;
          }
          case "calendar": {
            const value = await resolveCalendar(userId, w.config);
            out[w.id] = { type: "calendar", value };
            return;
          }
          default:
            out[w.id] = { type: "coming_soon" };
        }
      } catch (err) {
        log.error("[widgets] failed to resolve", {
          widgetType: w.type,
          widgetId: w.id,
          err: err instanceof Error ? err : String(err),
        });
        out[w.id] = { type: "coming_soon" };
      }
    }),
  );
  return out;
}
