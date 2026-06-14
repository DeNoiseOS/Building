import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * V0.6.1 — Comment helpers.
 *
 * Comments are polymorphic by (targetType, targetId). Visibility on a
 * given target equals the caller's visibility on its parent project.
 *
 * Targets supported in V0.6.1:
 *   "task"               → Task
 *   "purchase_request"   → BudgetRequest
 *   "budget_allocation"  → DepartmentBudget
 */

export type CommentTargetType =
  | "task"
  | "purchase_request"
  | "budget_allocation"
  // V0.7
  | "note"
  | "reference"
  | "department_discussion"
  | "announcement";

/**
 * Look up the project a target belongs to. Returns null if it doesn't
 * exist or the type is unknown.
 */
export async function resolveTargetProject(
  targetType: string,
  targetId: string
): Promise<{ projectId: string } | null> {
  switch (targetType) {
    case "task": {
      const t = await prisma.task.findUnique({
        where: { id: targetId },
        select: { projectId: true },
      });
      return t ?? null;
    }
    case "purchase_request": {
      const p = await prisma.budgetRequest.findUnique({
        where: { id: targetId },
        select: { projectId: true },
      });
      return p ?? null;
    }
    case "budget_allocation": {
      const a = await prisma.departmentBudget.findUnique({
        where: { id: targetId },
        select: { projectId: true },
      });
      return a ?? null;
    }
    case "note": {
      const n = await prisma.note.findUnique({
        where: { id: targetId },
        select: { projectId: true },
      });
      return n ?? null;
    }
    case "reference": {
      const r = await prisma.reference.findUnique({
        where: { id: targetId },
        select: { projectId: true },
      });
      return r ?? null;
    }
    case "department_discussion": {
      const d = await prisma.department.findUnique({
        where: { id: targetId },
        select: { projectId: true },
      });
      return d ?? null;
    }
    case "announcement": {
      const a = await prisma.announcement.findUnique({
        where: { id: targetId },
        select: { projectId: true },
      });
      return a ?? null;
    }
    default:
      return null;
  }
}

/**
 * Resolve the user IDs that should be notified about a new comment on
 * a given target. Generally: the parties involved with that target,
 * excluding the comment author.
 */
export async function targetNotificationRecipients(
  targetType: string,
  targetId: string
): Promise<string[]> {
  const ids = new Set<string>();
  switch (targetType) {
    case "task": {
      const t = await prisma.task.findUnique({
        where: { id: targetId },
        select: {
          creatorId: true,
          assigneeId: true,
          approverId: true,
        },
      });
      if (t) {
        if (t.creatorId) ids.add(t.creatorId);
        if (t.assigneeId) ids.add(t.assigneeId);
        if (t.approverId) ids.add(t.approverId);
      }
      break;
    }
    case "purchase_request": {
      const p = await prisma.budgetRequest.findUnique({
        where: { id: targetId },
        select: { requesterId: true, projectId: true },
      });
      if (p) {
        ids.add(p.requesterId);
        const approvers = await prisma.projectMember.findMany({
          where: { projectId: p.projectId, role: "producer" },
          select: { userId: true },
        });
        approvers.forEach((a) => ids.add(a.userId));
      }
      break;
    }
    case "budget_allocation": {
      const a = await prisma.departmentBudget.findUnique({
        where: { id: targetId },
        select: { projectId: true, departmentId: true, department: { select: { kind: true } } },
      });
      if (a) {
        const project = await prisma.project.findUnique({
          where: { id: a.projectId },
          select: { userId: true },
        });
        if (project) ids.add(project.userId);
        const producers = await prisma.projectMember.findMany({
          where: { projectId: a.projectId, role: "producer" },
          select: { userId: true },
        });
        producers.forEach((p) => ids.add(p.userId));
        const heads = await prisma.projectMember.findMany({
          where: { projectId: a.projectId, role: a.department.kind },
          select: { userId: true },
        });
        heads.forEach((h) => ids.add(h.userId));
        const leads = await prisma.departmentMember.findMany({
          where: { departmentId: a.departmentId, role: "lead" },
          select: { userId: true },
        });
        leads.forEach((l) => ids.add(l.userId));
      }
      break;
    }
  }
  return Array.from(ids);
}
