import { StatCard } from "./stat-card";
import type { SceneAnalytics as SceneAnalyticsData } from "@/lib/analytics";

/**
 * V0.17 — Scene analytics block. Counts by scene status + dept review
 * + blocked dept totals. Renders empty-friendly when no scenes exist.
 */
export function SceneAnalytics({ data }: { data: SceneAnalyticsData }) {
  return (
    <section className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
      <div className="px-5 py-4 border-b border-white/[0.04]">
        <h2 className="text-base font-semibold">Scene Planning</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Scenes by status and department review state.
        </p>
      </div>
      <div className="p-3 grid grid-cols-2 md:grid-cols-7 gap-3">
        <StatCard label="Total" value={data.total.toLocaleString()} />
        <StatCard
          label="Draft"
          value={data.byStatus.draft.toLocaleString()}
        />
        <StatCard
          label="Planning"
          value={data.byStatus.planning.toLocaleString()}
          accent="warn"
        />
        <StatCard
          label="Ready"
          value={data.byStatus.ready.toLocaleString()}
          accent="good"
        />
        <StatCard
          label="Scheduled"
          value={data.byStatus.scheduled.toLocaleString()}
          accent="primary"
        />
        <StatCard
          label="Shot"
          value={data.byStatus.shot.toLocaleString()}
        />
        <StatCard
          label="Completed"
          value={data.byStatus.completed.toLocaleString()}
          accent="good"
        />
      </div>
      <div className="p-3 pt-0 grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          label="Pending reviews"
          value={data.pendingReviews.toLocaleString()}
          accent={data.pendingReviews > 0 ? "warn" : "default"}
        />
        <StatCard
          label="Approved depts"
          value={data.approvedDepartments.toLocaleString()}
          accent="good"
        />
        <StatCard
          label="Blocked depts"
          value={data.blockedDepartments.toLocaleString()}
          accent={data.blockedDepartments > 0 ? "danger" : "default"}
        />
      </div>
    </section>
  );
}
