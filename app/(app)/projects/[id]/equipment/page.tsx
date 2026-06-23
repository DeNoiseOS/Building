import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userHasProjectAccess } from "@/lib/access";
import {
  resolveEquipmentContext,
  canManageAnyEquipment,
  getProjectEquipmentTotals,
} from "@/lib/equipment-data";
import { EquipmentListPanel } from "@/components/equipment/equipment-list-panel";
import {
  resourceLabelForKind,
  resourceTypeForKind,
  RESOURCE_TYPE_LABELS,
} from "@/lib/department-registry";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; department?: string }>;
}

export default async function EquipmentPage({
  params,
  searchParams,
}: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const sp = await searchParams;
  const access = await userHasProjectAccess(session.user.id, id);
  if (!access) notFound();

  const ectx = await resolveEquipmentContext(session.user.id, id);

  const where: Record<string, unknown> = { projectId: id };
  if (sp.status) where.status = sp.status;
  if (sp.department) where.departmentId = sp.department;

  const [departments, equipment, totals] = await Promise.all([
    prisma.department.findMany({
      where: { projectId: id },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, kind: true },
    }),
    prisma.equipment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        department: { select: { id: true, name: true, kind: true } },
        assignments: {
          where: { returnedAt: null },
          include: { assignedTo: { select: { id: true, name: true } } },
        },
        _count: {
          select: {
            damageReports: true,
          },
        },
      },
    }),
    getProjectEquipmentTotals(id),
  ]);

  // V0.21.1 — map each Equipment back to its source Purchase (if any) so
  // the Resources list can show whether the asset came from a purchase
  // or a rental. Purchase.equipmentId is @unique so one row max per asset.
  const equipmentIds = equipment.map((e) => e.id);
  const sourcePurchases = await prisma.purchase.findMany({
    where: { projectId: id, equipmentId: { in: equipmentIds } },
    select: { equipmentId: true, type: true },
  });
  const purchaseTypeByEq = new Map<string, string>();
  for (const p of sourcePurchases) {
    if (p.equipmentId) purchaseTypeByEq.set(p.equipmentId, p.type);
  }

  // V0.10.1 — dynamic resource label per the registry.
  // When a single department is selected via filter, use its label;
  // otherwise pick the most common type across the project.
  const labelDeptKind = sp.department
    ? departments.find((d) => d.id === sp.department)?.kind ?? null
    : null;
  const resourceLabel = labelDeptKind
    ? resourceLabelForKind(labelDeptKind)
    : (() => {
        // Aggregate by resource type and pick the most common for the heading.
        const counts: Record<string, number> = {};
        departments.forEach((d) => {
          const t = resourceTypeForKind(d.kind);
          counts[t] = (counts[t] ?? 0) + 1;
        });
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        return top ? RESOURCE_TYPE_LABELS[top[0] as keyof typeof RESOURCE_TYPE_LABELS] : "Resources";
      })();

  return (
    <EquipmentListPanel
      projectId={id}
      totals={totals}
      resourceLabel={resourceLabel}
      canManageAny={canManageAnyEquipment(ectx)}
      manageableDepartmentIds={departments
        .filter((d) =>
          // Show "create" affordance only for depts the caller can manage.
          ectx.isOwner ||
          ectx.memberRole === "producer" ||
          (ectx.memberRole === d.kind) ||
          ectx.myDepartmentIds.includes(d.id)
        )
        .map((d) => d.id)}
      departments={departments}
      equipment={equipment.map((e) => ({
        id: e.id,
        name: e.name,
        serialNumber: e.serialNumber,
        category: e.category,
        status: e.status,
        department: e.department,
        currentHolder: e.assignments[0]?.assignedTo ?? null,
        openDamageCount: e._count.damageReports,
        // V0.21.1
        acquisitionType: purchaseTypeByEq.get(e.id) ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        quantity: (e as any).quantity ?? 1,
        used: e.assignments.length,
      }))}
      filter={{
        status: sp.status ?? "",
        department: sp.department ?? "",
      }}
    />
  );
}
