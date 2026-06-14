import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getWorkspaceForProject } from "@/lib/workspace-data";
import { ROLE_LABELS } from "@/lib/roles";
import { SectionBlock } from "@/components/workspace/section-block";
import { EmptyWorkspace } from "@/components/workspace/empty-workspace";
import { LayoutPanelTop } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkspacePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const data = await getWorkspaceForProject(session.user.id, id);
  if (!data) notFound();

  const currentUser = {
    id: session.user.id,
    name: session.user.name ?? "Me",
  };

  const roleLabel = ROLE_LABELS[data.memberRole] ?? data.memberRole;

  return (
    <div className="space-y-6 pt-2">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
          <LayoutPanelTop className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Workspace</h2>
          <p className="text-sm text-muted-foreground">
            You&apos;re working as{" "}
            <span className="text-foreground font-medium">{roleLabel}</span> on
            this production.
          </p>
        </div>
      </div>

      {!data.hasComposition ? (
        <EmptyWorkspace role={data.memberRole} />
      ) : (
        <div className="space-y-5">
          {data.sections.map((section) => (
            <SectionBlock
              key={section.def.key}
              projectId={data.project.id}
              def={section.def}
              payload={section.data}
              currentUser={currentUser}
            />
          ))}
        </div>
      )}
    </div>
  );
}
