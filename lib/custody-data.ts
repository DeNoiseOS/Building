import "server-only";
import { prisma } from "@/lib/prisma";
import { isProjectWideRole, isHead } from "@/lib/hierarchy";

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
}

export async function resolveCustodyContext(
  userId: string,
  projectId: string
): Promise<CustodyCallerContext> {
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

/** Producer / Owner only. */
export function canIssueCustody(ctx: CustodyCallerContext): boolean {
  if (ctx.isOwner) return true;
  if (!ctx.memberRole) return false;
  return ctx.memberRole === "producer";
}

/** Producer / Owner approves settlement. */
export function canApproveSettlement(ctx: CustodyCallerContext): boolean {
  return canIssueCustody(ctx);
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
  if (ctx.memberRole === "producer") return true;
  if (custody.holderUserId === ctx.userId) return true;
  if (!ctx.memberRole) return false;
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
  if (ctx.myDepartmentIds.length === 0) {
    return { holderUserId: ctx.userId };
  }
  return {
    OR: [
      { departmentId: { in: ctx.myDepartmentIds } },
      { holderUserId: ctx.userId },
    ],
  };
}

/**
 * Sum of purchased expenses linked to a custody. Returns spent in minor units.
 */
export async function custodySpent(custodyId: string): Promise<number> {
  const sum = await prisma.budgetRequest.aggregate({
    where: { custodyId, status: "purchased" },
    _sum: { estimatedCost: true },
  });
  return sum._sum.estimatedCost ?? 0;
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
