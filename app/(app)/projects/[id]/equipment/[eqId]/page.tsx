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
    </div>
  );
}
