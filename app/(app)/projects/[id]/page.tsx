import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/lib/auth";
import { getProjectForUser } from "@/lib/server-data";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HealthDot } from "@/components/shared/health-badge";
import { NewTaskButton } from "@/components/tasks/new-task-button";
import { ActivityFeed } from "@/components/shared/activity-feed";
import { ProgressRing } from "@/components/shared/progress-ring";
import {
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
} from "@/lib/roles";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ListTodo,
  CalendarDays,
  Activity as ActivityIconLg,
  LayoutPanelTop,
  Users as UsersIcon,
  UserCheck,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ id: string }>;
}

function relativeDue(date: Date, now: Date) {
  const ms = date.getTime() - now.getTime();
  const days = Math.round(ms / (1000 * 60 * 60 * 24));
  if (days < 0)
    return {
      label: `${Math.abs(days)}d overdue`,
      tone: "destructive" as const,
    };
  if (days === 0) return { label: "Today", tone: "default" as const };
  if (days === 1) return { label: "Tomorrow", tone: "default" as const };
  if (days <= 7) return { label: `In ${days}d`, tone: "default" as const };
  return { label: format(date, "MMM d"), tone: "secondary" as const };
}

export default async function ProjectOverviewPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const project = await getProjectForUser(session.user.id, id);
  if (!project) notFound();

  // V0.2: collaboration enrichment — members count, recently active members,
  // assigned-to-me task count. Owner is always counted as a member (auto-row).
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [
    membersCount,
    recentActiveCount,
    assignedToMeCount,
    openInvitationsCount,
    ownerCheck,
  ] = await Promise.all([
    prisma.projectMember.count({ where: { projectId: id } }),
    prisma.activity
      .findMany({
        where: {
          projectId: id,
          actorId: { not: null },
          createdAt: { gte: sevenDaysAgo },
        },
        select: { actorId: true },
        distinct: ["actorId"],
      })
      .then((rows) => rows.length),
    prisma.task.count({
      where: {
        projectId: id,
        assigneeId: session.user.id,
        status: { not: "done" },
      },
    }),
    prisma.projectInvitation.count({
      where: { projectId: id, status: "pending" },
    }),
    prisma.project.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    }),
  ]);
  const isOwner = !!ownerCheck;

  // V0.7 — latest announcement + recent mentions (project-scoped) for widgets.
  const [latestAnnouncement, recentMentions] = await Promise.all([
    prisma.announcement.findFirst({
      where: {
        projectId: id,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      include: { author: { select: { name: true } } },
    }),
    prisma.notification.findMany({
      where: {
        userId: session.user.id,
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
        readAt: null,
      },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
  ]);

  const now = new Date();
  const upcomingDeadlines = project.tasks
    .filter((t) => t.status !== "done" && t.dueDate !== null)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
    .slice(0, 6);

  const currentUser = {
    id: session.user.id,
    name: session.user.name ?? "Me",
  };

  const healthMessages: Record<typeof project.stats.health, string> = {
    healthy: "On track. Keep going.",
    watch: "A few things need attention.",
    at_risk: "Course-correct soon.",
  };

  return (
    <div className="space-y-6 pt-2">
      {/* Top row: Health + Progress + Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Health */}
        <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
              Project Health
            </span>
            <HealthDot health={project.stats.health} />
          </div>
          <p className="text-2xl font-semibold capitalize tracking-tight">
            {project.stats.health.replace("_", " ")}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {healthMessages[project.stats.health]}
          </p>
          <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
            {project.stats.healthMessage}
          </p>
        </div>

        {/* Progress ring */}
        <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft p-5 flex flex-col items-center">
          <div className="self-start flex items-center justify-between w-full mb-2">
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
              Progress
            </span>
            <span className="text-xs text-muted-foreground">
              Expected {project.stats.expectedProgress}%
            </span>
          </div>
          <ProgressRing
            percent={project.stats.progressPercent}
            size={140}
            label={`${project.stats.completedTasks}/${project.stats.totalTasks} tasks`}
          />
        </div>

        {/* Task stats */}
        <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft p-5">
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
            Task Statistics
          </span>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <StatPill
              icon={<ListTodo className="h-3.5 w-3.5" />}
              label="Total"
              value={project.stats.totalTasks}
            />
            <StatPill
              icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
              label="Completed"
              value={project.stats.completedTasks}
              accent="emerald"
            />
            <StatPill
              icon={<Clock className="h-3.5 w-3.5" />}
              label="Pending"
              value={project.stats.pendingTasks}
            />
            <StatPill
              icon={
                <AlertCircle
                  className={cn(
                    "h-3.5 w-3.5",
                    project.stats.overdueTasks > 0
                      ? "text-red-400"
                      : "text-muted-foreground"
                  )}
                />
              }
              label="Overdue"
              value={project.stats.overdueTasks}
              accent={project.stats.overdueTasks > 0 ? "red" : undefined}
            />
          </div>
        </div>
      </div>

      {/* Collaboration strip */}
      <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft px-5 py-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <UsersIcon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium tabular-nums">{membersCount}</span>
          <span className="text-muted-foreground">
            {membersCount === 1 ? "member" : "members"}
          </span>
        </div>
        <span className="h-3 w-px bg-white/[0.08]" />
        <div className="flex items-center gap-2 text-sm">
          <ActivityIconLg className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium tabular-nums">{recentActiveCount}</span>
          <span className="text-muted-foreground">active this week</span>
        </div>
        <span className="h-3 w-px bg-white/[0.08]" />
        <div className="flex items-center gap-2 text-sm">
          <UserCheck className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium tabular-nums">{assignedToMeCount}</span>
          <span className="text-muted-foreground">assigned to you</span>
        </div>
        {isOwner && (
          <>
            <span className="h-3 w-px bg-white/[0.08]" />
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium tabular-nums">
                {openInvitationsCount}
              </span>
              <span className="text-muted-foreground">
                open invitation{openInvitationsCount === 1 ? "" : "s"}
              </span>
            </div>
          </>
        )}
        <div className="ml-auto">
          <Link
            href={`/projects/${project.id}/members`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Manage members →
          </Link>
        </div>
      </div>

      {/* V0.7 — Latest announcement + recent mentions widgets */}
      {(latestAnnouncement || recentMentions.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {latestAnnouncement && (
            <Link
              href={`/projects/${project.id}/announcements`}
              className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft p-5 hover:bg-card/80 transition-colors"
            >
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
                <span>Latest announcement</span>
                {latestAnnouncement.pinned && (
                  <Badge
                    variant="outline"
                    className="border-primary/30 bg-primary/10 text-primary"
                  >
                    Pinned
                  </Badge>
                )}
              </div>
              <h3 className="text-base font-semibold mt-2 truncate">
                {latestAnnouncement.title}
              </h3>
              <p className="text-sm text-foreground/80 line-clamp-2 mt-1">
                {latestAnnouncement.body}
              </p>
              <p className="text-[11px] text-muted-foreground mt-2">
                {latestAnnouncement.author.name} ·{" "}
                {new Date(latestAnnouncement.createdAt).toLocaleDateString()}
              </p>
            </Link>
          )}
          {recentMentions.length > 0 && (
            <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft p-5">
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
                Recent mentions
              </div>
              <ol className="mt-2 space-y-1.5">
                {recentMentions.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={n.link ?? "#"}
                      className="text-sm hover:underline truncate block"
                    >
                      {n.title}
                    </Link>
                    {n.body && (
                      <p className="text-[11px] text-muted-foreground truncate">
                        {n.body}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Middle row: Upcoming + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Upcoming */}
        <div className="lg:col-span-3 rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
            <div>
              <h2 className="text-base font-semibold flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                Upcoming Deadlines
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                The next tasks due for this production
              </p>
            </div>
            <NewTaskButton
              projectId={project.id}
              currentUser={currentUser}
              variant="outline"
              size="sm"
            />
          </div>
          <div className="p-3">
            {upcomingDeadlines.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                No upcoming deadlines.
              </div>
            ) : (
              <ol className="space-y-0.5">
                {upcomingDeadlines.map((task) => {
                  const due = task.dueDate ? new Date(task.dueDate) : null;
                  const dueInfo = due ? relativeDue(due, now) : null;
                  return (
                    <li
                      key={task.id}
                      className="flex items-center justify-between gap-3 px-2.5 py-2.5 rounded-lg hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm leading-tight truncate">
                          {task.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                          <span>{TASK_STATUS_LABELS[task.status] ?? task.status}</span>
                          <span className="opacity-30">·</span>
                          <span>{TASK_PRIORITY_LABELS[task.priority] ?? task.priority}</span>
                        </div>
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
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>

        {/* Activity */}
        <div className="lg:col-span-2 rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <ActivityIconLg className="h-4 w-4 text-muted-foreground" />
              Recent Activity
            </h2>
            <Link
              href={`/projects/${project.id}/activity`}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View all
            </Link>
          </div>
          <div className="p-5">
            <ActivityFeed
              items={project.activities}
              showProject={false}
              emptyLabel="Activity will appear as you work on this project."
            />
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold">Quick Actions</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Keep things moving on this production
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <NewTaskButton
            projectId={project.id}
            currentUser={currentUser}
            variant="outline"
          />
          <Link
            href={`/projects/${project.id}/tasks`}
            className="inline-flex items-center gap-2 text-sm px-3 h-9 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
          >
            <ListTodo className="h-4 w-4" />
            Open Tasks
          </Link>
          <Link
            href={`/projects/${project.id}/workspace`}
            className="inline-flex items-center gap-2 text-sm px-3 h-9 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
          >
            <LayoutPanelTop className="h-4 w-4" />
            Open Workspace
          </Link>
          <Link
            href={`/projects/${project.id}/calendar`}
            className="inline-flex items-center gap-2 text-sm px-3 h-9 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
          >
            <CalendarDays className="h-4 w-4" />
            Calendar
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatPill({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent?: "emerald" | "red";
}) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p
        className={cn(
          "text-2xl font-semibold mt-0.5 tabular-nums tracking-tight",
          accent === "red" && value > 0 && "text-red-300",
          accent === "emerald" && value > 0 && "text-emerald-300"
        )}
      >
        {value}
      </p>
    </div>
  );
}
