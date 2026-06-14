import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  badRequest,
  notFound,
  serverError,
  forbidden,
} from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { projectAccessFilter } from "@/lib/access";
import { canEditTask, canViewTask } from "@/lib/permissions";
import { notify } from "@/lib/notifications";
import {
  TASK_STATUS,
  TASK_STATUS_LABELS,
  TASK_PRIORITY,
  type TaskStatus,
  type TaskPriority,
} from "@/lib/roles";

const STATUS_VALUES = TASK_STATUS.map((s) => s.value) as [TaskStatus, ...TaskStatus[]];
const PRIORITY_VALUES = TASK_PRIORITY.map((p) => p.value) as [
  TaskPriority,
  ...TaskPriority[]
];

const updateSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(STATUS_VALUES).optional(),
  priority: z.enum(PRIORITY_VALUES).optional(),
  section: z.string().max(100).optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  /** V0.5: owner-department reassignment + approver. */
  departmentId: z.string().optional().nullable(),
  approverId: z.string().optional().nullable(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function loadTaskWithAccess(userId: string, taskId: string) {
  return prisma.task.findFirst({
    where: { id: taskId, project: projectAccessFilter(userId) },
    include: {
      project: { select: { id: true, name: true, role: true } },
      assignee: { select: { id: true, name: true } },
      department: { select: { id: true, kind: true, name: true } },
    },
  });
}

export async function GET(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const task = await loadTaskWithAccess(guard.userId, id);
  if (!task) return notFound("Task not found.");

  // V0.5 visibility: a task that exists on a project the caller can
  // access may still be invisible to them per the workflow rules.
  const canSee = await canViewTask(
    { userId: guard.userId, projectId: task.projectId },
    {
      id: task.id,
      projectId: task.projectId,
      departmentId: task.departmentId,
      creatorId: task.creatorId,
      assigneeId: task.assigneeId,
      approverId: task.approverId,
      ownerDepartment: task.department,
    }
  );
  if (!canSee) return notFound("Task not found.");

  return NextResponse.json(serializeTask(task));
}

export async function PATCH(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const existing = await loadTaskWithAccess(guard.userId, id);
  if (!existing) return notFound("Task not found.");

  const ctxCaller = { userId: guard.userId, projectId: existing.projectId };
  const editAllowed = await canEditTask(ctxCaller, {
    id: existing.id,
    projectId: existing.projectId,
    departmentId: existing.departmentId,
    creatorId: existing.creatorId,
    assigneeId: existing.assigneeId,
    approverId: existing.approverId,
    ownerDepartment: existing.department,
  });
  if (!editAllowed) return forbidden("You can't edit this task.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid task data.", parsed.error.flatten().fieldErrors);
  }

  // Validate assignee if changed.
  if (parsed.data.assigneeId !== undefined && parsed.data.assigneeId !== null) {
    const exists = await prisma.user.findUnique({
      where: { id: parsed.data.assigneeId },
      select: { id: true },
    });
    if (!exists) {
      return badRequest("Assignee not found.");
    }
  }

  // Compute completedAt side-effect based on status transition.
  const previousStatus = existing.status;
  const nextStatus = parsed.data.status ?? previousStatus;
  let completedAtChange: { completedAt: Date | null } | Record<string, never> = {};
  if (parsed.data.status !== undefined) {
    if (nextStatus === "done" && previousStatus !== "done") {
      completedAtChange = { completedAt: new Date() };
    } else if (nextStatus !== "done" && previousStatus === "done") {
      completedAtChange = { completedAt: null };
    }
  }

  try {
    const updated = await prisma.task.update({
      where: { id },
      data: {
        ...(parsed.data.title !== undefined && { title: parsed.data.title }),
        ...(parsed.data.description !== undefined && {
          description: parsed.data.description,
        }),
        ...(parsed.data.status !== undefined && { status: parsed.data.status }),
        ...(parsed.data.priority !== undefined && { priority: parsed.data.priority }),
        ...(parsed.data.section !== undefined && { section: parsed.data.section }),
        ...(parsed.data.dueDate !== undefined && {
          dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        }),
        ...(parsed.data.assigneeId !== undefined && {
          assigneeId: parsed.data.assigneeId,
        }),
        ...(parsed.data.departmentId !== undefined && {
          departmentId: parsed.data.departmentId,
        }),
        ...(parsed.data.approverId !== undefined && {
          approverId: parsed.data.approverId,
        }),
        ...completedAtChange,
      },
      include: {
        project: { select: { id: true, name: true, role: true } },
        assignee: { select: { id: true, name: true } },
      },
    });

    // Activity events.
    const becameDone = nextStatus === "done" && previousStatus !== "done";
    const becameUndone = nextStatus !== "done" && previousStatus === "done";

    if (becameDone) {
      await logActivity({
        projectId: existing.project.id,
        actorId: guard.userId,
        actorName: guard.userName,
        type: "task_completed",
        message: `completed '${updated.title}'.`,
        metadata: { taskId: updated.id, previousStatus },
      });
    } else if (becameUndone) {
      await logActivity({
        projectId: existing.project.id,
        actorId: guard.userId,
        actorName: guard.userName,
        type: "task_updated",
        message: `re-opened '${updated.title}'.`,
        metadata: {
          taskId: updated.id,
          from: previousStatus,
          to: nextStatus,
        },
      });
    } else if (parsed.data.status && nextStatus !== previousStatus) {
      await logActivity({
        projectId: existing.project.id,
        actorId: guard.userId,
        actorName: guard.userName,
        type: "task_updated",
        message: `moved '${updated.title}' to ${
          TASK_STATUS_LABELS[nextStatus] ?? nextStatus
        }.`,
        metadata: { taskId: updated.id, from: previousStatus, to: nextStatus },
      });
    } else {
      const changedFields = Object.keys(parsed.data).filter(
        (k) => parsed.data[k as keyof typeof parsed.data] !== undefined
      );
      if (changedFields.length > 0) {
        await logActivity({
          projectId: existing.project.id,
          actorId: guard.userId,
          actorName: guard.userName,
          type: "task_updated",
          message: `updated '${updated.title}'.`,
          metadata: { taskId: updated.id, fields: changedFields },
        });
      }
    }

    // V0.5 — reassignment notification & activity.
    const previousAssignee = existing.assigneeId;
    const nextAssignee = updated.assigneeId;
    if (
      parsed.data.assigneeId !== undefined &&
      nextAssignee !== previousAssignee
    ) {
      const isReassign = previousAssignee && nextAssignee;
      const type = isReassign ? "task_reassigned" : "task_assigned";
      await logActivity({
        projectId: existing.project.id,
        actorId: guard.userId,
        actorName: guard.userName,
        type,
        message: nextAssignee
          ? `${isReassign ? "reassigned" : "assigned"} '${updated.title}' to ${updated.assignee?.name ?? "someone"}.`
          : `unassigned '${updated.title}'.`,
        metadata: {
          taskId: updated.id,
          from: previousAssignee,
          to: nextAssignee,
        },
      });
      if (nextAssignee && nextAssignee !== guard.userId) {
        await notify({
          userId: nextAssignee,
          type: isReassign ? "task_reassigned" : "task_assigned",
          title: isReassign
            ? `${guard.userName} reassigned a task to you`
            : `${guard.userName} assigned you a task`,
          body: updated.title,
          link: `/projects/${updated.projectId}/tasks`,
          metadata: { taskId: updated.id, projectId: updated.projectId },
        });
      }
    }

    // V0.5 — task moved into waiting_approval: notify the approver(s).
    if (
      nextStatus === "waiting_approval" &&
      previousStatus !== "waiting_approval"
    ) {
      await logActivity({
        projectId: existing.project.id,
        actorId: guard.userId,
        actorName: guard.userName,
        type: "task_waiting_approval",
        message: `requested approval on '${updated.title}'.`,
        metadata: { taskId: updated.id },
      });
      const approvers = await resolveApprovers(existing.projectId, {
        approverId: updated.approverId,
        departmentId: updated.departmentId,
      });
      for (const approverId of approvers) {
        if (approverId === guard.userId) continue;
        await notify({
          userId: approverId,
          type: "task_waiting_approval",
          title: `Approval requested by ${guard.userName}`,
          body: updated.title,
          link: `/projects/${updated.projectId}/tasks`,
          metadata: { taskId: updated.id, projectId: updated.projectId },
        });
      }
    }

    return NextResponse.json(serializeTask(updated));
  } catch (err) {
    console.error("[tasks.PATCH]", err);
    return serverError("Failed to update task.");
  }
}

/**
 * Returns user IDs eligible to approve a task: the explicit approver,
 * the owner-department head(s), the project director, and the producer.
 */
async function resolveApprovers(
  projectId: string,
  hint: { approverId: string | null; departmentId: string | null }
): Promise<string[]> {
  const ids = new Set<string>();
  if (hint.approverId) ids.add(hint.approverId);

  // Producer + director on this project.
  const projectWide = await prisma.projectMember.findMany({
    where: {
      projectId,
      role: { in: ["producer", "director"] },
    },
    select: { userId: true },
  });
  projectWide.forEach((p) => ids.add(p.userId));

  // Project owner.
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });
  if (project) ids.add(project.userId);

  // Owner-department head(s) (member with role = department kind).
  if (hint.departmentId) {
    const dept = await prisma.department.findUnique({
      where: { id: hint.departmentId },
      select: { kind: true },
    });
    if (dept) {
      const heads = await prisma.projectMember.findMany({
        where: { projectId, role: dept.kind },
        select: { userId: true },
      });
      heads.forEach((h) => ids.add(h.userId));
    }
  }

  return Array.from(ids);
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const existing = await loadTaskWithAccess(guard.userId, id);
  if (!existing) return notFound("Task not found.");

  try {
    await prisma.task.delete({ where: { id } });
    await logActivity({
      projectId: existing.project.id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "task_deleted",
      message: `deleted task '${existing.title}'.`,
      metadata: { taskId: existing.id },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[tasks.DELETE]", err);
    return serverError("Failed to delete task.");
  }
}

function serializeTask(t: {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  section: string | null;
  dueDate: Date | null;
  completedAt: Date | null;
  assigneeId: string | null;
  assignee: { id: string; name: string } | null;
  project: { id: string; name: string; role: string };
  createdAt: Date;
  updatedAt: Date;
  departmentId?: string | null;
  creatorId?: string | null;
  approverId?: string | null;
}) {
  return {
    id: t.id,
    projectId: t.projectId,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    section: t.section,
    dueDate: t.dueDate?.toISOString() ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
    assigneeId: t.assigneeId,
    assignee: t.assignee,
    departmentId: t.departmentId ?? null,
    creatorId: t.creatorId ?? null,
    approverId: t.approverId ?? null,
    project: t.project,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}
