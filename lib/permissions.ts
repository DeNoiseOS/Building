import "server-only";
import { prisma } from "@/lib/prisma";
import {
  isProjectWideRole,
  isHead,
  roleLevel,
  departmentKindForRole,
} from "@/lib/hierarchy";
import { getInvitableRolesForRole } from "@/lib/department-registry";

/**
 * V0.5 — Centralized permission helpers.
 *
 * These functions are the *only* place permission logic lives.
 * Routes / readers / UI ask these helpers; nothing checks role strings
 * directly anymore.
 *
 * Vocabulary used here:
 *   - "memberRole"   the caller's ProjectMember.role on a given project.
 *                    Resolved on demand inside each helper for safety.
 *   - "owner"        the project's `Project.userId` — they can do everything,
 *                    independent of their role on the project (because they
 *                    are the originator).
 */

interface CallerContext {
  userId: string;
  projectId: string;
  /** Pre-resolved if you already fetched it; otherwise we'll look it up. */
  memberRole?: string;
  isOwner?: boolean;
  /** Department IDs the user belongs to on this project. */
  departmentIds?: string[];
}

async function resolveContext(c: CallerContext) {
  const memberRole =
    c.memberRole ??
    (
      await prisma.projectMember.findFirst({
        where: { projectId: c.projectId, userId: c.userId },
        select: { role: true },
      })
    )?.role ??
    null;

  const isOwner =
    c.isOwner ??
    !!(await prisma.project.findFirst({
      where: { id: c.projectId, userId: c.userId },
      select: { id: true },
    }));

  const departmentIds =
    c.departmentIds ??
    (
      await prisma.departmentMember.findMany({
        where: { userId: c.userId, department: { projectId: c.projectId } },
        select: { departmentId: true },
      })
    ).map((d) => d.departmentId);

  return { memberRole, isOwner, departmentIds };
}

// ─── Department management ───────────────────────────────────────────────

/**
 * Who can create / rename / delete a Department on a project.
 * V0.5: project owner + producer + director.
 */
export async function canManageDepartment(c: CallerContext): Promise<boolean> {
  const { memberRole, isOwner } = await resolveContext(c);
  if (isOwner) return true;
  if (!memberRole) return false;
  return isProjectWideRole(memberRole);
}

// ─── Invitations ─────────────────────────────────────────────────────────

/**
 * V0.10.1 — Invitation authority is derived from the department registry.
 *   Owner / Producer → any role
 *   Director         → any head role
 *   Department Head  → only their department's member roles
 *   Others           → none
 *
 * This replaces the V0.5 hand-maintained `hierarchy.canInvite` arrays
 * with a single source of truth in `lib/department-registry.ts`.
 */
export async function canInviteRole(
  c: CallerContext,
  targetRole: string
): Promise<boolean> {
  const { memberRole, isOwner } = await resolveContext(c);
  const allowed = getInvitableRolesForRole(memberRole, isOwner);
  return allowed.includes(targetRole);
}

/** Roles the caller can invite — for filtering the invite picker. */
export async function invitableRoles(c: CallerContext): Promise<string[]> {
  const { memberRole, isOwner } = await resolveContext(c);
  return getInvitableRolesForRole(memberRole, isOwner);
}

// ─── Approval workflow ───────────────────────────────────────────────────

interface TaskShape {
  id: string;
  projectId: string;
  departmentId: string | null;
  creatorId: string | null;
  assigneeId: string | null;
  approverId: string | null;
  ownerDepartment?: { kind: string } | null;
}

/**
 * Approval authority:
 *   - Producer can approve anything.
 *   - Director can approve project-wide tasks AND department tasks.
 *   - Department Head can approve tasks owned by their department.
 *   - An explicit approverId (if set) is always allowed.
 *   - Project owner is always allowed.
 */
export async function canApproveTask(
  c: CallerContext,
  task: TaskShape
): Promise<boolean> {
  if (task.projectId !== c.projectId) return false;
  const { memberRole, isOwner } = await resolveContext(c);
  if (isOwner) return true;
  if (task.approverId && task.approverId === c.userId) return true;
  if (!memberRole) return false;
  if (isProjectWideRole(memberRole)) return true; // producer / director

  if (isHead(memberRole) && task.departmentId && task.ownerDepartment) {
    return task.ownerDepartment.kind === memberRole;
  }
  return false;
}

// ─── Task visibility ─────────────────────────────────────────────────────

/**
 * V0.6 — visibility is no longer permission-gated. Any project member can
 * VIEW any task on the project. Edit authority is enforced separately by
 * `canEditTask` / `canApproveTask`. This keeps "see the whole picture" and
 * "only touch your own" cleanly separated.
 *
 * Non-members of the project still cannot view.
 */
export async function canViewTask(
  c: CallerContext,
  task: TaskShape
): Promise<boolean> {
  if (task.projectId !== c.projectId) return false;
  const { memberRole, isOwner } = await resolveContext(c);
  return isOwner || !!memberRole;
}

/**
 * Edit authority for a task:
 *   - Owner / producer / director — always.
 *   - Department head of the owner department — yes.
 *   - Creator — yes.
 *   - Assignee — can edit status/priority/description only (enforced at
 *     the route level; this helper says "yes, partial edit allowed").
 */
export async function canEditTask(
  c: CallerContext,
  task: TaskShape
): Promise<boolean> {
  if (task.projectId !== c.projectId) return false;
  const { memberRole, isOwner, departmentIds } = await resolveContext(c);
  if (isOwner) return true;
  if (!memberRole) return false;
  if (isProjectWideRole(memberRole)) return true;
  if (task.creatorId && task.creatorId === c.userId) return true;
  if (task.assigneeId && task.assigneeId === c.userId) return true;
  if (
    isHead(memberRole) &&
    task.departmentId &&
    departmentIds.includes(task.departmentId)
  ) {
    return true;
  }
  return false;
}

// ─── SQL filter builder ──────────────────────────────────────────────────

/**
 * V0.6 — any project member can view every task on the project. The list
 * readers no longer narrow by hierarchy; instead they rely on UI-level
 * department filters (see `parseDepartmentFilter` consumers) for slicing.
 *
 * - Project members → `undefined` (no extra restriction).
 * - Non-members    → `{ id: "__never__" }` (defensive empty set).
 */
export async function taskVisibilityFilter(
  c: CallerContext
): Promise<undefined | object> {
  const { memberRole, isOwner } = await resolveContext(c);
  if (isOwner || memberRole) return undefined;
  return { id: "__never__" };
}

// ─── Workspace / notes / refs visibility ─────────────────────────────────

/**
 * V0.6 — same change: every project member can view every note/reference.
 * Non-members get an empty set.
 */
export async function workspaceItemDepartmentFilter(
  c: CallerContext
): Promise<undefined | object> {
  const { memberRole, isOwner } = await resolveContext(c);
  if (isOwner || memberRole) return undefined;
  return { id: "__never__" };
}

// ─── Member role management ──────────────────────────────────────────────

/**
 * Whether the caller can change another member's role. V0.5 keeps this
 * owner-only as in V0.2 — but exposed here so future versions can relax it.
 */
export async function canManageMember(c: CallerContext): Promise<boolean> {
  const { isOwner } = await resolveContext(c);
  return isOwner;
}

// ─── V0.6.2 — budget visibility ──────────────────────────────────────────

/**
 * V0.6.2 — Who is permitted to see *project-wide* budget data:
 *   - Total budget
 *   - Sum of allocations across departments
 *   - Remaining at project level
 *   - All purchase requests
 *
 * Only Owner / Producer / Director qualify. Department Heads see their
 * own department's budget — never project-wide totals.
 *
 * Resolves the caller's context inline; safe to call from any route.
 */
export async function canViewProjectBudget(
  c: CallerContext
): Promise<boolean> {
  const { memberRole, isOwner } = await resolveContext(c);
  if (isOwner) return true;
  if (!memberRole) return false;
  return isProjectWideRole(memberRole);
}

/** Pure-role variant (no DB lookup). Used by hierarchy-aware UI helpers. */
export function canViewProjectBudgetByRole(role: string | null): boolean {
  if (!role) return false;
  return isProjectWideRole(role);
}

// ─── V0.6 department-filter helpers ──────────────────────────────────────

/**
 * Resolve the caller's department IDs on a project (used to default the
 * department filter to "my department" for non-project-wide roles).
 */
export async function getMyDepartmentIds(
  userId: string,
  projectId: string
): Promise<string[]> {
  const rows = await prisma.departmentMember.findMany({
    where: { userId, department: { projectId } },
    select: { departmentId: true },
  });
  return rows.map((r) => r.departmentId);
}

/** Re-export for convenience in non-server consumers. */
export { roleLevel, departmentKindForRole };
