import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { userHasProjectAccess } from "@/lib/access";
import { canViewAnalytics } from "@/lib/permissions";
import { getProjectAnalytics } from "@/lib/analytics";
import { ProjectStatsGrid } from "@/components/analytics/project-stats-grid";
import { FinancialOverview } from "@/components/analytics/financial-overview";
import { DepartmentAnalytics } from "@/components/analytics/department-analytics";
import { ResourceAnalytics } from "@/components/analytics/resource-analytics";
import { TeamAnalytics } from "@/components/analytics/team-analytics";
import { BarChart3, Lock } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * V0.15 — Project analytics dashboard.
 *
 * Mounted on the existing "Reports" tab. Gated by canViewAnalytics
 * (Owner / Executive Producer / Producer). Anyone else lands on a
 * locked-screen explanation.
 */
export default async function ProjectAnalyticsPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const access = await userHasProjectAccess(session.user.id, id);
  if (!access) notFound();

  const allowed = await canViewAnalytics({
    userId: session.user.id,
    projectId: id,
  });
  if (!allowed) {
    return (
      <div className="pt-2">
        <div className="rounded-2xl border border-dashed border-white/[0.08] py-16 px-6 flex flex-col items-center text-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-muted-foreground">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Analytics is restricted</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              The project-wide analytics dashboard is visible to the project
              owner, executive producer, and producer only.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const analytics = await getProjectAnalytics(id);

  return (
    <div className="pt-2 space-y-6">
      <header className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Project-wide budget, custody, purchase, resource, and team
            roll-ups.
          </p>
        </div>
      </header>

      <ProjectStatsGrid summary={analytics.summary} />

      <FinancialOverview
        data={analytics.financial}
        currency={analytics.summary.currency}
      />

      <DepartmentAnalytics
        rows={analytics.departments}
        topSpending={analytics.topSpendingDepartments}
        currency={analytics.summary.currency}
      />

      <ResourceAnalytics data={analytics.resources} />

      <TeamAnalytics data={analytics.team} />
    </div>
  );
}
