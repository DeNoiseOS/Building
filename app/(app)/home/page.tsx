import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { projectAccessFilter } from "@/lib/access";
import { canManageAnnouncement } from "@/lib/announcements";
import { roleTier } from "@/lib/hierarchy";
import { Badge } from "@/components/ui/badge";
import { NewTaskButton } from "@/components/tasks/new-task-button";
import { ProgressRing } from "@/components/shared/progress-ring";
import {
  AlertCircle,
  ArrowUpRight,
  AtSign,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  DollarSign,
  ListTodo,
  Mail,
  Megaphone,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { computeProjectStats } from "@/lib/project-stats";

/**
 * V0.8 — Home Workspace.
 *
 * Personal command centre. Answers "what do I need to do today?"
 *
 * This file is a composition layer only — no new tables, no new APIs.
 * Every section is a focused read on existing models, joined into a
 * single greeting screen and prioritised by the viewer's tier.
 */

type Tier = "producer" | "director" | "department_head" | "department_member";

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function money(cents: number, currency: string) {
  return (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
}

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const firstName = session.user.name?.split(" ")[0] ?? "there";

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // ─── Caller meta: email + memberships + tier ────────────────────────
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    select: { projectId: true, role: true },
  });
  const tiers = memberships
    .map((m) => roleTier(m.role))
    .filter((t): t is NonNullable<typeof t> => t !== null);
  const tier: Tier = tiers.includes("producer")
    ? "producer"
    : tiers.includes("director")
      ? "director"
      : tiers.includes("department_head")
        ? "department_head"
        : "department_member";

  // ─── Big parallel fetch ─────────────────────────────────────────────
  const accessFilter = projectAccessFilter(userId);

  const [
    assignedDueToday,
    assignedThisWeek,
    assignedOverdue,
    pendingInvitations,
    unreadMentions,
    discussionReplies,
    unreadAnnouncementNotifs,
    expensesPendingHeadApproval,
    revisionsAwaitingProducer,
    departmentRows,
    announcements,
    activeProjects,
  ] = await Promise.all([
    prisma.task.findMany({
      where: {
        assigneeId: userId,
        status: { not: "done" },
        dueDate: { gte: startOfToday, lt: endOfToday },
      },
      orderBy: { dueDate: "asc" },
      include: { project: { select: { id: true, name: true } } },
      take: 8,
    }),
    prisma.task.findMany({
      where: {
        assigneeId: userId,
        status: { not: "done" },
        dueDate: { gte: endOfToday, lt: endOfWeek },
      },
      orderBy: { dueDate: "asc" },
      include: { project: { select: { id: true, name: true } } },
      take: 10,
    }),
    prisma.task.findMany({
      where: {
        assigneeId: userId,
        status: { not: "done" },
        dueDate: { lt: startOfToday },
      },
      orderBy: { dueDate: "asc" },
      include: { project: { select: { id: true, name: true } } },
      take: 10,
    }),
    me?.email
      ? prisma.projectInvitation.count({
          where: { email: me.email, status: "pending" },
        })
      : Promise.resolve(0),
    prisma.notification.findMany({
      where: {
        userId,
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
      take: 6,
    }),
    prisma.notification.count({
      where: {
        userId,
        readAt: null,
        type: { in: ["discussion_created", "discussion_reply"] },
      },
    }),
    prisma.notification.count({
      where: { userId, readAt: null, type: "announcement_created" },
    }),
    // Expenses awaiting department-head approval — only show if caller
    // is the head of the request's department.
    prisma.budgetRequest.findMany({
      where: {
        status: { in: ["submitted", "pending_department_approval"] },
        OR: [
          { department: { members: { some: { userId, role: "lead" } } } },
          {
            department: {
              kind: { in: memberships.map((m) => m.role) },
            },
            project: { members: { some: { userId } } },
          },
        ],
      },
      include: {
        department: { select: { id: true, name: true } },
        requester: { select: { name: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    // Budget revisions awaiting producer/owner action.
    prisma.departmentBudget.findMany({
      where: {
        status: "revision_requested",
        project: {
          OR: [
            { userId },
            { members: { some: { userId, role: "producer" } } },
          ],
        },
      },
      include: {
        department: { select: { id: true, name: true } },
        project: { select: { id: true, name: true, currency: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    // My departments + their open tasks + pending expense count + budget.
    prisma.departmentMember.findMany({
      where: { userId, department: { project: accessFilter } },
      include: {
        department: {
          include: {
            project: { select: { id: true, name: true, currency: true } },
            budget: true,
            tasks: {
              where: { status: { not: "done" } },
              select: { id: true },
            },
            budgetRequests: {
              where: {
                status: { in: ["submitted", "pending_department_approval"] },
              },
              select: { id: true },
            },
          },
        },
      },
    }),
    // Recent announcements across accessible projects.
    prisma.announcement.findMany({
      where: {
        project: accessFilter,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 5,
      include: {
        project: { select: { id: true, name: true } },
        author: { select: { name: true } },
      },
    }),
    // Active projects — Project Pulse + project picker.
    prisma.project.findMany({
      where: { AND: [accessFilter, { status: "active" }] },
      orderBy: { endDate: "asc" },
      include: {
        tasks: { select: { status: true, dueDate: true } },
        departments: { select: { id: true } },
        departmentBudgets: { select: { approvedAmount: true } },
        budgetRequests: {
          where: { status: "purchased" },
          select: { estimatedCost: true, departmentId: true },
        },
      },
      take: 8,
    }),
  ]);

  // ─── Spent-by-department aggregation (for "remaining" math) ─────────
  const spentByDept = new Map<string, number>();
  for (const p of activeProjects) {
    for (const r of p.budgetRequests) {
      spentByDept.set(
        r.departmentId,
        (spentByDept.get(r.departmentId) ?? 0) + r.estimatedCost
      );
    }
  }
  const spentByProject = new Map<string, number>();
  for (const p of activeProjects) {
    spentByProject.set(
      p.id,
      p.budgetRequests.reduce((s, r) => s + r.estimatedCost, 0)
    );
  }

  // ─── Attention queue ────────────────────────────────────────────────
  const attention: {
    key: string;
    icon: React.ReactNode;
    label: string;
    href: string;
    tone: "primary" | "amber" | "red";
  }[] = [];

  if (assignedOverdue.length > 0)
    attention.push({
      key: "overdue",
      icon: <AlertCircle className="h-4 w-4" />,
      label: `${assignedOverdue.length} overdue task${assignedOverdue.length === 1 ? "" : "s"}`,
      href: "/tasks?mine=1",
      tone: "red",
    });
  if (assignedDueToday.length > 0)
    attention.push({
      key: "today",
      icon: <Clock className="h-4 w-4" />,
      label: `${assignedDueToday.length} due today`,
      href: "/tasks?mine=1",
      tone: "amber",
    });
  if (expensesPendingHeadApproval.length > 0)
    attention.push({
      key: "expense",
      icon: <ShieldCheck className="h-4 w-4" />,
      label: `${expensesPendingHeadApproval.length} expense approval${expensesPendingHeadApproval.length === 1 ? "" : "s"} waiting`,
      href: `/projects/${expensesPendingHeadApproval[0].project.id}/budget`,
      tone: "amber",
    });
  if (revisionsAwaitingProducer.length > 0)
    attention.push({
      key: "revision",
      icon: <Wallet className="h-4 w-4" />,
      label: `${revisionsAwaitingProducer.length} budget revision${revisionsAwaitingProducer.length === 1 ? "" : "s"} pending`,
      href: `/projects/${revisionsAwaitingProducer[0].project.id}/budget`,
      tone: "primary",
    });
  if (pendingInvitations > 0)
    attention.push({
      key: "inv",
      icon: <Mail className="h-4 w-4" />,
      label: `${pendingInvitations} pending invitation${pendingInvitations === 1 ? "" : "s"}`,
      href: "/inbox",
      tone: "primary",
    });
  if (unreadMentions.length > 0)
    attention.push({
      key: "mentions",
      icon: <AtSign className="h-4 w-4" />,
      label: `${unreadMentions.length} unread mention${unreadMentions.length === 1 ? "" : "s"}`,
      href: unreadMentions[0]?.link ?? "/tasks?mine=1",
      tone: "primary",
    });
  if (discussionReplies > 0)
    attention.push({
      key: "discussion",
      icon: <MessageCircle className="h-4 w-4" />,
      label: `${discussionReplies} discussion repl${discussionReplies === 1 ? "y" : "ies"}`,
      href: "/activity",
      tone: "primary",
    });
  if (unreadAnnouncementNotifs > 0)
    attention.push({
      key: "ann",
      icon: <Megaphone className="h-4 w-4" />,
      label: `${unreadAnnouncementNotifs} new announcement${unreadAnnouncementNotifs === 1 ? "" : "s"}`,
      href: announcements[0]
        ? `/projects/${announcements[0].project.id}/announcements`
        : "/dashboard",
      tone: "primary",
    });

  // Role-aware reordering.
  const weight: Record<string, number> = (() => {
    if (tier === "producer")
      return { revision: 6, overdue: 5, expense: 4, today: 3, mentions: 2, ann: 1, discussion: 1, inv: 1 };
    if (tier === "director")
      return { overdue: 6, today: 5, ann: 4, mentions: 3, expense: 2, revision: 1, discussion: 1, inv: 1 };
    if (tier === "department_head")
      return { expense: 6, today: 5, overdue: 4, mentions: 3, discussion: 2, ann: 1, revision: 1, inv: 1 };
    return { today: 6, overdue: 5, mentions: 4, discussion: 3, ann: 2, inv: 1, expense: 1, revision: 1 };
  })();
  attention.sort((a, b) => (weight[b.key] ?? 0) - (weight[a.key] ?? 0));

  // ─── Quick-action permissions ───────────────────────────────────────
  let canCreateAnnouncement = false;
  for (const m of memberships) {
    if (await canManageAnnouncement({ userId, projectId: m.projectId })) {
      canCreateAnnouncement = true;
      break;
    }
  }
  const canInviteSomewhere = memberships.some((m) =>
    ["producer", "director", "art_director", "camera_department", "sound_department", "editor", "location_manager", "casting_manager"].includes(
      m.role
    )
  );

  const defaultProject = activeProjects[0];
  const projectChoices = activeProjects.map((p) => ({ id: p.id, name: p.name }));

  // Deduplicate departments (a user can match a dept by both DepartmentMember
  // and ProjectMember.role).
  const seenDept = new Set<string>();
  const myDepartments = departmentRows.filter((d) => {
    if (seenDept.has(d.department.id)) return false;
    seenDept.add(d.department.id);
    return true;
  });

  // Recent activity per department (last 7 days) — parsed from metadata.
  const recentActivityByDept = new Map<string, number>();
  if (myDepartments.length > 0) {
    const acts = await prisma.activity.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { metadata: true, projectId: true },
    });
    for (const a of acts) {
      if (!a.metadata) continue;
      try {
        const meta = JSON.parse(a.metadata) as { departmentId?: string };
        if (meta.departmentId) {
          recentActivityByDept.set(
            meta.departmentId,
            (recentActivityByDept.get(meta.departmentId) ?? 0) + 1
          );
        }
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <div className="px-8 py-7 max-w-7xl mx-auto space-y-7">
      {/* Section 1 — Greeting */}
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {timeGreeting()}, {firstName}{" "}
            <span className="inline-block">👋</span>
          </h1>
          <p className="text-muted-foreground mt-1.5">
            Welcome back. Today is {format(now, "EEEE, MMMM d")}.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {defaultProject && (
            <NewTaskButton
              projectChoices={projectChoices}
              currentUser={{
                id: userId,
                name: session.user.name ?? "Me",
              }}
              variant="outline"
            />
          )}
          {defaultProject && (
            <Link
              href={`/projects/${defaultProject.id}/budget`}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] text-sm transition-colors"
            >
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              New expense
            </Link>
          )}
          {canCreateAnnouncement && defaultProject && (
            <Link
              href={`/projects/${defaultProject.id}/announcements`}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] text-sm transition-colors"
            >
              <Megaphone className="h-4 w-4 text-muted-foreground" />
              New announcement
            </Link>
          )}
          {canInviteSomewhere && defaultProject && (
            <Link
              href={`/projects/${defaultProject.id}/members`}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] text-sm transition-colors"
            >
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              Invite
            </Link>
          )}
        </div>
      </header>

      {/* Section 2 — Attention Queue */}
      {attention.length > 0 && (
        <section className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
          <div className="px-5 py-4 border-b border-white/[0.04]">
            <h2 className="text-base font-semibold">My attention queue</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Items that need a decision from you.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
            {attention.map((a) => (
              <Link
                key={a.key}
                href={a.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
                  a.tone === "red" &&
                    "border-red-400/25 bg-red-400/[0.08] hover:bg-red-400/[0.12]",
                  a.tone === "amber" &&
                    "border-amber-400/25 bg-amber-400/[0.08] hover:bg-amber-400/[0.12]",
                  a.tone === "primary" &&
                    "border-primary/25 bg-primary/[0.08] hover:bg-primary/[0.12]"
                )}
              >
                <span
                  className={cn(
                    "h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
                    a.tone === "red" && "bg-red-400/15 text-red-300",
                    a.tone === "amber" && "bg-amber-400/15 text-amber-300",
                    a.tone === "primary" && "bg-primary/15 text-primary"
                  )}
                >
                  {a.icon}
                </span>
                <p className="text-sm font-medium flex-1">{a.label}</p>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Section 3 — My Work */}
      <section className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
        <div className="px-5 py-4 border-b border-white/[0.04] flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">My work</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Assigned to you · grouped by due window.
            </p>
          </div>
          <Link
            href="/tasks?mine=1"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            View all
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 divide-x divide-white/[0.04]">
          <TaskGroup
            title="Overdue"
            tone="red"
            tasks={assignedOverdue}
            emptyLabel="Nothing slipping."
          />
          <TaskGroup
            title="Due today"
            tone="amber"
            tasks={assignedDueToday}
            emptyLabel="Nothing due today."
          />
          <TaskGroup
            title="This week"
            tone="neutral"
            tasks={assignedThisWeek}
            emptyLabel="Clear week ahead."
          />
        </div>
      </section>

      {/* Section 4 — My Departments */}
      {myDepartments.length > 0 && (
        <section className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
          <div className="px-5 py-4 border-b border-white/[0.04]">
            <h2 className="text-base font-semibold">My departments</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Departments you belong to across all projects.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
            {myDepartments.map(({ department: d }) => {
              const approved = d.budget?.approvedAmount ?? null;
              const spent = spentByDept.get(d.id) ?? 0;
              const remaining = approved !== null ? approved - spent : null;
              const recentCount = recentActivityByDept.get(d.id) ?? 0;
              return (
                <Link
                  key={d.id}
                  href={`/projects/${d.project.id}/departments/${d.id}`}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-8 w-8 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                      <Building2 className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{d.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {d.project.name}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3 text-[11px]">
                    <Mini label="Open tasks" value={String(d.tasks.length)} />
                    <Mini
                      label="Remaining"
                      value={
                        remaining !== null
                          ? money(remaining, d.project.currency ?? "USD")
                          : "—"
                      }
                    />
                    <Mini
                      label="Pending"
                      value={String(d.budgetRequests.length)}
                      accent="amber"
                    />
                    <Mini
                      label="Last 7 days"
                      value={`${recentCount} event${recentCount === 1 ? "" : "s"}`}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Section 5 + 6 row — Mentions / Announcements */}
      {(unreadMentions.length > 0 || announcements.length > 0) && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {unreadMentions.length > 0 && (
            <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
              <div className="px-5 py-4 border-b border-white/[0.04]">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <AtSign className="h-4 w-4 text-muted-foreground" />
                  Recent mentions
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
          {announcements.length > 0 && (
            <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
              <div className="px-5 py-4 border-b border-white/[0.04]">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-muted-foreground" />
                  Latest announcements
                </h2>
              </div>
              <ol className="p-2.5 space-y-0.5">
                {announcements.map((a) => (
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
        </section>
      )}

      {/* Section 7 — Project Pulse */}
      {activeProjects.length > 0 && (
        <section className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
          <div className="px-5 py-4 border-b border-white/[0.04]">
            <h2 className="text-base font-semibold">Project pulse</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              At-a-glance awareness — open the project for the deep dive.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
            {activeProjects.map((p) => {
              const stats = computeProjectStats({
                startDate: p.startDate,
                endDate: p.endDate,
                tasks: p.tasks.map((t) => ({
                  status: t.status,
                  dueDate: t.dueDate,
                })),
                now,
              });
              const approved = p.departmentBudgets.reduce(
                (s, b) => s + (b.approvedAmount ?? 0),
                0
              );
              const spent = spentByProject.get(p.id) ?? 0;
              const utilization =
                approved > 0
                  ? Math.min(100, Math.round((spent / approved) * 100))
                  : null;
              const open = p.tasks.filter((t) => t.status !== "done").length;
              return (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-colors flex items-center gap-3"
                >
                  <ProgressRing percent={stats.progressPercent} size={56} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{p.name}</p>
                    <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <ListTodo className="h-3 w-3" />
                        {open} open
                      </span>
                      <span className="opacity-30">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Wallet className="h-3 w-3" />
                        {utilization !== null ? `${utilization}% used` : "—"}
                      </span>
                      <span className="opacity-30">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {p.departments.length} depts
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Empty-state fallback */}
      {attention.length === 0 &&
        assignedDueToday.length === 0 &&
        assignedThisWeek.length === 0 &&
        assignedOverdue.length === 0 &&
        myDepartments.length === 0 &&
        announcements.length === 0 &&
        unreadMentions.length === 0 &&
        activeProjects.length === 0 && (
          <div className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft p-10 text-center">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-base font-semibold">All clear</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Nothing needs your attention right now. Open{" "}
              <Link href="/dashboard" className="underline">
                Dashboard
              </Link>{" "}
              for the cross-project picture.
            </p>
          </div>
        )}
    </div>
  );
}

function Mini({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "amber";
}) {
  return (
    <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "font-semibold tabular-nums text-[12px]",
          accent === "amber" && value !== "0" && "text-amber-200"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function TaskGroup({
  title,
  tone,
  tasks,
  emptyLabel,
}: {
  title: string;
  tone: "red" | "amber" | "neutral";
  tasks: Array<{
    id: string;
    title: string;
    dueDate: Date | null;
    project: { id: string; name: string };
  }>;
  emptyLabel: string;
}) {
  return (
    <div className="px-5 py-4 space-y-2 min-h-[120px]">
      <div className="flex items-center justify-between">
        <h3
          className={cn(
            "text-sm font-semibold flex items-center gap-1.5",
            tone === "red" && "text-red-300",
            tone === "amber" && "text-amber-200"
          )}
        >
          {tone === "red" ? (
            <AlertCircle className="h-3.5 w-3.5" />
          ) : tone === "amber" ? (
            <CalendarClock className="h-3.5 w-3.5" />
          ) : (
            <ClipboardList className="h-3.5 w-3.5" />
          )}
          {title}
        </h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {tasks.length}
        </span>
      </div>
      {tasks.length === 0 ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          {emptyLabel}
        </div>
      ) : (
        <ol className="space-y-0.5">
          {tasks.slice(0, 5).map((t) => (
            <li key={t.id}>
              <Link
                href={`/projects/${t.project.id}/tasks`}
                className="block px-2 py-1.5 rounded-md hover:bg-white/[0.04]"
              >
                <p className="text-sm truncate">{t.title}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {t.project.name}
                  {t.dueDate ? ` · ${format(t.dueDate, "MMM d")}` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
