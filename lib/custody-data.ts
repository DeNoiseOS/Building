import "server-only";
import { prisma } from "@/lib/prisma";
import { isProjectWideRole, isHead } from "@/lib/hierarchy";
import {
  getDepartmentByHeadRole,
  resolveHeadRoleFromPresent,
} from "@/lib/department-registry";

/**
 * V0.9 — Custody domain helpers.
 *
 * Custody represents real cash issued to a holder. Producer/Owner issues;
 * department members can spend through it via linked expenses; the
 * department head can request settlement; producer/owner approves to
 * close the custody.
 *
 * Remaining balance is *derived*, never stored:
 *   remaining = amount - sum(BudgetRequest.estimatedCost
 *                            WHERE custodyId = this.id
 *                              AND status = 'purchased')
 */

export const CUSTODY_STATUS = [
  { value: "active", label: "Active" },
  { value: "settled", label: "Settled" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export type CustodyStatus = (typeof CUSTODY_STATUS)[number]["value"];

export const CUSTODY_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  CUSTODY_STATUS.map((s) => [s.value, s.label])
);

export interface CustodyCallerContext {
  userId: string;
  memberRole: string | null;
  isOwner: boolean;
  myDepartmentIds: string[];
  /**
   * V0.12.3 — Departments this user is the *resolved* head of, per the
   * V0.11 priority list. Used to gate "issue custody" (head-only) and
   * to widen the custody visibility filter so heads see their dept's
   * custodies even if they have no DepartmentMember row.
   */
  myHeadOfDeptIds: string[];
}

export async function resolveCustodyContext(
  userId: string,
  projectId: string
): Promise<CustodyCallerContext> {
  const [mem, ownerRow, deptRows, projectDepts, allMembers] = await Promise.all([
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
    prisma.department.findMany({
      where: { projectId },
      select: { id: true, kind: true },
    }),
    prisma.projectMember.findMany({
      where: { projectId },
      select: { role: true },
    }),
  ]);

  // V0.12.3 — resolve "which depts am I the head of?" using V0.11 priority.
  const myRole = mem?.role ?? null;
  const myHeadOfDeptIds: string[] = [];
  if (myRole) {
    const presentRoles = allMembers.map((m) => m.role);
    for (const d of projectDepts) {
      const reg = getDepartmentByHeadRole(d.kind);
      if (!reg) continue;
      const resolved = resolveHeadRoleFromPresent(reg.key, presentRoles);
      if (resolved === myRole) myHeadOfDeptIds.push(d.id);
    }
  }

  return {
    userId,
    memberRole: myRole,
    isOwner: !!ownerRow,
    myDepartmentIds: deptRows.map((d) => d.departmentId),
    myHeadOfDeptIds,
  };
}

/**
 * V0.12.3 — Custody issuance.
 *
 *   Old: Producer / Owner issued custody.
 *   New: the dept HEAD (resolved per V0.11) issues custody from their
 *        own department's allocated budget. Producer no longer issues
 *        — their authority is to allocate dept budgets, not to put
 *        cash directly into a sub-member's hand.
 *
 * Owner remains an emergency override.
 *
 * Capability check (no dept id) — returns true if the caller is the
 * resolved head of *any* department.
 */
export function canIssueCustody(
  ctx: CustodyCallerContext,
  departmentId?: string
): boolean {
  if (ctx.isOwner) return true;
  if (!ctx.memberRole) return false;
  if (departmentId) return ctx.myHeadOfDeptIds.includes(departmentId);
  return ctx.myHeadOfDeptIds.length > 0;
}

/**
 * V0.12.3 — Settlement approval.
 *
 * The dept head requests settlement when a custody is consumed; an
 * upstream authority (Owner / EP / Producer) reviews and closes it.
 */
export function canApproveSettlement(ctx: CustodyCallerContext): boolean {
  if (ctx.isOwner) return true;
  if (!ctx.memberRole) return false;
  return ctx.memberRole === "producer" || ctx.memberRole === "executive_producer";
}

/**
 * Who can request settlement on a custody:
 *   - the holder
 *   - the department head of the custody's department
 *   - owner / producer (admin path)
 */
export function canRequestSettlement(
  ctx: CustodyCallerContext,
  custody: { holderUserId: string; departmentId: string; departmentKind: string }
): boolean {
  if (ctx.isOwner) return true;
  if (ctx.memberRole === "producer" || ctx.memberRole === "executive_producer") return true;
  if (custody.holderUserId === ctx.userId) return true;
  if (!ctx.memberRole) return false;
  // V0.12.3 — resolved dept head (V0.11 priority list).
  if (ctx.myHeadOfDeptIds.includes(custody.departmentId)) return true;
  // Legacy static head match — kept for backwards compatibility.
  if (isHead(ctx.memberRole) && ctx.memberRole === custody.departmentKind) {
    return true;
  }
  return ctx.myDepartmentIds.includes(custody.departmentId);
}

/**
 * Visibility filter for custody listings:
 *   - Owner / Producer / Director: see all on the project.
 *   - Department head / member: see custodies in their departments OR
 *     where they're the holder.
 *   - Non-member: empty set.
 */
export function custodyVisibilityFilter(ctx: CustodyCallerContext): object {
  if (ctx.isOwner) return {};
  if (!ctx.memberRole) return { id: "__never__" };
  if (isProjectWideRole(ctx.memberRole)) return {};
  // V0.12.3 — union of: depts I'm assigned to + depts I'm resolved head
  // of + custodies I personally hold.
  const visibleDeptIds = Array.from(
    new Set([...ctx.myDepartmentIds, ...ctx.myHeadOfDeptIds])
  );
  if (visibleDeptIds.length === 0) {
    return { holderUserId: ctx.userId };
  }
  return {
    OR: [
      { departmentId: { in: visibleDeptIds } },
      { holderUserId: ctx.userId },
    ],
  };
}

/**
 * V0.14.3 — Sum reserved against a custody from PENDING purchases.
 * Used to reserve balance so two members can't simultaneously submit
 * pending purchases that together overdraw the custody.
 */
export async function custodyReservedByPending(
  custodyId: string,
  excludePurchaseId?: string
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const purchaseModel = (prisma as any).purchase;
  if (!purchaseModel || typeof purchaseModel.aggregate !== "function") return 0;
  const where: Record<string, unknown> = {
    custodyId,
    status: "pending",
  };
  if (excludePurchaseId) {
    where.id = { not: excludePurchaseId };
  }
  const agg = await purchaseModel
    .aggregate({ where, _sum: { amount: true } })
    .catch(() => null);
  return agg?._sum?.amount ?? 0;
}

/**
 * V0.14.3 — Available headroom on a custody = amount − approved spend
 * − pending reservations. Used by purchase create + approve to refuse
 * overdrafts. Pass `excludePurchaseId` when re-checking an existing
 * pending purchase (so it doesn't count itself as a reservation).
 */
export async function custodyAvailable(
  custodyId: string,
  custodyAmount: number,
  excludePurchaseId?: string
): Promise<number> {
  const [spent, pending] = await Promise.all([
    custodySpent(custodyId),
    custodyReservedByPending(custodyId, excludePurchaseId),
  ]);
  return custodyAmount - spent - pending;
}

/**
 * V0.14.3 — Department headroom for issuing a new custody.
 *
 *   headroom = approved dept allocation
 *            − sum(active+settled custody amounts in this dept)
 *            − sum(non-custody approved Purchase amounts in this dept)
 *
 * Used by the CustodyRequest approval endpoint to refuse approvals
 * that would push the dept over its allocated budget.
 */
export async function departmentBudgetHeadroom(
  projectId: string,
  departmentId: string
): Promise<{ allocated: number; committed: number; headroom: number }> {
  const [alloc, custodySum, purchaseModel] = await Promise.all([
    prisma.departmentBudget.findFirst({
      where: { projectId, departmentId },
      select: { approvedAmount: true, allocatedAmount: true, status: true },
    }),
    prisma.custody.aggregate({
      where: {
        projectId,
        departmentId,
        status: { in: ["active", "settled"] },
      },
      _sum: { amount: true },
    }),
    Promise.resolve(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prisma as unknown as { purchase?: any }).purchase
    ),
  ]);
  // Approved is the binding cap; fall back to allocated if not approved yet.
  const allocated = alloc?.approvedAmount ?? alloc?.allocatedAmount ?? 0;
  const issuedCustodies = custodySum._sum.amount ?? 0;
  let nonCustodyPurchases = 0;
  if (purchaseModel && typeof purchaseModel.aggregate === "function") {
    const agg = await purchaseModel
      .aggregate({
        where: {
          projectId,
          departmentId,
          status: "approved",
          custodyId: null,
        },
        _sum: { amount: true },
      })
      .catch(() => null);
    nonCustodyPurchases = agg?._sum?.amount ?? 0;
  }
  const committed = issuedCustodies + nonCustodyPurchases;
  return { allocated, committed, headroom: allocated - committed };
}

/**
 * Sum of spend linked to a custody. Returns spent in minor units.
 *
 * V0.14.1 — Combines two sources:
 *   1) Legacy BudgetRequests with status=purchased (V0.6 flow)
 *   2) V0.13 Purchases linked via Purchase.custodyId with status=approved
 *      (pending and rejected purchases don't count)
 */
export async function custodySpent(custodyId: string): Promise<number> {
  const reqs = await prisma.budgetRequest.aggregate({
    where: { custodyId, status: "purchased" },
    _sum: { estimatedCost: true },
  });
  let purchasesSum = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const purchaseModel = (prisma as any).purchase;
  if (purchaseModel && typeof purchaseModel.aggregate === "function") {
    const p = await purchaseModel
      .aggregate({
        where: { custodyId, status: "approved" },
        _sum: { amount: true },
      })
      .catch(() => null);
    purchasesSum = p?._sum?.amount ?? 0;
  }
  return (reqs._sum.estimatedCost ?? 0) + purchasesSum;
}

/**
 * Per-project aggregates for the financial dashboard:
 *   activeCount, pendingSettlementCount, totalIssued, totalSpentViaCustody.
 */
export async function getProjectCustodyTotals(projectId: string) {
  const rows = await prisma.custody.findMany({
    where: { projectId },
    select: { id: true, amount: true, status: true, settlementStatus: true },
  });
  let activeCount = 0;
  let pendingSettlement = 0;
  let totalIssued = 0;
  for (const r of rows) {
    totalIssued += r.amount;
    if (r.status === "active") activeCount += 1;
    if (r.settlementStatus === "pending") pendingSettlement += 1;
  }
  const spent = await prisma.budgetRequest.aggregate({
    where: {
      projectId,
      status: "purchased",
      custodyId: { not: null },
    },
    _sum: { estimatedCost: true },
  });
  return {
    activeCount,
    pendingSettlement,
    totalIssued,
    spentViaCustody: spent._sum.estimatedCost ?? 0,
  };
}
