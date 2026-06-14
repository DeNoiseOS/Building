import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getProjectForUser } from "@/lib/server-data";
import { ProjectHeader } from "@/components/projects/project-header";
import { ProjectTabs } from "@/components/projects/project-tabs";

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

  return (
    <div className="px-8 py-7 max-w-6xl mx-auto space-y-6">
      <ProjectHeader project={project} health={project.stats.health} />
      <ProjectTabs projectId={project.id} />
      {children}
    </div>
  );
}
