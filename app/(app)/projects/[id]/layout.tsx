import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getProjectForUser } from "@/lib/server-data";
import { ProjectHeader } from "@/components/projects/project-header";
import { ProjectTabs } from "@/components/projects/project-tabs";
import {
  canEditProjectSettings,
  canDeleteProject,
  canViewAnalytics,
  isClientCaller,
} from "@/lib/permissions";

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
  const [canEdit, canDelete, canReports, isClient] = await Promise.all([
    canEditProjectSettings(ctx),
    canDeleteProject(ctx),
    canViewAnalytics(ctx),
    isClientCaller(ctx),
  ]);

  return (
    <div className="px-8 py-7 max-w-6xl mx-auto space-y-6">
      <ProjectHeader
        project={project}
        health={project.stats.health}
        canEdit={canEdit}
        canDelete={canDelete}
        canViewReports={canReports}
      />
      <ProjectTabs projectId={project.id} isClient={isClient} />
      {children}
    </div>
  );
}
