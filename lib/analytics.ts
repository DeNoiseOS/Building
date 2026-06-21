import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * V0.15 — Analytics & Reporting foundation.
 *
 * A small library of pure server-side aggregators. Each function takes
 * a projectId, runs the relevant Prisma queries, and returns a plain
 * JSON-serializable object. No UI knowledge. No permission checks
 * (those happen at the API layer / page layer).
 *
 * Why a separate module:
 *   - Reusable from server components, API routes, and future export
 *     services (PDF / Excel / CSV) without duplication.
 *   - Tight `Promise.all` parallelism so one analytics fetch hits the
 *     DB once per concern, not per widget.
 *   - Defensive: Purchase / CustodyRequest are accessed via the same
 *     `(prisma as any).model` guard used elsewhere so a stale Prisma
 *     client doesn't crash the page on first deploy after a migration.
 *
 * Performance considerations:
 *   - All counts/aggregates use Prisma `aggregate` / `count` (one
 *     SQL trip each). No N+1.
 *   - Single project scope per call — payload is bounded.
 *   - Existing indexes cover every WHERE clause used here
 *     (Project.id, *.projectId, *.status, *.departmentId).
 *   - For very large projects the financial overview pulls one extra
 *     query (groupBy departmentId). Still O(depts) rows ≈ 8.
 */

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export interface ProjectAnalyticsSummary {
  /** Project.totalBudget. NULL when not yet set. */
  totalBudget: number | null;
  /** Sum of DepartmentBudget.allocatedAmount across the project. */
  totalAllocated: number;
  /**
   * Sum of approved spend across the project:
   *   - DepartmentBudget approved+purchased BudgetRequests (legacy)
   *   - V0.13 Purchase rows (status=approved)
   * (Custody balances themselves are NOT counted here — only actual
   *  spend through them counts via the linked Purchase or expense.)
   */
  totalSpent: number;
  /** totalBudget − totalSpent (NULL when totalBudget is unset). */
  totalRemaining: number | null;
  /** Count of approved Purchase rows. */
  totalPurchases: number;
  /** Count of active custodies on the project. */
  activeCustodies: number;
  /** Count of project members (including the owner). */
  teamMembersCount: number;
  /** Count of Department rows on the project. */
  departmentsCount: number;
  /** Currency carried through for display. */
  currency: string;
}

export interface DepartmentAnalyticsRow {
  departmentId: string;
  name: string;
  kind: string;
  /** Approved allocation (falls back to allocatedAmount when unset). */
  allocated: number;
  /** Approved spend (purchases not tied to a custody + legacy purchased). */
  spent: number;
  /** allocated − spent (NULL when no allocation). */
  remaining: number | null;
  /** Count of approved Purchase rows in this department. */
  totalPurchases: number;
  /** Count of active custodies on this dept. */
  activeCustodies: number;
  /** Members directly assigned to this dept via DepartmentMember. */
  teamSize: number;
}

export interface FinancialOverview {
  /** spent ÷ totalBudget × 100 (null when budget unset). */
  budgetUtilization: number | null;
  /** spent ÷ totalAllocated × 100 (null when no allocation). */
  allocationUtilization: number | null;
  /** Total amount of custodies with status=active. */
  outstandingCustodies: number;
  /** Total amount of custodies with status=settled. */
  settledCustodies: number;
  /** Count of pending Purchase rows awaiting head approval. */
  pendingPurchases: number;
  /** Count of approved Purchase rows. */
  approvedPurchases: number;
}

export interface ResourceAnalyticsRow {
  departmentId: string;
  departmentName: string;
  total: number;
  assigned: number;
  available: number;
  damaged: number;
}

export interface ResourceAnalytics {
  total: number;
  assigned: number;
  available: number;
  damaged: number;
  byDepartment: ResourceAnalyticsRow[];
}

export interface TeamAnalyticsRow {
  departmentId: string;
  departmentName: string;
  memberCount: number;
}

export interface TeamAnalytics {
  totalMembers: number;
  /** One entry per Department row (zero counts included). */
  byDepartment: TeamAnalyticsRow[];
  /** Members not assigned to any DepartmentMember row. */
  unassignedCount: number;
}

export interface ProjectAnalytics {
  summary: ProjectAnalyticsSummary;
  departments: DepartmentAnalyticsRow[];
  /** Top 5 departments by spent amount, descending. */
  topSpendingDepartments: DepartmentAnalyticsRow[];
  financial: FinancialOverview;
  resources: ResourceAnalytics;
  team: TeamAnalytics;
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function purchaseModel(): any | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = (prisma as any).purchase;
  if (!m || typeof m.aggregate !== "function") return null;
  return m;
}

// ─────────────────────────────────────────────────────────────────────
// Aggregators
// ─────────────────────────────────────────────────────────────────────

/**
 * V0.15 — Full project analytics payload. Everything the dashboard
 * needs, in a single round of parallel queries.
 */
export async function getProjectAnalytics(
  projectId: string
): Promise<ProjectAnalytics> {
  // Fan-out — every aggregator is independent.
  const [summary, departments, financial, resources, team] = await Promise.all([
    getProjectAnalyticsSummary(projectId),
    getDepartmentAnalytics(projectId),
    getFinancialOverview(projectId),
    getResourceAnalytics(projectId),
    getTeamAnalytics(projectId),
  ]);
  const topSpendingDepartments = [...departments]
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 5);
  return {
    summary,
    departments,
    topSpendingDepartments,
    financial,
    resources,
    team,
  };
}

export async function getProjectAnalyticsSummary(
  projectId: string
): Promise<ProjectAnalyticsSummary> {
  const purchase = purchaseModel();

  const [
    project,
    allocationsSum,
    legacySpend,
    purchaseSpendAgg,
    purchaseCount,
    activeCustodyCount,
    memberCount,
    deptCount,
  ] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { totalBudget: true, currency: true },
    }),
    prisma.departmentBudget.aggregate({
      where: { projectId },
      _sum: { allocatedAmount: true },
    }),
    prisma.budgetRequest.aggregate({
      where: { projectId, status: "purchased" },
      _sum: { estimatedCost: true },
    }),
    purchase
      ? purchase
          .aggregate({
            where: { projectId, status: "approved" },
            _sum: { amount: true },
          })
          .catch(() => null)
      : Promise.resolve(null),
    purchase
      ? purchase
          .count({ where: { projectId, status: "approved" } })
          .catch(() => 0)
      : Promise.resolve(0),
    prisma.custody.count({ where: { projectId, status: "active" } }),
    prisma.projectMember.count({ where: { projectId } }),
    prisma.department.count({ where: { projectId } }),
  ]);

  const totalAllocated = allocationsSum._sum.allocatedAmount ?? 0;
  const legacy = legacySpend._sum.estimatedCost ?? 0;
  const purchaseSpend = purchaseSpendAgg?._sum?.amount ?? 0;
  const totalSpent = legacy + purchaseSpend;
  const totalBudget = project?.totalBudget ?? null;
  const totalRemaining = totalBudget !== null ? totalBudget - totalSpent : null;

  return {
    totalBudget,
    totalAllocated,
    totalSpent,
    totalRemaining,
    totalPurchases: (purchaseCount as number) ?? 0,
    activeCustodies: activeCustodyCount,
    teamMembersCount: memberCount,
    departmentsCount: deptCount,
    currency: project?.currency ?? "SAR",
  };
}

export async function getDepartmentAnalytics(
  projectId: string
): Promise<DepartmentAnalyticsRow[]> {
  const purchase = purchaseModel();
  const [departments, allocations, legacyByDept, purchaseByDept, custodyByDept, memberByDept] =
    await Promise.all([
      prisma.department.findMany({
        where: { projectId },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true, kind: true },
      }),
      prisma.departmentBudget.findMany({
        where: { projectId },
        select: {
          departmentId: true,
          allocatedAmount: true,
          approvedAmount: true,
        },
      }),
      prisma.budgetRequest.groupBy({
        by: ["departmentId"],
        where: { projectId, status: "purchased" },
        _sum: { estimatedCost: true },
      }),
      purchase
        ? purchase
            .groupBy({
              by: ["departmentId"],
              where: { projectId, status: "approved", custodyId: null },
              _sum: { amount: true },
              _count: { _all: true },
            })
            .catch(() => [])
        : Promise.resolve([]),
      prisma.custody.groupBy({
        by: ["departmentId"],
        where: { projectId, status: "active" },
        _count: { _all: true },
      }),
      prisma.departmentMember.groupBy({
        by: ["departmentId"],
        where: { department: { projectId } },
        _count: { _all: true },
      }),
    ]);

  // Index everything by deptId.
  const allocMap = new Map(
    allocations.map((a) => [
      a.departmentId,
      a.approvedAmount ?? a.allocatedAmount,
    ])
  );
  const legacyMap = new Map(
    legacyByDept.map((r) => [r.departmentId, r._sum.estimatedCost ?? 0])
  );
  type PurchaseGroup = {
    departmentId: string;
    _sum: { amount: number | null };
    _count: { _all: number };
  };
  const purchaseSpendMap = new Map<string, number>();
  const purchaseCountMap = new Map<string, number>();
  for (const r of purchaseByDept as PurchaseGroup[]) {
    purchaseSpendMap.set(r.departmentId, r._sum.amount ?? 0);
    purchaseCountMap.set(r.departmentId, r._count._all);
  }
  const custodyMap = new Map(
    custodyByDept.map((r) => [r.departmentId, r._count._all])
  );
  const memberMap = new Map(
    memberByDept.map((r) => [r.departmentId, r._count._all])
  );

  return departments.map((d) => {
    const allocated = allocMap.get(d.id) ?? 0;
    const spent =
      (legacyMap.get(d.id) ?? 0) + (purchaseSpendMap.get(d.id) ?? 0);
    return {
      departmentId: d.id,
      name: d.name,
      kind: d.kind,
      allocated,
      spent,
      remaining: allocated > 0 ? allocated - spent : null,
      totalPurchases: purchaseCountMap.get(d.id) ?? 0,
      activeCustodies: custodyMap.get(d.id) ?? 0,
      teamSize: memberMap.get(d.id) ?? 0,
    };
  });
}

export async function getFinancialOverview(
  projectId: string
): Promise<FinancialOverview> {
  const purchase = purchaseModel();
  const [
    project,
    allocationsSum,
    legacySpend,
    purchaseSpend,
    outstandingAgg,
    settledAgg,
    pendingCount,
    approvedCount,
  ] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { totalBudget: true },
    }),
    prisma.departmentBudget.aggregate({
      where: { projectId },
      _sum: { allocatedAmount: true },
    }),
    prisma.budgetRequest.aggregate({
      where: { projectId, status: "purchased" },
      _sum: { estimatedCost: true },
    }),
    purchase
      ? purchase
          .aggregate({
            where: { projectId, status: "approved" },
            _sum: { amount: true },
          })
          .catch(() => null)
      : Promise.resolve(null),
    prisma.custody.aggregate({
      where: { projectId, status: "active" },
      _sum: { amount: true },
    }),
    prisma.custody.aggregate({
      where: { projectId, status: "settled" },
      _sum: { amount: true },
    }),
    purchase
      ? purchase.count({ where: { projectId, status: "pending" } }).catch(() => 0)
      : Promise.resolve(0),
    purchase
      ? purchase
          .count({ where: { projectId, status: "approved" } })
          .catch(() => 0)
      : Promise.resolve(0),
  ]);

  const totalAllocated = allocationsSum._sum.allocatedAmount ?? 0;
  const totalSpent =
    (legacySpend._sum.estimatedCost ?? 0) +
    (purchaseSpend?._sum?.amount ?? 0);
  const totalBudget = project?.totalBudget ?? null;

  return {
    budgetUtilization:
      totalBudget && totalBudget > 0
        ? Math.round((totalSpent / totalBudget) * 100)
        : null,
    allocationUtilization:
      totalAllocated > 0
        ? Math.round((totalSpent / totalAllocated) * 100)
        : null,
    outstandingCustodies: outstandingAgg._sum.amount ?? 0,
    settledCustodies: settledAgg._sum.amount ?? 0,
    pendingPurchases: (pendingCount as number) ?? 0,
    approvedPurchases: (approvedCount as number) ?? 0,
  };
}

export async function getResourceAnalytics(
  projectId: string
): Promise<ResourceAnalytics> {
  // Equipment has fields: status, assignments (open assignment when
  // returnedAt is null), damageReports.
  // Status conventions used elsewhere: "available", "damaged", "lost".
  // "Assigned" is computed as having an open assignment.
  const [departments, equipment] = await Promise.all([
    prisma.department.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.equipment.findMany({
      where: { projectId },
      select: {
        id: true,
        departmentId: true,
        status: true,
        assignments: {
          where: { returnedAt: null },
          select: { id: true },
          take: 1,
        },
      },
    }),
  ]);

  let total = 0;
  let assigned = 0;
  let available = 0;
  let damaged = 0;
  const byDeptStats = new Map<
    string,
    { total: number; assigned: number; available: number; damaged: number }
  >();
  for (const d of departments) {
    byDeptStats.set(d.id, { total: 0, assigned: 0, available: 0, damaged: 0 });
  }
  for (const e of equipment) {
    total += 1;
    const isAssigned = e.assignments.length > 0;
    const isDamaged = e.status === "damaged" || e.status === "lost";
    if (isDamaged) damaged += 1;
    else if (isAssigned) assigned += 1;
    else available += 1;
    const row = byDeptStats.get(e.departmentId);
    if (row) {
      row.total += 1;
      if (isDamaged) row.damaged += 1;
      else if (isAssigned) row.assigned += 1;
      else row.available += 1;
    }
  }

  const byDepartment: ResourceAnalyticsRow[] = departments.map((d) => {
    const s = byDeptStats.get(d.id)!;
    return {
      departmentId: d.id,
      departmentName: d.name,
      total: s.total,
      assigned: s.assigned,
      available: s.available,
      damaged: s.damaged,
    };
  });

  return { total, assigned, available, damaged, byDepartment };
}

export async function getTeamAnalytics(
  projectId: string
): Promise<TeamAnalytics> {
  const [departments, memberByDept, allMembers] = await Promise.all([
    prisma.department.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.departmentMember.groupBy({
      by: ["departmentId"],
      where: { department: { projectId } },
      _count: { _all: true },
    }),
    prisma.projectMember.findMany({
      where: { projectId },
      select: { userId: true },
    }),
  ]);

  const map = new Map(
    memberByDept.map((r) => [r.departmentId, r._count._all])
  );
  const byDepartment: TeamAnalyticsRow[] = departments.map((d) => ({
    departmentId: d.id,
    departmentName: d.name,
    memberCount: map.get(d.id) ?? 0,
  }));

  // V0.15 — "Unassigned" = project members with zero DepartmentMember rows.
  const assignedUserIds = new Set(
    (
      await prisma.departmentMember.findMany({
        where: { department: { projectId } },
        select: { userId: true },
      })
    ).map((r) => r.userId)
  );
  const unassignedCount = allMembers.filter(
    (m) => !assignedUserIds.has(m.userId)
  ).length;

  return {
    totalMembers: allMembers.length,
    byDepartment,
    unassignedCount,
  };
}
