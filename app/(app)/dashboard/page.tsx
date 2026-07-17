import Link from "next/link";
import { format } from "date-fns";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDashboardForUser } from "@/lib/server-data";
import { prisma } from "@/lib/prisma";
import { roleTier } from "@/lib/hierarchy";
import { Badge } from "@/components/ui/badge";
import { NewProjectButton } from "@/components/projects/new-project-button";
import { NewTaskButton } from "@/components/tasks/new-task-button";
import { ProjectCard } from "@/components/projects/project-card";
import { ActivityFeed } from "@/components/shared/activity-feed";
import { MetricCard } from "@/components/shared/metric-card";
import { ProgressRing } from "@/components/shared/progress-ring";
import { HealthDot } from "@/components/shared/health-badge";
import { TASK_PRIORITY_LABELS } from "@/lib/roles";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FolderKanban,
  ListTodo,
  Sparkles,
  Calendar,
  ArrowUpRight,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";

function relativeDue(date: Date, now: Date) {
  const ms = date.getTime() - now.getTime();
  const days = Math.round(ms / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, tone: "destructive" as const };
  if (days === 0) return { label: "Today", tone: "default" as const };
  if (days === 1) return { label: "Tomorrow", tone: "default" as const };
  if (days <= 7) return { label: `In ${days}d`, tone: "default" as const };
  return { label: format(date, "MMM d"), tone: "secondary" as const };
}

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const now = new Date();
  const data = await getDashboardForUser(session.user.id, now);
  const firstName = session.user.name?.split(" ")[0] ?? "there";

  // V0.2: surface pending invitations addressed to this user's email.
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });
  const pendingInvitationsCount = me
    ? await prisma.projectInvitation.count({
        where: { email: me.email, status: "pending" },
      })
    : 0;

  // V0.7 — Recent announcements + unread mentions across all projects.
  const [recentAnnouncements, unreadMentions] = await Promise.all([
    prisma.announcement.findMany({
      where: {
        project: {
          OR: [
            { userId: session.user.id },
            { members: { some: { userId: session.user.id } } },
          ],
        },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 4,
      include: {
        project: { select: { id: true, name: true } },
        author: { select: { name: true } },
      },
    }),
    prisma.notification.findMany({
      where: {
        userId: session.user.id,
        readAt: null,
        type: {
          in: [
            "mention_task",
            "mention_budget",
            "mention_note",
            "mention_reference",
            "mention_announcement",
            "mention_discussion",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  // V0.5 — pick the highest-tier role the caller holds across their
  // accessible projects to drive the dashboard's "viewing as" hint. The
  // existing widgets already render the right data for everyone; this is
  // a thin label tweak rather than a redesign.
  const myMemberships = await prisma.projectMember.findMany({
    where: { userId: session.user.id },
    select: { role: true },
  });
  const tiers = myMemberships
    .map((m: { role: string }) => roleTier(m.role))
    .filter((t): t is NonNullable<typeof t> => t !== null);
  const viewerTier: "producer" | "director" | "department_head" | "department_member" =
    tiers.includes("producer")
      ? "producer"
      : tiers.includes("director")
        ? "director"
        : tiers.includes("department_head")
          ? "department_head"
          : "department_member";
  const viewerTierLabel: Record<typeof viewerTier, string> = {
    producer: "Producer view — across every department.",
    director: "Director view — every department, with filters.",
    department_head: "Head view — your departments and assignments.",
    department_member: "Member view — your tasks and assignments.",
  };

  // V0.5 — count tasks awaiting your approval.
  const awaitingApprovalCount = await prisma.task.count({
    where: {
      status: "waiting_approval",
      project: {
        OR: [
          { userId: session.user.id },
          {
            members: {
              some: {
                userId: session.user.id,
                role: { in: ["producer", "director"] },
              },
            },
          },
        ],
      },
    },
  });

  // V0.3: Assigned-to-me widget — open tasks across all projects the user
  // has access to. Cap the preview list; show the full total separately.
  const [assignedToMe, assignedToMeTotal] = await Promise.all([
    prisma.task.findMany({
      where: { assigneeId: session.user.id, status: { not: "done" } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 6,
      include: { project: { select: { id: true, name: true } } },
    }),
    prisma.task.count({
      where: { assigneeId: session.user.id, status: { not: "done" } },
    }),
  ]);
  const currentUser = {
    id: session.user.id,
    name: session.user.name ?? "Me",
  };

  // Health score = average of project progress vs expected, clamped 0-100.
  const overallHealth =
    data.activeProjects.length > 0
      ? Math.round(
          data.activeProjects.reduce(
            (sum, p) => sum + p.stats.progressPercent,
            0
          ) / data.activeProjects.length
        )
      : 0;

  const healthCounts = data.activeProjects.reduce(
    (acc, p) => {
      acc[p.stats.health] += 1;
      return acc;
    },
    { healthy: 0, watch: 0, at_risk: 0 } as Record<string, number>
  );

  return (
    <div className="px-8 py-7 max-w-7xl mx-auto space-y-8">
      {/* Hero greeting */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {timeGreeting()}, {firstName}{" "}
            <span className="inline-block">👋</span>
          </h1>
          <p className="text-muted-foreground mt-1.5">
            {viewerTierLabel[viewerTier]}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NewTaskButton
            projectChoices={data.activeProjects.map((p) => ({
              id: p.id,
              name: p.name,
            }))}
            currentUser={currentUser}
            variant="outline"
          />
          <NewProjectButton />
        </div>
      </header>

      {awaitingApprovalCount > 0 && (
        <Link
          href="/tasks?status=waiting_approval"
          className="flex items-center gap-3 rounded-2xl bg-amber-400/10 border border-amber-400/25 px-5 py-3 hover:bg-amber-400/15 transition-colors"
        >
          <span className="h-9 w-9 rounded-xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
            <AlertCircle className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium">
              {awaitingApprovalCount} task
              {awaitingApprovalCount === 1 ? "" : "s"} awaiting your approval
            </p>
            <p className="text-xs text-muted-foreground">
              Review and approve or send back for revisions.
            </p>
          </div>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      )}

      {pendingInvitationsCount > 0 && (
        <Link
          href="/inbox"
          className="flex items-center gap-3 rounded-2xl bg-primary/10 border border-primary/25 px-5 py-3 hover:bg-primary/15 transition-colors"
        >
          <span className="h-9 w-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
            <Mail className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium">
              {pendingInvitationsCount} pending invitation
              {pendingInvitationsCount === 1 ? "" : "s"}
            </p>
            <p className="text-xs text-muted-foreground">
              Review and accept to join the production.
            </p>
          </div>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      )}

      {/* V0.7 — Recent announcements + mentions waiting */}
      {(recentAnnouncements.length > 0 || unreadMentions.length > 0) && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {recentAnnouncements.length > 0 && (
            <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
              <div className="px-5 py-4 border-b border-white/[0.04]">
                <h2 className="text-base font-semibold">Recent announcements</h2>
              </div>
              <ol className="p-2.5 space-y-0.5">
                {recentAnnouncements.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/projects/${a.project.id}/announcements`}
                      className="block px-2.5 py-2 rounded-lg hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          {a.title}
                        </p>
                        {a.pinned && (
                          <Badge
                            variant="outline"
                            className="border-primary/30 bg-primary/10 text-primary text-[10px]"
                          >
                            Pinned
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {a.project.name} · {a.author.name}
                      </p>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {unreadMentions.length > 0 && (
            <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
              <div className="px-5 py-4 border-b border-white/[0.04]">
                <h2 className="text-base font-semibold">
                  Mentions waiting for you
                </h2>
              </div>
              <ol className="p-2.5 space-y-0.5">
                {unreadMentions.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={n.link ?? "#"}
                      className="block px-2.5 py-2 rounded-lg hover:bg-white/[0.04] transition-colors"
                    >
                      <p className="text-sm font-medium truncate">{n.title}</p>
                      {n.body && (
                        <p className="text-[11px] text-muted-foreground truncate">
                          {n.body}
                        </p>
                      )}
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      )}

      {/* Metric strip */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={FolderKanban}
          label="Active Projects"
          value={data.quickStats.activeProjects}
          hint={
            data.activeProjects.length > 0
              ? `${healthCounts.healthy} on track`
              : "Create your first one"
          }
          tone="primary"
        />
        <MetricCard
          icon={ListTodo}
          label="Open Tasks"
          value={data.quickStats.openTasks}
          hint={
            data.quickStats.dueThisWeek > 0
              ? `${data.quickStats.dueThisWeek} due this week`
              : "Nothing due this week"
          }
        />
        <MetricCard
          icon={AlertCircle}
          label="Overdue"
          value={data.quickStats.overdueTasks}
          hint={
            data.quickStats.overdueTasks === 0
              ? "Nothing slipping"
              : "Needs attention"
          }
          tone={data.quickStats.overdueTasks > 0 ? "destructive" : "default"}
        />
        <MetricCard
          icon={CheckCircle2}
          label="Completed"
          value={data.quickStats.completedThisWeek}
          hint="This week"
          tone="success"
        />
      </section>

      {/* V0.3: Assigned-to-me widget */}
      <section className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              Assigned to you
              <span className="text-xs font-normal text-muted-foreground tabular-nums">
                ({assignedToMeTotal})
              </span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Open tasks where you&apos;re the assignee.
            </p>
          </div>
          <Link
            href="/tasks?mine=1"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
          >
            View all
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="p-2.5">
          {assignedToMe.length === 0 ? (
            <div className="flex items-center gap-2 px-2.5 py-6 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Nothing assigned to you right now.
            </div>
          ) : (
            <ol className="space-y-0.5">
              {assignedToMe.map((t) => {
                const due = t.dueDate ? new Date(t.dueDate) : null;
                const dueInfo = due ? relativeDue(due, now) : null;
                return (
                  <li key={t.id}>
                    <Link
                      href={`/projects/${t.project.id}/tasks`}
                      className="flex items-center justify-between gap-3 px-2.5 py-2.5 rounded-lg hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm leading-tight truncate">
                          {t.title}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {t.project.name}
                        </p>
                      </div>
                      {dueInfo && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0 text-[10px] py-0.5 px-2",
                            dueInfo.tone === "destructive"
                              ? "bg-red-400/10 text-red-300 border-red-400/25"
                              : "bg-white/[0.04] text-foreground/80 border-white/[0.06]"
                          )}
                        >
                          {dueInfo.label}
                        </Badge>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </section>

      {/* Magazine grid: left col (activity + tasks) — right col (health + deadlines) */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Left two-thirds */}
        <div className="xl:col-span-2 space-y-5">
          {/* Recent Activity */}
          <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
              <div>
                <h2 className="text-base font-semibold">Recent Activity</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Across all your productions
                </p>
              </div>
              <Link
                href="/activity"
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
              >
                View all
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="p-5">
              <ActivityFeed
                items={data.recentActivity}
                emptyLabel="Activity will appear here as you work on your productions."
              />
            </div>
          </div>

          {/* My Tasks (overdue + upcoming combined view) */}
          <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
              <div>
                <h2 className="text-base font-semibold">My Tasks</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Things needing your attention
                </p>
              </div>
              <Link
                href="/tasks"
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
              >
                View all
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="p-2.5">
              {data.overdueTasks.length === 0 &&
              data.upcomingTasks.length === 0 ? (
                <div className="flex items-center gap-2 px-2.5 py-6 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Nothing on your plate. Nice.
                </div>
              ) : (
                <ol className="space-y-1">
                  {data.overdueTasks.map((task) => {
                    const due = task.dueDate ? new Date(task.dueDate) : null;
                    const dueInfo = due ? relativeDue(due, now) : null;
                    return (
                      <li key={task.id}>
                        <Link
                          href={`/projects/${task.project.id}`}
                          className="flex items-center justify-between gap-3 px-2.5 py-2.5 rounded-lg hover:bg-white/[0.04] transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate leading-tight">
                                {task.title}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {task.project.name} ·{" "}
                                {TASK_PRIORITY_LABELS[task.priority]}
                              </p>
                            </div>
                          </div>
                          {dueInfo && (
                            <Badge
                              variant="outline"
                              className="bg-red-400/10 text-red-300 border-red-400/25 text-[10px] py-0.5 px-2"
                            >
                              {dueInfo.label}
                            </Badge>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                  {data.upcomingTasks.map((task) => {
                    const due = task.dueDate ? new Date(task.dueDate) : null;
                    const dueInfo = due ? relativeDue(due, now) : null;
                    return (
                      <li key={task.id}>
                        <Link
                          href={`/projects/${task.project.id}`}
                          className="flex items-center justify-between gap-3 px-2.5 py-2.5 rounded-lg hover:bg-white/[0.04] transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full shrink-0",
                                task.priority === "high"
                                  ? "bg-amber-400"
                                  : "bg-white/30"
                              )}
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate leading-tight">
                                {task.title}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {task.project.name} ·{" "}
                                {TASK_PRIORITY_LABELS[task.priority]}
                              </p>
                            </div>
                          </div>
                          {dueInfo && (
                            <Badge
                              variant="outline"
                              className="bg-white/[0.04] text-foreground/80 border-white/[0.06] text-[10px] py-0.5 px-2"
                            >
                              {dueInfo.label}
                            </Badge>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        </div>

        {/* Right one-third */}
        <div className="space-y-5">
          {/* Overall Health Ring */}
          <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft p-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold">Project Health</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Average across active projects
                </p>
              </div>
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="flex items-center justify-center py-3">
              <ProgressRing
                percent={overallHealth}
                size={160}
                label={
                  data.activeProjects.length === 0 ? "—" : "On Track"
                }
              />
            </div>
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/[0.04]">
              <HealthSummaryStat
                label="Healthy"
                count={healthCounts.healthy}
                color="emerald"
              />
              <HealthSummaryStat
                label="Watch"
                count={healthCounts.watch}
                color="amber"
              />
              <HealthSummaryStat
                label="Risk"
                count={healthCounts.at_risk}
                color="red"
              />
            </div>
          </div>

          {/* Upcoming Deadlines */}
          <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
              <h2 className="text-base font-semibold">Upcoming Deadlines</h2>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="p-3">
              {data.upcomingTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nothing on the horizon.
                </p>
              ) : (
                <ol className="space-y-0.5">
                  {data.upcomingTasks.slice(0, 5).map((task) => {
                    const due = task.dueDate ? new Date(task.dueDate) : null;
                    const dueInfo = due ? relativeDue(due, now) : null;
                    return (
                      <li key={task.id}>
                        <Link
                          href={`/projects/${task.project.id}`}
                          className="flex items-start gap-3 px-2.5 py-2 rounded-lg hover:bg-white/[0.04] transition-colors group"
                        >
                          <div className="text-center shrink-0 w-9">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                              {dueInfo?.label ?? "—"}
                            </p>
                            {due && (
                              <p className="text-sm font-semibold">
                                {format(due, "d")}
                              </p>
                            )}
                          </div>
                          <div className="min-w-0 flex-1 pt-0.5">
                            <p className="text-sm font-medium truncate leading-tight">
                              {task.title}
                            </p>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {task.project.name}
                            </p>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Active Projects */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Active Projects</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Productions you&apos;re working on
            </p>
          </div>
          {data.activeProjects.length > 0 && (
            <Link
              href="/projects"
              className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
            >
              View all
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {data.activeProjects.length === 0 ? (
          <div className="rounded-2xl bg-card/40 border border-dashed border-white/[0.08] py-16 px-6 flex flex-col items-center text-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1 max-w-md">
              <h3 className="text-lg font-semibold">Start your first project</h3>
              <p className="text-sm text-muted-foreground">
                DeNoise OS starts working the moment you add a production. Create
                one to begin tracking progress, deadlines, and what needs your
                attention.
              </p>
            </div>
            <NewProjectButton />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.activeProjects.map((project) => (
              <ProjectCard key={project.id} project={project} compact />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function HealthSummaryStat({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: "emerald" | "amber" | "red";
}) {
  const dotColors: Record<typeof color, string> = {
    emerald: "bg-emerald-400",
    amber: "bg-amber-400",
    red: "bg-red-400",
  };
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 rounded-full", dotColors[color])} />
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className="text-lg font-semibold mt-1 tabular-nums">{count}</p>
    </div>
  );
}
