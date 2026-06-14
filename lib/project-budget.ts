import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * V0.6.1 — Project-level budget pool + department allocation reads.
 *
 * Concepts:
 *   Project.totalBudget          producer-set ceiling for the production
 *   Project.currency             ISO-4217 code (display only; math is in
 *                                minor units / "cents")
 *   DepartmentBudget              one row per (project, department)
 *      allocatedAmount            what producer assigned
 *      requestedAmount            optional revision counter from head
 *      approvedAmount             final agreed amount once status=approved
 *      status                     pending | revision_requested |
 *                                 approved | rejected
 *
 * Spent is *not* a stored field; it's aggregated on demand from the
 * existing BudgetRequest (V0.6 — now conceptually "Purchase Requests")
 * rows in status=purchased.
 */

export const ALLOCATION_STATUS = [
  { value: "pending", label: "Pending" },
  { value: "revision_requested", label: "Revision requested" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
] as const;

export type AllocationStatus = (typeof ALLOCATION_STATUS)[number]["value"];

export interface ProjectBudgetSummary {
  totalBudget: number | null;
  currency: string;
  allocated: number; // sum of allocatedAmount across all departments
  approved: number; // sum of approvedAmount where status=approved
  spent: number; // sum of purchased PurchaseRequest amounts
  remaining: number | null; // totalBudget - approved (or null if budget unset)
}

export interface DepartmentBudgetRow {
  id: string;
  departmentId: string;
  departmentName: string;
  departmentKind: string;
  allocatedAmount: number;
  requestedAmount: number | null;
  approvedAmount: number | null;
  status: AllocationStatus;
  reason: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  /** Sum of purchased PurchaseRequest amounts in this department. */
  spent: number;
  /** Approved - spent. Null if not yet approved. */
  remaining: number | null;
  /** Utilization percent (spent / approved * 100). Null if not approved. */
  utilization: number | null;
  createdAt: string;
  updatedAt: string;
}

export async function getProjectBudget(
  projectId: string
): Promise<{
  summary: ProjectBudgetSummary;
  departments: DepartmentBudgetRow[];
}> {
  const [project, departments, allocations, purchaseRows] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { totalBudget: true, currency: true },
    }),
    prisma.department.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, kind: true },
    }),
    prisma.departmentBudget.findMany({
      where: { projectId },
    }),
    prisma.budgetRequest.findMany({
      where: { projectId, status: "purchased" },
      select: { departmentId: true, estimatedCost: true },
    }),
  ]);

  const allocByDept = new Map<string, (typeof allocations)[number]>();
  allocations.forEach((a) => allocByDept.set(a.departmentId, a));

  const spentByDept = new Map<string, number>();
  for (const p of purchaseRows) {
    spentByDept.set(
      p.departmentId,
      (spentByDept.get(p.departmentId) ?? 0) + p.estimatedCost
    );
  }

  const rows: DepartmentBudgetRow[] = departments.map((d) => {
    const a = allocByDept.get(d.id);
    const spent = spentByDept.get(d.id) ?? 0;
    const approved = a?.approvedAmount ?? null;
    const remaining = approved !== null ? approved - spent : null;
    const utilization =
      approved && approved > 0 ? Math.round((spent / approved) * 100) : null;
    return {
      id: a?.id ?? `unsaved_${d.id}`,
      departmentId: d.id,
      departmentName: d.name,
      departmentKind: d.kind,
      allocatedAmount: a?.allocatedAmount ?? 0,
      requestedAmount: a?.requestedAmount ?? null,
      approvedAmount: approved,
      status: (a?.status as AllocationStatus) ?? "pending",
      reason: a?.reason ?? null,
      approvedAt: a?.approvedAt?.toISOString() ?? null,
      rejectedAt: a?.rejectedAt?.toISOString() ?? null,
      spent,
      remaining,
      utilization,
      createdAt: a?.createdAt.toISOString() ?? new Date(0).toISOString(),
      updatedAt: a?.updatedAt.toISOString() ?? new Date(0).toISOString(),
    };
  });

  const totalAllocated = rows.reduce((s, r) => s + r.allocatedAmount, 0);
  const totalApproved = rows.reduce(
    (s, r) => s + (r.approvedAmount ?? 0),
    0
  );
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
  const totalBudget = project?.totalBudget ?? null;
  const remaining =
    totalBudget !== null ? totalBudget - totalApproved : null;

  return {
    summary: {
      totalBudget,
      currency: project?.currency ?? "USD",
      allocated: totalAllocated,
      approved: totalApproved,
      spent: totalSpent,
      remaining,
    },
    departments: rows,
  };
}

/**
 * Server-side validation: returns the would-be sum of allocations if the
 * caller wrote a new `allocatedAmount` for `departmentId`. Used by the
 * producer's "set total budget" / "set allocation" actions to enforce:
 *   sum(allocatedAmount) ≤ Project.totalBudget
 *
 * If `totalBudget` is null, no ceiling is enforced (the producer hasn't
 * set one yet).
 */
export async function projectedAllocationTotal(
  projectId: string,
  departmentId: string,
  newAllocatedAmount: number
): Promise<number> {
  const existing = await prisma.departmentBudget.findMany({
    where: { projectId, NOT: { departmentId } },
    select: { allocatedAmount: true },
  });
  const others = existing.reduce((s, r) => s + r.allocatedAmount, 0);
  return others + Math.max(0, newAllocatedAmount);
}

/**
 * Notification approver list for a project: owner + producers.
 * Used when the dept head accepts / rejects / requests revision.
 */
export async function projectApproverUserIds(
  projectId: string
): Promise<string[]> {
  const ids = new Set<string>();
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });
  if (project) ids.add(project.userId);
  const producers = await prisma.projectMember.findMany({
    where: { projectId, role: "producer" },
    select: { userId: true },
  });
  producers.forEach((p) => ids.add(p.userId));
  return Array.from(ids);
}

/**
 * V0.6.2 — Department-only dashboard payload.
 *
 * Returns the caller's department rows ONLY. No project-wide totals,
 * no other departments' allocations, no other departments' purchase
 * requests. Used by the budget surface for any role that is not
 * Owner / Producer / Director.
 *
 * "My departments" = departments the user is a `lead` of, OR a member
 * of, OR whose `kind` matches the user's ProjectMember.role.
 */
export interface DepartmentBudgetDashboardRow {
  department: { id: string; name: string; kind: string };
  allocated: number;
  approved: number | null;
  spent: number;
  remaining: number | null;
  utilization: number | null;
  status: AllocationStatus;
  reason: string | null;
  requestedAmount: number | null;
  allocationId: string;
}

export interface DepartmentBudgetDashboard {
  currency: string;
  departments: DepartmentBudgetDashboardRow[];
}

export async function getDepartmentBudgetDashboard(
  userId: string,
  projectId: string
): Promise<DepartmentBudgetDashboard> {
  const [project, deptMemberships, projectMember] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { currency: true },
    }),
    prisma.departmentMember.findMany({
      where: { userId, department: { projectId } },
      select: { departmentId: true },
    }),
    prisma.projectMember.findFirst({
      where: { projectId, userId },
      select: { role: true },
    }),
  ]);

  // Resolve "my departments" set.
  const myDeptIds = new Set(deptMemberships.map((d) => d.departmentId));
  if (projectMember?.role) {
    const byKind = await prisma.department.findMany({
      where: { projectId, kind: projectMember.role },
      select: { id: true },
    });
    byKind.forEach((d) => myDeptIds.add(d.id));
  }

  if (myDeptIds.size === 0) {
    return { currency: project?.currency ?? "USD", departments: [] };
  }

  const ids = Array.from(myDeptIds);
  const [departments, allocations, purchaseRows] = await Promise.all([
    prisma.department.findMany({
      where: { id: { in: ids }, projectId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, kind: true },
    }),
    prisma.departmentBudget.findMany({
      where: { departmentId: { in: ids }, projectId },
    }),
    prisma.budgetRequest.findMany({
      where: { projectId, status: "purchased", departmentId: { in: ids } },
      select: { departmentId: true, estimatedCost: true },
    }),
  ]);

  const allocByDept = new Map<string, (typeof allocations)[number]>();
  allocations.forEach((a) => allocByDept.set(a.departmentId, a));
  const spentByDept = new Map<string, number>();
  purchaseRows.forEach((p) =>
    spentByDept.set(
      p.departmentId,
      (spentByDept.get(p.departmentId) ?? 0) + p.estimatedCost
    )
  );

  const rows: DepartmentBudgetDashboardRow[] = departments.map((d) => {
    const a = allocByDept.get(d.id);
    const spent = spentByDept.get(d.id) ?? 0;
    const approved = a?.approvedAmount ?? null;
    const remaining = approved !== null ? approved - spent : null;
    const utilization =
      approved && approved > 0 ? Math.round((spent / approved) * 100) : null;
    return {
      department: d,
      allocated: a?.allocatedAmount ?? 0,
      approved,
      spent,
      remaining,
      utilization,
      status: (a?.status as AllocationStatus) ?? "pending",
      reason: a?.reason ?? null,
      requestedAmount: a?.requestedAmount ?? null,
      allocationId: a?.id ?? `unsaved_${d.id}`,
    };
  });

  return {
    currency: project?.currency ?? "USD",
    departments: rows,
  };
}

/**
 * V0.6.2 — Resolve the caller's "my departments" set (used by both the
 * department dashboard reader and the purchase-request filter).
 */
export async function getCallerDepartmentIds(
  userId: string,
  projectId: string
): Promise<string[]> {
  const [deptMemberships, projectMember] = await Promise.all([
    prisma.departmentMember.findMany({
      where: { userId, department: { projectId } },
      select: { departmentId: true },
    }),
    prisma.projectMember.findFirst({
      where: { projectId, userId },
      select: { role: true },
    }),
  ]);
  const set = new Set<string>(deptMemberships.map((d) => d.departmentId));
  if (projectMember?.role) {
    const byKind = await prisma.department.findMany({
      where: { projectId, kind: projectMember.role },
      select: { id: true },
    });
    byKind.forEach((d) => set.add(d.id));
  }
  return Array.from(set);
}

/** Department head user IDs for notifications going the other direction. */
export async function departmentHeadUserIds(
  projectId: string,
  departmentId: string
): Promise<string[]> {
  const dept = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { kind: true },
  });
  if (!dept) return [];
  const ids = new Set<string>();
  // Department members listed as "lead".
  const leads = await prisma.departmentMember.findMany({
    where: { departmentId, role: "lead" },
    select: { userId: true },
  });
  leads.forEach((l) => ids.add(l.userId));
  // Project members whose role matches the department's kind (V0.5).
  const heads = await prisma.projectMember.findMany({
    where: { projectId, role: dept.kind },
    select: { userId: true },
  });
  heads.forEach((h) => ids.add(h.userId));
  return Array.from(ids);
}
