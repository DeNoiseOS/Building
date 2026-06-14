import { NextResponse } from "next/server";
import { z } from "zod";
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

const rejectSchema = z
  .object({
    reason: z.string().max(500).optional().nullable(),
  })
  .optional();

/**
 * POST /api/tasks/[id]/reject
 * Sends a waiting_approval task back to in_progress with an optional reason.
 */
export async function POST(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      department: { select: { id: true, kind: true, name: true } },
      assignee: { select: { id: true, name: true } },
    },
  });
  if (!task) return notFound("Task not found.");
  if (task.status !== "waiting_approval") {
    return badRequest("Only tasks awaiting approval can be rejected.");
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
  if (!ok) return forbidden("You can't act on this task.");

  let body: unknown = undefined;
  try {
    body = await request.json();
  } catch {
    /* body optional */
  }
  const parsed = rejectSchema.safeParse(body);
  const reason = parsed.success ? parsed.data?.reason ?? null : null;

  try {
    const updated = await prisma.task.update({
      where: { id },
      data: { status: "in_progress" },
    });

    await logActivity({
      projectId: task.projectId,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "task_rejected",
      message: reason
        ? `sent '${updated.title}' back for revisions — ${reason}`
        : `sent '${updated.title}' back for revisions.`,
      metadata: { taskId: updated.id, reason },
    });

    const recipients = new Set<string>();
    if (task.assigneeId) recipients.add(task.assigneeId);
    if (task.creatorId) recipients.add(task.creatorId);
    recipients.delete(guard.userId);
    for (const userId of recipients) {
      await notify({
        userId,
        type: "task_rejected",
        title: `${guard.userName} sent a task back`,
        body: reason ?? updated.title,
        link: `/projects/${updated.projectId}/tasks`,
        metadata: { taskId: updated.id, projectId: updated.projectId },
      });
    }

    return NextResponse.json({ ok: true, status: updated.status });
  } catch (err) {
    console.error("[tasks.reject]", err);
    return serverError("Failed to reject task.");
  }
}
