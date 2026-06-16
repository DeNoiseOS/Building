import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getProjectChoicesForUser } from "@/lib/server-data";
import { AppShell } from "@/components/shell/app-shell";
import { prisma } from "@/lib/prisma";
import type { NotificationData } from "@/components/shell/notification-menu";
import { CompletionBanner } from "@/components/profile/completion-banner";
import { computeProfileCompletion } from "@/lib/profile-completion";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const userId = session.user.id;

  const [projects, me] = await Promise.all([
    getProjectChoicesForUser(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        profileImage: true,
        primaryRole: true,
        additionalRoles: true,
        experienceLevel: true,
        location: true,
        languages: true,
        contactPhone: true,
        contactWebsite: true,
        portfolioLinks: true,
        profileSkippedAt: true,
      },
    }),
  ]);

  // V0.3: collaboration awareness data for the shell.
  const email = me?.email ?? "";

  const [
    pendingInvitationsRows,
    assignedTasksRows,
    totalInvitations,
    totalAssignedOpen,
    recentNotifications,
    unreadNotifications,
  ] = await Promise.all([
    prisma.projectInvitation.findMany({
      where: { email, status: "pending" },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        project: { select: { id: true, name: true } },
        inviter: { select: { name: true } },
      },
    }),
    prisma.task.findMany({
      where: {
        assigneeId: userId,
        status: { not: "done" },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 5,
      include: {
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.projectInvitation.count({
      where: { email, status: "pending" },
    }),
    prisma.task.count({
      where: { assigneeId: userId, status: { not: "done" } },
    }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.notification.count({
      where: { userId, readAt: null },
    }),
  ]);

  const notifications: NotificationData = {
    invitations: pendingInvitationsRows.map((i) => ({
      id: i.id,
      projectId: i.project.id,
      projectName: i.project.name,
      role: i.role,
      invitedBy: i.inviter.name,
      createdAt: i.createdAt.toISOString(),
    })),
    tasks: assignedTasksRows.map((t) => ({
      id: t.id,
      title: t.title,
      projectId: t.project.id,
      projectName: t.project.name,
      dueDate: t.dueDate?.toISOString() ?? null,
    })),
    totalAssignedOpen,
    totalInvitations,
    // V0.5 — feed the bell's notification table.
    items: recentNotifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount: unreadNotifications,
  };

  const completion = me
    ? computeProfileCompletion({
        profileImage: me.profileImage,
        primaryRole: me.primaryRole,
        additionalRoles: me.additionalRoles,
        experienceLevel: me.experienceLevel,
        location: me.location,
        languages: me.languages,
        contactPhone: me.contactPhone,
        contactWebsite: me.contactWebsite,
        portfolioLinks: me.portfolioLinks,
      })
    : null;
  const showCompletionBanner =
    !!completion &&
    completion.percent < 100 &&
    !me?.profileSkippedAt;

  return (
    <AppShell
      userName={session.user.name ?? "User"}
      userEmail={session.user.email ?? ""}
      projects={projects}
      pendingInvitations={totalInvitations + unreadNotifications}
      notifications={notifications}
    >
      {showCompletionBanner && completion && (
        <CompletionBanner
          percent={completion.percent}
          missing={completion.missing}
        />
      )}
      {children}
    </AppShell>
  );
}
