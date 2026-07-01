import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userHasProjectAccess } from "@/lib/access";
import {
  resolveEquipmentContext,
  canManageEquipment,
  canFileDamageReport,
} from "@/lib/equipment-data";
import { ArrowLeft, Package } from "lucide-react";
import { EquipmentDetailPanel } from "@/components/equipment/equipment-detail-panel";
import { AssetHistory } from "@/components/equipment/asset-history";
import { getScenesUsingEquipment } from "@/lib/scene-assets";
import { AttachmentList } from "@/components/shared/attachment-list";
import { FileUploader } from "@/components/shared/file-uploader";
import { Badge } from "@/components/ui/badge";

interface PageProps {
  params: Promise<{ id: string; eqId: string }>;
}

export default async function EquipmentDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id, eqId } = await params;
  const access = await userHasProjectAccess(session.user.id, id);
  if (!access) notFound();

  const eq = await prisma.equipment.findFirst({
    where: { id: eqId, projectId: id },
    include: {
      department: { select: { id: true, name: true, kind: true } },
      assignments: {
        orderBy: { assignedAt: "desc" },
        include: {
          assignedTo: { select: { id: true, name: true } },
          assignedBy: { select: { id: true, name: true } },
        },
      },
      damageReports: {
        orderBy: { createdAt: "desc" },
        include: { reportedBy: { select: { id: true, name: true } } },
      },
    },
  });
  if (!eq) notFound();

  const ectx = await resolveEquipmentContext(session.user.id, id);
  const canManage = canManageEquipment(ectx, eq.department);
  const canFile = canFileDamageReport(ectx);

  const projectMembers = await prisma.projectMember.findMany({
    where: { projectId: id },
    include: { user: { select: { id: true, name: true } } },
  });

  const openAssignment = eq.assignments.find((a) => !a.returnedAt) ?? null;

  // V0.18 — scenes that need this asset.
  const sceneLinks = await getScenesUsingEquipment(eq.id);
  const totalDemand = sceneLinks.reduce((s, l) => s + l.quantityNeeded, 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inventoryQuantity = (eq as any).quantity ?? 1;
  const shortage = Math.max(0, totalDemand - inventoryQuantity);

  return (
    <div className="space-y-6 pt-2">
      <Link
        href={`/projects/${id}/equipment`}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Equipment
      </Link>

      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
          <Package className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{eq.name}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {eq.department.name}
            {eq.serialNumber ? ` · SN ${eq.serialNumber}` : ""}
            {eq.category ? ` · ${eq.category}` : ""}
          </p>
        </div>
      </div>

      <EquipmentDetailPanel
        projectId={id}
        equipmentId={eq.id}
        name={eq.name}
        status={eq.status}
        notes={eq.notes}
        canManage={canManage}
        canFileDamage={canFile}
        currentUserId={session.user.id}
        openAssignment={
          openAssignment
            ? {
                id: openAssignment.id,
                assignedTo: openAssignment.assignedTo,
                assignedBy: openAssignment.assignedBy,
                assignedAt: openAssignment.assignedAt.toISOString(),
                returnedAt: null,
                notes: openAssignment.notes,
              }
            : null
        }
        assignments={eq.assignments.map((a) => ({
          id: a.id,
          assignedTo: a.assignedTo,
          assignedBy: a.assignedBy,
          assignedAt: a.assignedAt.toISOString(),
          returnedAt: a.returnedAt?.toISOString() ?? null,
        }))}
        damageReports={eq.damageReports.map((d) => ({
          id: d.id,
          reportedBy: d.reportedBy,
          description: d.description,
          severity: d.severity,
          status: d.status,
          createdAt: d.createdAt.toISOString(),
          resolvedAt: d.resolvedAt?.toISOString() ?? null,
          resolution: d.resolution,
        }))}
        members={projectMembers.map((m) => ({
          id: m.user.id,
          name: m.user.name,
        }))}
      />

      {/* V0.23 — Photos + files for this asset */}
      <section className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
        <div className="px-5 py-4 border-b border-white/[0.04]">
          <h2 className="text-base font-semibold">Photos & files</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Reference photos, receipts, warranty docs.
          </p>
        </div>
        <div className="p-5 space-y-3">
          <AttachmentList
            projectId={id}
            ownerType="equipment"
            ownerId={eq.id}
            canDelete={canManage}
          />
          {canManage && (
            <FileUploader
              projectId={id}
              ownerType="equipment"
              ownerId={eq.id}
              hideUrlPaste
              label="Drop a photo, warranty PDF, or spec sheet."
            />
          )}
        </div>
      </section>

      {/* V0.18 — Scenes that need this asset */}
      <section className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
        <div className="px-5 py-4 border-b border-white/[0.04] flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">Used in scenes</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Inventory {inventoryQuantity} · Total demand {totalDemand}
              {shortage > 0 && (
                <>
                  {" "}
                  · <span className="text-amber-300">Short by {shortage}</span>
                </>
              )}
            </p>
          </div>
          {shortage > 0 && (
            <Badge
              variant="outline"
              className="text-[10px] bg-amber-500/10 border-amber-500/30 text-amber-300"
            >
              Overbooked
            </Badge>
          )}
        </div>
        <div className="p-5">
          {sceneLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">
              Not linked to any scene yet.
            </p>
          ) : (
            <div className="space-y-1.5">
              {sceneLinks.map((l) => (
                <Link
                  key={l.sceneAssetId}
                  href={`/projects/${id}/scenes/${l.scene.id}`}
                  className="flex items-center gap-3 rounded-md border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] px-3 py-2"
                >
                  <span className="text-sm font-medium tabular-nums w-12">
                    #{l.scene.number}
                  </span>
                  <span className="text-sm flex-1 min-w-0 truncate">
                    {l.scene.title}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {l.scene.status}
                  </Badge>
                  <span className="text-sm tabular-nums">
                    × {l.quantityNeeded}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* V0.16 — Asset history timeline */}
      <section className="rounded-2xl bg-card/60 border border-white/[0.05] shadow-soft">
        <div className="px-5 py-4 border-b border-white/[0.04]">
          <h2 className="text-base font-semibold">History</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Every event on this asset.
          </p>
        </div>
        <div className="p-5">
          <AssetHistory projectId={id} equipmentId={eq.id} />
        </div>
      </section>
    </div>
  );
}
