import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userHasProjectAccess } from "@/lib/access";
import { canManageScene } from "@/lib/permissions";
import {
  SceneListPanel,
  type SceneRow,
} from "@/components/scenes/scene-list-panel";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * V0.17 — Scenes list page. All project members can view; only
 * scene-author roles get the "New scene" button.
 */
export default async function ScenesPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const access = await userHasProjectAccess(session.user.id, id);
  if (!access) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sceneModel = (prisma as any).scene;
  const rows = sceneModel
    ? await sceneModel
        .findMany({
          where: { projectId: id },
          orderBy: { number: "asc" },
          select: {
            id: true,
            number: true,
            title: true,
            location: true,
            type: true,
            timeOfDay: true,
            status: true,
          },
        })
        .catch(() => [])
    : [];

  const canManage = await canManageScene({
    userId: session.user.id,
    projectId: id,
  });

  return (
    <div className="pt-2">
      <SceneListPanel
        projectId={id}
        scenes={rows as SceneRow[]}
        canManage={canManage}
      />
    </div>
  );
}
