import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProjectForUser } from "@/lib/server-data";
import { ProjectHeader } from "@/components/projects/project-header";
import { ProjectTabs } from "@/components/projects/project-tabs";
import { ResetSandboxButton } from "@/components/projects/reset-sandbox-button";
import {
  canEditProjectSettings,
  canDeleteProject,
  canViewAnalytics,
  isClientCaller,
} from "@/lib/permissions";
import { isProtectedDemoProject } from "@/lib/quick-login-seed";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function ProjectLayout({ children, params }: LayoutProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const project = await getProjectForUser(session.user.id, id);
  if (!project) notFound();

  // V0.12.1 — gate the Edit / Delete actions in the header.
  // V0.21 — also gate the Reports button.
  const ctx = { userId: session.user.id, projectId: id };
  const [canEdit, canDelete, canReports, isClient, isSandbox] =
    await Promise.all([
      canEditProjectSettings(ctx),
      canDeleteProject(ctx),
      canViewAnalytics(ctx),
      isClientCaller(ctx),
      isProtectedDemoProject(id),
    ]);

  // V0.26.3 — Reset button visible only to the Producer inside the
  // Full Fledge sandbox while quick-login is on.
  let canResetSandbox = false;
  if (isSandbox) {
    const membership = await prisma.projectMember.findFirst({
      where: { projectId: id, userId: session.user.id },
      select: { role: true },
    });
    canResetSandbox = membership?.role === "producer";
  }

  return (
    <div className="px-8 py-7 max-w-6xl mx-auto space-y-6">
      <ProjectHeader
        project={project}
        health={project.stats.health}
        canEdit={canEdit}
        canDelete={canDelete}
        canViewReports={canReports}
        resetButton={
          canResetSandbox ? <ResetSandboxButton projectId={id} /> : null
        }
      />
      <ProjectTabs projectId={project.id} isClient={isClient} />
      {children}
    </div>
  );
}
