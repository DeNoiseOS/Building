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
 * V0.17 — Scenes list page (V0.19 adds coverImageUrl + dept counts).
 *
 * Dept counts (enabled + approved) drive the Progress column AND the
 * Gallery card readiness badge. We collect them in a single groupBy
 * to keep the page O(1) instead of N+1.
 */
export default async function ScenesPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const access = await userHasProjectAccess(session.user.id, id);
  if (!access) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sceneModel = (prisma as any).scene;
  const rawScenes = sceneModel
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
            // V0.19
            coverImageUrl: true,
          },
        })
        .catch(() => [])
    : [];

  // V0.19 — fan out dept counts in one query each (enabled + approved).
  const sceneIds = (
    rawScenes as Array<{ id: string }>
  ).map((s) => s.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sdModel = (prisma as any).sceneDepartment;
  const enabledCountMap = new Map<string, number>();
  const approvedCountMap = new Map<string, number>();
  if (sdModel && sceneIds.length > 0) {
    try {
      const enabledRows = await sdModel.groupBy({
        by: ["sceneId"],
        where: { sceneId: { in: sceneIds }, enabled: true },
        _count: { _all: true },
      });
      const approvedRows = await sdModel.groupBy({
        by: ["sceneId"],
        where: {
          sceneId: { in: sceneIds },
          enabled: true,
          approvalStatus: "approved",
        },
        _count: { _all: true },
      });
      for (const r of enabledRows as Array<{
        sceneId: string;
        _count: { _all: number };
      }>) {
        enabledCountMap.set(r.sceneId, r._count._all);
      }
      for (const r of approvedRows as Array<{
        sceneId: string;
        _count: { _all: number };
      }>) {
        approvedCountMap.set(r.sceneId, r._count._all);
      }
    } catch {
      /* stale client — fall through to zeros */
    }
  }

  const rows: SceneRow[] = (
    rawScenes as Array<{
      id: string;
      number: string;
      title: string;
      location: string | null;
      type: string;
      timeOfDay: string;
      status: string;
      coverImageUrl: string | null;
    }>
  ).map((s) => ({
    id: s.id,
    number: s.number,
    title: s.title,
    location: s.location,
    type: s.type,
    timeOfDay: s.timeOfDay,
    status: s.status,
    coverImageUrl: s.coverImageUrl ?? null,
    enabledDepartments: enabledCountMap.get(s.id) ?? 0,
    approvedDepartments: approvedCountMap.get(s.id) ?? 0,
  }));

  const canManage = await canManageScene({
    userId: session.user.id,
    projectId: id,
  });

  return (
    <div className="pt-2">
      <SceneListPanel
        projectId={id}
        scenes={rows}
        canManage={canManage}
      />
    </div>
  );
}
