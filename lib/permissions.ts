import "server-only";
import { prisma } from "@/lib/prisma";
import {
  isProjectWideRole,
  isHead,
  roleLevel,
  departmentKindForRole,
} from "@/lib/hierarchy";
import {
  getInvitableRolesForRole,
  getDepartmentByHeadRole,
  getDepartmentForRole,
  resolveHeadRoleFromPresent,
} from "@/lib/department-registry";

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

/**
 * V0.12 — Whether the caller can manage (add / remove) members of a
 * specific department on a project. Authority:
 *   - Owner
 *   - Project-wide roles (Producer / EP / Director)
 *   - The *resolved* head of THAT department (per V0.11 dynamic resolver)
 *
 * Department heads can only manage their own department — they cannot
 * touch other departments' rosters.
 */
export async function canManageDepartmentMembers(
  c: CallerContext,
  departmentKind: string
): Promise<boolean> {
  const { memberRole, isOwner } = await resolveContext(c);
  if (isOwner) return true;
  if (!memberRole) return false;
  if (isProjectWideRole(memberRole)) return true;
  return isResolvedDepartmentHead(c, departmentKind);
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
  const allowed = await invitableRoles(c);
  return allowed.includes(targetRole);
}

/**
 * V0.12.1 — Roles the caller can invite.
 *
 * Static rules (from the registry) say "any head-candidate can invite
 * their dept's members". But per V0.11 only the *resolved* head — the
 * highest-priority head-candidate actually present in the project — is
 * the head. A head-candidate who is NOT the resolved head gets no
 * invite rights here.
 *
 * Example: if Art has both a Production Designer and an Art Director,
 * only the PD (resolved head) can invite Prop Master / Set Dresser /
 * Art Assistant. The AD's static head-candidate rights are revoked at
 * runtime.
 */
export async function invitableRoles(c: CallerContext): Promise<string[]> {
  const { memberRole, isOwner } = await resolveContext(c);
  const staticAllowed = getInvitableRolesForRole(memberRole, isOwner);
  if (staticAllowed.length === 0) return staticAllowed;
  if (isOwner) return staticAllowed;
  if (!memberRole) return [];

  // Producer / EP / Director are always allowed their static set.
  if (
    memberRole === "executive_producer" ||
    memberRole === "producer" ||
    memberRole === "director"
  ) {
    return staticAllowed;
  }

  // Otherwise, the caller is a head-candidate of some department. Only
  // the *resolved* head retains invite rights.
  const dept = getDepartmentForRole(memberRole);
  if (!dept || !dept.headRoles.includes(memberRole)) return [];

  const present = await prisma.projectMember.findMany({
    where: { projectId: c.projectId, role: { in: dept.headRoles } },
    select: { role: true },
  });
  const resolved = resolveHeadRoleFromPresent(
    dept.key,
    present.map((p) => p.role)
  );
  return resolved === memberRole ? staticAllowed : [];
}

// ─── V0.11 — Dynamic department head resolution ─────────────────────────

/**
 * V0.11 — Resolve whether the caller is the *runtime* head of a department.
 *
 * The head is the highest-priority role from `dept.headRoles` that is
 * actually present among the project's members. Example: in an Art
 * department where headRoles = ["production_designer", "art_director",
 * "assistant_art_director"], if a Production Designer is on the project,
 * THEY are the head; otherwise the AD; otherwise the Asst AD.
 *
 * `departmentKind` accepts either the new canonical kind (e.g.
 * "production_designer") or any legacy kind ("art_director",
 * "camera_department", etc.). The registry's `getDepartmentByHeadRole`
 * handles the lookup.
 */
export async function isResolvedDepartmentHead(
  c: CallerContext & { memberRole?: string },
  departmentKind: string
): Promise<boolean> {
  const { memberRole } = await resolveContext(c);
  if (!memberRole) return false;

  const dept = getDepartmentByHeadRole(departmentKind);
  if (!dept) return false;
  if (!dept.headRoles.includes(memberRole)) return false;

  // Which head candidates are actually present in the project?
  const present = await prisma.projectMember.findMany({
    where: { projectId: c.projectId, role: { in: dept.headRoles } },
    select: { role: true },
  });
  const presentSet = new Set(present.map((p) => p.role));
  const resolved = dept.headRoles.find((r) => presentSet.has(r));
  return resolved === memberRole;
}

// ─── V0.11 — Owner-only authorities (EP cannot do these) ─────────────────

/**
 * V0.11 — Strictly owner-only operations. Executive Producer has nearly
 * full project authority *except* for these.
 *   - Delete the project
 *   - Transfer project ownership
 *   - Modify Owner permissions
 */
export async function canDeleteProject(c: CallerContext): Promise<boolean> {
  const { isOwner } = await resolveContext(c);
  return isOwner;
}

export async function canTransferOwnership(c: CallerContext): Promise<boolean> {
  const { isOwner } = await resolveContext(c);
  return isOwner;
}

// ─── V0.11 — Currency change permission ──────────────────────────────────

/**
 * V0.11 — Only Owner, Executive Producer, and Producer may change a
 * project's currency after creation. Everyone else is read-only.
 */
export async function canChangeProjectCurrency(
  c: CallerContext
): Promise<boolean> {
  const { memberRole, isOwner } = await resolveContext(c);
  if (isOwner) return true;
  if (!memberRole) return false;
  return memberRole === "executive_producer" || memberRole === "producer";
}

/**
 * V0.15 — View project-wide analytics dashboard.
 *
 *   Owner / Executive Producer / Producer → yes
 *   Anyone else (including Director, dept heads, members) → no
 *
 * Director sees their own slice via Tasks / Calendar / Activity but
 * not the financial / utilization roll-ups. Tight by design — these
 * dashboards expose budget totals and could be sensitive.
 */
export async function canViewAnalytics(
  c: CallerContext
): Promise<boolean> {
  const { memberRole, isOwner } = await resolveContext(c);
  if (isOwner) return true;
  if (!memberRole) return false;
  return memberRole === "executive_producer" || memberRole === "producer";
}

/**
 * V0.16 — Manage assets in a department (create/edit/assign/return,
 * log maintenance, resolve damage).
 *
 *   Owner / Executive Producer / Producer       → any dept
 *   Resolved Department Head (V0.11)            → only their dept
 *   Everyone else                               → no
 */
export async function canManageAssets(
  c: CallerContext,
  departmentKind: string
): Promise<boolean> {
  const { memberRole, isOwner } = await resolveContext(c);
  if (isOwner) return true;
  if (!memberRole) return false;
  if (
    memberRole === "executive_producer" ||
    memberRole === "producer"
  ) {
    return true;
  }
  return isResolvedDepartmentHead(c, departmentKind);
}

/**
 * V0.16 — Report damage on a department's asset. Any project member
 * may report — they're often the person who noticed the breakage.
 */
export async function canReportDamage(
  c: CallerContext
): Promise<boolean> {
  const { memberRole, isOwner } = await resolveContext(c);
  return isOwner || !!memberRole;
}

// ─── V0.17 — Scene planning permissions ──────────────────────────────

/**
 * V0.17 — Create / edit / delete scenes, plus change scene status and
 * approve department completions.
 *
 *   Owner / Executive Producer / Producer / Director / Assistant
 *   Director (incl. 1st AD)  → yes
 *   Everyone else            → no
 */
const SCENE_AUTHOR_ROLES = new Set([
  "executive_producer",
  "producer",
  "director",
  "assistant_director",
  "first_assistant_director",
]);

export async function canManageScene(c: CallerContext): Promise<boolean> {
  const { memberRole, isOwner } = await resolveContext(c);
  if (isOwner) return true;
  if (!memberRole) return false;
  return SCENE_AUTHOR_ROLES.has(memberRole);
}

/**
 * V0.17 — Approve a department's completion of a scene.
 * Same allow-list as canManageScene (Director / AD / Producer / EP /
 * Owner). Dept heads can mark their own dept "completed" but they
 * cannot self-approve.
 */
export async function canApproveSceneDepartment(
  c: CallerContext
): Promise<boolean> {
  return canManageScene(c);
}

/**
 * V0.17 — Edit a department's scene workspace (requirements, notes,
 * attachments, dept status). Resolved dept head + the scene-manager
 * roles above. Dept members can read but not write.
 */
export async function canEditSceneDepartment(
  c: CallerContext,
  departmentKind: string
): Promise<boolean> {
  if (await canManageScene(c)) return true;
  return canManageAssets(c, departmentKind);
}

/**
 * V0.20 — Production Bible authoring.
 *
 * Add/edit/delete an entry inside the Bible. Allow-list:
 *   - departmentKind = null → "Direction & Production" section.
 *     Only scene-manager roles (Director/AD/Producer/EP/Owner).
 *   - departmentKind set → that department's resolved head + the
 *     scene-manager roles above. Dept members can browse but not
 *     write.
 *
 * Reuses canManageScene + canManageAssets so the allow-list stays
 * consistent with Scenes / Resources.
 */
export async function canEditBibleSection(
  c: CallerContext,
  departmentKind: string | null
): Promise<boolean> {
  if (await canManageScene(c)) return true;
  if (departmentKind === null) return false;
  return canManageAssets(c, departmentKind);
}

/**
 * V0.12.1 — Edit project settings (name, description, dates, status,
 * currency). Restricted to Owner, Executive Producer, and Producer.
 * Dept heads + members are read-only.
 */
export async function canEditProjectSettings(
  c: CallerContext
): Promise<boolean> {
  const { memberRole, isOwner } = await resolveContext(c);
  if (isOwner) return true;
  if (!memberRole) return false;
  return memberRole === "executive_producer" || memberRole === "producer";
}

/**
 * V0.12.1 — Manage another member (change role, remove). Owner, EP, or
 * Producer. The caller can never act on themselves — that's enforced
 * at the route level so this helper stays simple.
 */
export async function canManageProjectMembers(
  c: CallerContext
): Promise<boolean> {
  return canEditProjectSettings(c);
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

  // V0.11 — dynamic head resolution. Any head-candidate role that resolves
  // to the *actual* head of the owner department gets approval authority.
  if (isHead(memberRole) && task.departmentId && task.ownerDepartment) {
    return isResolvedDepartmentHead(c, task.ownerDepartment.kind);
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
