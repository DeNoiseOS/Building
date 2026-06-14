import "server-only";
import { prisma } from "@/lib/prisma";
import {
  isProjectWideRole,
  isHead,
  departmentKindForRole,
} from "@/lib/hierarchy";

/**
 * V0.6 — Budget Request data layer.
 *
 * NOT accounting. NOT expense tracking. NOT procurement. This is a
 * workflow-only model for the "we need to spend money on X" conversation
 * and its lifecycle: draft → submitted → approved | rejected → purchased.
 *
 * Visibility:
 *   - Producer / Director / Project Owner: see every request.
 *   - Department Head: see requests in their department.
 *   - Department Member: see only their own department's requests AND
 *     their own drafts (per directive).
 *
 * Authority:
 *   - Create draft        : any project member
 *   - Submit              : department head (or owner / producer)
 *   - Approve / Reject    : producer / project owner
 *   - Mark Purchased      : producer / project owner
 */

// V0.6 — status vocab lives in lib/budget-status.ts so client components
// can import it without dragging in the server-only data layer. Re-exported
// here so server code keeps importing from one place.
export {
  BUDGET_STATUS,
  BUDGET_STATUS_LABELS,
  type BudgetStatus,
} from "@/lib/budget-status";

export interface BudgetCallerContext {
  userId: string;
  memberRole: string | null;
  isOwner: boolean;
  myDepartmentIds: string[];
}

export async function resolveBudgetContext(
  userId: string,
  projectId: string
): Promise<BudgetCallerContext> {
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
 * V0.6.3 — Approval authority for a Department Expense.
 *
 * Authority sits with the Department Head of the *request's* department.
 * Producer / Director are explicitly NOT approvers under the new chain;
 * their authority ends at Budget Allocation. Owner retains an override
 * for unusual cases.
 *
 * "Head of this dept" = ProjectMember.role matches `Department.kind`
 *                       OR DepartmentMember(role="lead") on this dept.
 */
export function canApproveDepartmentExpense(
  ctx: BudgetCallerContext,
  request: { departmentId: string; departmentKind: string }
): boolean {
  if (ctx.isOwner) return true; // optional override
  if (!ctx.memberRole) return false;
  // Producers and Directors are NOT department-expense approvers.
  if (isProjectWideRole(ctx.memberRole)) return false;
  // Head by ProjectMember.role matching the department's kind.
  if (isHead(ctx.memberRole) && ctx.memberRole === request.departmentKind) {
    return true;
  }
  // Head by DepartmentMember "lead" on the same department.
  return ctx.myDepartmentIds.includes(request.departmentId);
}

/**
 * Legacy alias: V0.6.2 callers still import `canApproveBudget`. Map it
 * to the new authority — without a department context (used for "can
 * you approve *anything*" UI affordances), accept owner OR any head.
 */
export function canApproveBudget(ctx: BudgetCallerContext): boolean {
  if (ctx.isOwner) return true;
  if (!ctx.memberRole) return false;
  if (isProjectWideRole(ctx.memberRole)) return false;
  return isHead(ctx.memberRole) || ctx.myDepartmentIds.length > 0;
}

/**
 * V0.6.3 — Department heads (and owner) mark expenses purchased.
 * Producers / Directors cannot.
 */
export function canMarkPurchased(
  ctx: BudgetCallerContext,
  request?: { departmentId: string; departmentKind: string }
): boolean {
  if (ctx.isOwner) return true;
  if (!ctx.memberRole) return false;
  if (isProjectWideRole(ctx.memberRole)) return false;
  if (!request) {
    // Capability check — any head can mark purchases in their dept.
    return isHead(ctx.memberRole) || ctx.myDepartmentIds.length > 0;
  }
  return canApproveDepartmentExpense(ctx, request);
}

export function canSubmitBudget(
  ctx: BudgetCallerContext,
  request: { departmentId: string; requesterId: string }
): boolean {
  if (ctx.isOwner) return true;
  if (!ctx.memberRole) return false;
  if (isProjectWideRole(ctx.memberRole)) return true;
  if (
    isHead(ctx.memberRole) &&
    ctx.myDepartmentIds.includes(request.departmentId)
  ) {
    return true;
  }
  // Members can submit their own drafts.
  return ctx.userId === request.requesterId;
}

export function canEditBudget(
  ctx: BudgetCallerContext,
  request: { status: string; requesterId: string; departmentId: string }
): boolean {
  if (ctx.isOwner) return true;
  // Once approved/rejected/purchased, only owner/producer can edit.
  if (request.status !== "draft") {
    return ctx.memberRole === "producer";
  }
  // Drafts: requester can edit own; head can edit anything in their dept.
  if (request.requesterId === ctx.userId) return true;
  if (!ctx.memberRole) return false;
  if (isProjectWideRole(ctx.memberRole)) return true;
  return (
    isHead(ctx.memberRole) &&
    ctx.myDepartmentIds.includes(request.departmentId)
  );
}

export function canCreateBudget(
  ctx: BudgetCallerContext,
  departmentId: string
): boolean {
  if (ctx.isOwner) return true;
  if (!ctx.memberRole) return false;
  if (isProjectWideRole(ctx.memberRole)) return true;
  // Head can create in their own department.
  if (isHead(ctx.memberRole)) {
    return ctx.myDepartmentIds.includes(departmentId);
  }
  // Members create drafts in any department they belong to.
  return ctx.myDepartmentIds.includes(departmentId);
}

/**
 * Build a Prisma `where` fragment for the request list view that
 * implements V0.6.2 visibility:
 *   - Owner / Producer / Director: no extra restriction.
 *   - Anyone else (Dept Head / Member): requests whose department
 *     they belong to — and ONLY those. Cross-department drafts are
 *     not exposed even to their authors.
 */
export function budgetVisibilityFilter(ctx: BudgetCallerContext): object {
  if (ctx.isOwner) return {};
  if (!ctx.memberRole) return { id: "__never__" };
  if (isProjectWideRole(ctx.memberRole)) return {};
  if (ctx.myDepartmentIds.length === 0) {
    return { id: "__never__" };
  }
  return { departmentId: { in: ctx.myDepartmentIds } };
}

/**
 * Who should be notified when a request is submitted? Project owner +
 * any project member with role "producer".
 */
export async function approverUserIds(projectId: string): Promise<string[]> {
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

// ─── Aggregations for the dashboard ──────────────────────────────────────

export interface BudgetTotals {
  totalRequested: number;
  totalApproved: number;
  totalPurchased: number;
  pendingApproval: number;
}

export async function getProjectBudgetTotals(
  projectId: string
): Promise<BudgetTotals> {
  const rows = await prisma.budgetRequest.findMany({
    where: { projectId },
    select: { status: true, estimatedCost: true },
  });
  let requested = 0;
  let approved = 0;
  let purchased = 0;
  let pending = 0;
  for (const r of rows) {
    requested += r.estimatedCost;
    if (r.status === "approved") approved += r.estimatedCost;
    if (r.status === "purchased") purchased += r.estimatedCost;
    if (r.status === "submitted") pending += r.estimatedCost;
  }
  return {
    totalRequested: requested,
    totalApproved: approved,
    totalPurchased: purchased,
    pendingApproval: pending,
  };
}

export interface BudgetDeptBreakdownRow {
  departmentId: string;
  name: string;
  kind: string;
  requested: number;
  approved: number;
  purchased: number;
}

export async function getDepartmentBreakdown(
  projectId: string
): Promise<BudgetDeptBreakdownRow[]> {
  const [depts, requests] = await Promise.all([
    prisma.department.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, kind: true },
    }),
    prisma.budgetRequest.findMany({
      where: { projectId },
      select: {
        departmentId: true,
        status: true,
        estimatedCost: true,
      },
    }),
  ]);
  return depts.map((d) => {
    let requested = 0;
    let approved = 0;
    let purchased = 0;
    for (const r of requests) {
      if (r.departmentId !== d.id) continue;
      requested += r.estimatedCost;
      if (r.status === "approved") approved += r.estimatedCost;
      if (r.status === "purchased") purchased += r.estimatedCost;
    }
    return {
      departmentId: d.id,
      name: d.name,
      kind: d.kind,
      requested,
      approved,
      purchased,
    };
  });
}

// Re-export helpers so route handlers don't need their own imports.
export { isProjectWideRole, isHead, departmentKindForRole };
