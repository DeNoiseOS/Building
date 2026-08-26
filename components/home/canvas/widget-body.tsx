import type { WidgetInstance } from "@/lib/widgets/schema";
import type { WidgetData } from "@/lib/widgets/data/fetch-all";
import type { Density } from "./use-density";
import { TasksWidget } from "@/components/home/widgets/tasks-widget";
import { KpiWidget } from "@/components/home/widgets/kpi-widget";
import { ActivityWidget } from "@/components/home/widgets/activity-widget";
import { TimelineWidget } from "@/components/home/widgets/timeline-widget";
import { ProjectsWidget } from "@/components/home/widgets/projects-widget";
import { CalendarWidget } from "@/components/home/widgets/calendar-widget";
import { ComingSoonWidget } from "@/components/home/widgets/coming-soon-widget";

/**
 * V0.28 Phase B — Widget body dispatcher.
 *
 * Given a widget instance, its pre-fetched data payload, and its
 * current density tier, render the matching widget. Any type mismatch
 * (widget instance vs. data payload) falls through to the coming-soon
 * placeholder rather than crashing the canvas.
 */
export function WidgetBody({
  instance,
  data,
  density,
}: {
  instance: WidgetInstance;
  data: WidgetData | undefined;
  density: Density;
}) {
  if (!data) return <Loading />;

  switch (instance.type) {
    case "tasks":
      if (data.type !== "tasks") return <Loading />;
      return (
        <TasksWidget
          config={instance.config}
          data={data.value}
          density={density}
        />
      );
    case "kpi":
      if (data.type !== "kpi") return <Loading />;
      return (
        <KpiWidget
          config={instance.config}
          data={data.value}
          density={density}
        />
      );
    case "activity":
      if (data.type !== "activity") return <Loading />;
      return <ActivityWidget data={data.value} density={density} />;
    case "timeline":
      if (data.type !== "timeline") return <Loading />;
      return <TimelineWidget data={data.value} density={density} />;
    case "projects":
      if (data.type !== "projects") return <Loading />;
      return (
        <ProjectsWidget
          config={instance.config}
          data={data.value}
          density={density}
        />
      );
    case "calendar":
      if (data.type !== "calendar") return <Loading />;
      return <CalendarWidget data={data.value} density={density} />;
    default:
      return (
        <ComingSoonWidget
          type={instance.type}
          config={instance.config as { widgetType: string; label: string }}
        />
      );
  }
}

function Loading() {
  return (
    <div className="h-full flex items-center px-4 py-3 text-[11px] text-[var(--denoise-cream-muted)] uppercase tracking-[0.16em]">
      Loading…
    </div>
  );
}
