import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  badRequest,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { canApproveTask } from "@/lib/permissions";
import { notify } from "@/lib/notifications";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/tasks/[id]/approve
 * Approves a task in waiting_approval → done.
 */
export async function POST(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      department: { select: { id: true, kind: true, name: true } },
      assignee: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true } },
    },
  });
  if (!task) return notFound("Task not found.");
  if (task.status !== "waiting_approval") {
    return badRequest("Only tasks awaiting approval can be approved.");
  }

  const ok = await canApproveTask(
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
  if (!ok) return forbidden("You can't approve this task.");

  try {
    const updated = await prisma.task.update({
      where: { id },
      data: { status: "done", completedAt: new Date() },
    });

    await logActivity({
      projectId: task.projectId,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "task_approved",
      message: `approved '${updated.title}'.`,
      metadata: { taskId: updated.id },
    });

    const recipients = new Set<string>();
    if (task.assigneeId) recipients.add(task.assigneeId);
    if (task.creatorId) recipients.add(task.creatorId);
    recipients.delete(guard.userId);
    for (const userId of recipients) {
      await notify({
        userId,
        type: "task_approved",
        title: `${guard.userName} approved a task`,
        body: updated.title,
        link: `/projects/${updated.projectId}/tasks`,
        metadata: { taskId: updated.id, projectId: updated.projectId },
      });
    }

    return NextResponse.json({ ok: true, status: updated.status });
  } catch (err) {
    console.error("[tasks.approve]", err);
    return serverError("Failed to approve task.");
  }
}
