import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userHasProjectAccess } from "@/lib/access";
import {
  canManageScene,
  canApproveSceneDepartment,
  canEditSceneDepartment,
} from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { SceneStatusBadge } from "@/components/scenes/scene-status-badge";
import {
  SceneDepartmentCard,
  type SceneDeptRow,
} from "@/components/scenes/scene-department-card";
import { SceneActions } from "@/components/scenes/scene-actions";
import { getSceneAssetsForDepartment } from "@/lib/scene-assets";
import { AttachmentList } from "@/components/shared/attachment-list";
import { FileUploader } from "@/components/shared/file-uploader";
import { SceneCommentsPanel } from "@/components/scenes/scene-comments-panel";
import { SceneCastPanel } from "@/components/scenes/scene-cast-panel";
import { canManageCast } from "@/lib/permissions";
import { ArrowLeft, ExternalLink } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string; sceneId: string }>;
}

/**
 * V0.17 — Scene detail page.
 *
 * Composes one SceneDepartmentCard per department in the project.
 * The card itself is responsible for showing enabled/disabled state.
 */
export default async function SceneDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id, sceneId } = await params;
  const access = await userHasProjectAccess(session.user.id, id);
  if (!access) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sceneModel = (prisma as any).scene;
  if (!sceneModel) notFound();

  const scene = await sceneModel.findFirst({
    where: { id: sceneId, projectId: id },
    include: {
      departments: {
        include: {
          department: { select: { id: true, name: true, kind: true } },
          approvedBy: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!scene) notFound();

  const allDepts = await prisma.department.findMany({
    where: { projectId: id },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, kind: true },
  });

  const callerCtx = { userId: session.user.id, projectId: id };
  const [canManage, canApprove, canCast] = await Promise.all([
    canManageScene(callerCtx),
    canApproveSceneDepartment(callerCtx),
    canManageCast(callerCtx),
  ]);

  type SceneDeptRecord = {
    departmentId: string;
    enabled: boolean;
    status: string;
    approvalStatus: string;
    requirements: string | null;
    notes: string | null;
    attachments: unknown;
    approvedBy: { id: string; name: string } | null;
    approvedAt: Date | null;
  };
  type DeptRef = { id: string; name: string; kind: string };

  const byDeptId = new Map<string, SceneDeptRecord>();
  for (const sd of scene.departments as SceneDeptRecord[]) {
    byDeptId.set(sd.departmentId, sd);
  }

  // V0.18 — pull the dept-scoped equipment catalog once.
  const catalogByDept = new Map<
    string,
    Array<{ id: string; name: string; category: string | null; quantity: number }>
  >();
  const allEquipment = await prisma.equipment.findMany({
    where: { projectId: id, status: { not: "retired" } },
    select: {
      id: true,
      name: true,
      category: true,
      departmentId: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      quantity: true as any,
    },
    orderBy: { name: "asc" },
  });
  for (const eq of allEquipment as Array<{
    id: string;
    name: string;
    category: string | null;
    departmentId: string;
    quantity: number;
  }>) {
    const arr = catalogByDept.get(eq.departmentId) ?? [];
    arr.push({
      id: eq.id,
      name: eq.name,
      category: eq.category,
      quantity: eq.quantity ?? 1,
    });
    catalogByDept.set(eq.departmentId, arr);
  }

  // For each project dept, fold into a row. If no SceneDepartment row
  // exists yet, render a disabled placeholder.
  const rows: Array<{ row: SceneDeptRow; canEdit: boolean; deptKind: string }> = [];
  for (const d of allDepts as DeptRef[]) {
    const sd = byDeptId.get(d.id);
    const enabled = sd?.enabled ?? false;
    // Only load assets for enabled depts (the card hides them otherwise).
    const assets = enabled
      ? await getSceneAssetsForDepartment({
          sceneId,
          departmentId: d.id,
        })
      : [];
    const row: SceneDeptRow = {
      departmentId: d.id,
      departmentName: d.name,
      departmentKind: d.kind,
      enabled,
      status: sd?.status ?? "not_started",
      approvalStatus: sd?.approvalStatus ?? "pending_review",
      requirements: sd?.requirements ?? null,
      notes: sd?.notes ?? null,
      attachments: Array.isArray(sd?.attachments)
        ? (sd.attachments as Array<{ title: string; url: string }>)
        : [],
      approvedBy: sd?.approvedBy ?? null,
      approvedAt: sd?.approvedAt?.toISOString() ?? null,
      assets,
      catalog: catalogByDept.get(d.id) ?? [],
    };
    const canEdit = await canEditSceneDepartment(callerCtx, d.kind);
    rows.push({ row, canEdit, deptKind: d.kind });
  }

  return (
    <div className="pt-2 space-y-6">
      <div>
        <Link
          href={`/projects/${id}/scenes`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Scenes
        </Link>
      </div>

      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap min-w-0 flex-1">
            <span className="text-2xl font-semibold tabular-nums">
              #{scene.number}
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">
              {scene.title}
            </h1>
            <SceneStatusBadge status={scene.status} />
            <Badge variant="outline" className="text-[10px] bg-white/[0.04]">
              {String(scene.type).replace("_", "/")}
            </Badge>
            <Badge
              variant="outline"
              className="text-[10px] bg-white/[0.04] capitalize"
            >
              {scene.timeOfDay}
            </Badge>
            {scene.location && (
              <span className="text-sm text-muted-foreground">
                · {scene.location}
              </span>
            )}
          </div>
          {canManage && (
            <SceneActions
              projectId={id}
              scene={{
                id: scene.id,
                number: scene.number,
                title: scene.title,
                description: scene.description ?? null,
                location: scene.location ?? null,
                type: scene.type,
                timeOfDay: scene.timeOfDay,
                status: scene.status,
                notes: scene.notes ?? null,
                attachments: Array.isArray(scene.attachments)
                  ? (scene.attachments as Array<{ title: string; url: string }>)
                  : [],
                // V0.19
                coverImageUrl:
                  (scene as { coverImageUrl?: string | null }).coverImageUrl ??
                  null,
              }}
            />
          )}
        </div>
        {scene.description && (
          <p className="text-sm text-foreground/85 max-w-3xl">
            {scene.description}
          </p>
        )}
        {scene.notes && (
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
              Production notes
            </div>
            <p className="text-sm whitespace-pre-wrap">{scene.notes}</p>
          </div>
        )}
        {Array.isArray(scene.attachments) && scene.attachments.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Links
            </div>
            <div className="flex flex-wrap gap-2">
              {(scene.attachments as Array<{ title: string; url: string }>).map(
                (a, i) => (
                  <a
                    key={i}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] px-3 py-1.5 text-xs"
                  >
                    <ExternalLink className="h-3 w-3 text-primary" />
                    {a.title}
                  </a>
                )
              )}
            </div>
          </div>
        )}
        {/* V0.23 — Attachments: real file uploads (image / PDF / doc / …) */}
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Files
          </div>
          <AttachmentList
            projectId={id}
            ownerType="scene"
            ownerId={scene.id}
            canDelete={canManage}
          />
          {canManage && (
            <FileUploader
              projectId={id}
              ownerType="scene"
              ownerId={scene.id}
              hideUrlPaste
              label="Drop scripts, mood boards, references — or click to browse."
            />
          )}
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Departments</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {rows.map((r) => (
            <SceneDepartmentCard
              key={r.row.departmentId}
              projectId={id}
              sceneId={sceneId}
              row={r.row}
              canToggle={canManage}
              canEdit={r.canEdit}
              canApprove={canApprove}
            />
          ))}
        </div>
      </section>

      {/* V0.25 — Cast linked to this scene */}
      <SceneCastPanel
        projectId={id}
        sceneId={sceneId}
        canManage={canCast}
      />

      {/* V0.24 — Feedback panel (production + agency both post here) */}
      <SceneCommentsPanel
        projectId={id}
        sceneId={sceneId}
        currentUserId={session.user.id}
      />
    </div>
  );
}
