import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getProjectsForUser } from "@/lib/server-data";
import { NewProjectButton } from "@/components/projects/new-project-button";
import { ProjectCard } from "@/components/projects/project-card";
import { FolderKanban, Sparkles } from "lucide-react";

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const projects = await getProjectsForUser(session.user.id);
  const active = projects.filter((p) => p.status === "active");
  const archived = projects.filter((p) => p.status === "archived");

  return (
    <div className="px-8 py-7 max-w-7xl mx-auto space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1.5">
            Every production you&apos;re working on.
          </p>
        </div>
        <NewProjectButton />
      </header>

      {projects.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {active.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
                  Active · {active.length}
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {active.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            </section>
          )}

          {archived.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
                Archived · {archived.length}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 opacity-60">
                {archived.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl bg-card/40 border border-dashed border-white/[0.08] py-20 px-6 flex flex-col items-center text-center gap-4">
      <div className="h-14 w-14 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center">
        <FolderKanban className="h-6 w-6 text-primary" />
      </div>
      <div className="space-y-1.5 max-w-md">
        <h3 className="text-xl font-semibold">No projects yet</h3>
        <p className="text-sm text-muted-foreground">
          Create your first production to start tracking progress, deadlines, and
          what&apos;s happening on set.
        </p>
      </div>
      <NewProjectButton />
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70 mt-2">
        <Sparkles className="h-3 w-3" />
        ProductionOS works from the moment you add a production
      </div>
    </div>
  );
}
