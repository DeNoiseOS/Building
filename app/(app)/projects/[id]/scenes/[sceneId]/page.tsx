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
import { ArrowLeft } from "lucide-react";

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
  const [canManage, canApprove] = await Promise.all([
    canManageScene(callerCtx),
    canApproveSceneDepartment(callerCtx),
  ]);

  type SceneDeptRecord = {
    departmentId: string;
    enabled: boolean;
    status: string;
    approvalStatus: string;
    requirements: string | null;
    notes: string | null;
    approvedBy: { id: string; name: string } | null;
    approvedAt: Date | null;
  };
  type DeptRef = { id: string; name: string; kind: string };

  const byDeptId = new Map<string, SceneDeptRecord>();
  for (const sd of scene.departments as SceneDeptRecord[]) {
    byDeptId.set(sd.departmentId, sd);
  }

  // For each project dept, fold into a row. If no SceneDepartment row
  // exists yet, render a disabled placeholder.
  const rows: Array<{ row: SceneDeptRow; canEdit: boolean; deptKind: string }> = [];
  for (const d of allDepts as DeptRef[]) {
    const sd = byDeptId.get(d.id);
    const row: SceneDeptRow = {
      departmentId: d.id,
      departmentName: d.name,
      enabled: sd?.enabled ?? false,
      status: sd?.status ?? "not_started",
      approvalStatus: sd?.approvalStatus ?? "pending_review",
      requirements: sd?.requirements ?? null,
      notes: sd?.notes ?? null,
      approvedBy: sd?.approvedBy ?? null,
      approvedAt: sd?.approvedAt?.toISOString() ?? null,
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

      <header className="space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
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
        {scene.description && (
          <p className="text-sm text-foreground/85 max-w-3xl">
            {scene.description}
          </p>
        )}
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
    </div>
  );
}
