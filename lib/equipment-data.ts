import "server-only";
import { prisma } from "@/lib/prisma";
import { isProjectWideRole, isHead } from "@/lib/hierarchy";

/**
 * V0.10 — Equipment / Asset Custody helpers.
 *
 * Equipment statuses:
 *   available, checked_out, returned, damaged, lost
 *
 * Authority:
 *   - Producer / Owner: full control, every department
 *   - Department head (matching kind OR DepartmentMember.lead): manage
 *     equipment in their department
 *   - Members: view assigned equipment, submit damage reports
 */

export const EQUIPMENT_STATUS = [
  { value: "available", label: "Available" },
  { value: "checked_out", label: "Checked out" },
  { value: "returned", label: "Returned" },
  { value: "damaged", label: "Damaged" },
  { value: "lost", label: "Lost" },
] as const;

export type EquipmentStatus = (typeof EQUIPMENT_STATUS)[number]["value"];

export const EQUIPMENT_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  EQUIPMENT_STATUS.map((s) => [s.value, s.label])
);

export const DAMAGE_SEVERITY = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

export type DamageSeverity = (typeof DAMAGE_SEVERITY)[number]["value"];

export interface EquipmentCallerContext {
  userId: string;
  memberRole: string | null;
  isOwner: boolean;
  myDepartmentIds: string[];
}

export async function resolveEquipmentContext(
  userId: string,
  projectId: string
): Promise<EquipmentCallerContext> {
  const [mem, ownerRow, deptRows] = await Promise.all([
    prisma.projectMember.findFirst({
      where: { projectId, userId },
      select: { role: true },
    }),
    prisma.project.findFirst({
      where: { id: projectId, userId },
      select: { id: true },
    }),
    prisma.departmentMember.findMany({
      where: { userId, department: { projectId } },
      select: { departmentId: true },
    }),
  ]);
  return {
    userId,
    memberRole: mem?.role ?? null,
    isOwner: !!ownerRow,
    myDepartmentIds: deptRows.map((d) => d.departmentId),
  };
}

/**
 * Who can manage (create / edit / delete / assign / return) equipment
 * in a particular department:
 *   - Owner / Producer: always
 *   - Department head of the dept's kind, or DepartmentMember(lead)
 */
export function canManageEquipment(
  ctx: EquipmentCallerContext,
  dept: { id: string; kind: string }
): boolean {
  if (ctx.isOwner) return true;
  if (!ctx.memberRole) return false;
  if (ctx.memberRole === "producer") return true;
  if (isHead(ctx.memberRole) && ctx.memberRole === dept.kind) return true;
  return ctx.myDepartmentIds.includes(dept.id);
}

/** Project-wide management: any department (producer / director / owner). */
export function canManageAnyEquipment(ctx: EquipmentCallerContext): boolean {
  if (ctx.isOwner) return true;
  if (!ctx.memberRole) return false;
  return isProjectWideRole(ctx.memberRole);
}

/** Anyone with project access can submit a damage report. */
export function canFileDamageReport(ctx: EquipmentCallerContext): boolean {
  return ctx.isOwner || !!ctx.memberRole;
}

/** Only equipment managers can resolve damage reports. */
export const canResolveDamageReport = canManageEquipment;

/** Per-project counts for the dashboard widget. */
export async function getProjectEquipmentTotals(projectId: string) {
  const rows = await prisma.equipment.findMany({
    where: { projectId },
    select: { status: true },
  });
  let total = 0;
  let available = 0;
  let checkedOut = 0;
  let damaged = 0;
  let lost = 0;
  for (const r of rows) {
    total += 1;
    if (r.status === "available") available += 1;
    else if (r.status === "checked_out") checkedOut += 1;
    else if (r.status === "damaged") damaged += 1;
    else if (r.status === "lost") lost += 1;
  }
  return { total, available, checkedOut, damaged, lost };
}
