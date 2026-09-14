import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, badRequest, serverError } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { getTasksForUser } from "@/lib/queries/tasks";
import { projectAccessFilter } from "@/lib/access";
import { notify } from "@/lib/notifications";
import {
  TASK_STATUS,
  TASK_PRIORITY,
  type TaskStatus,
  type TaskPriority,
} from "@/lib/roles";
import { getDepartmentForRole } from "@/lib/department-registry";
import { log } from "@/lib/logger";

const STATUS_VALUES = TASK_STATUS.map((s) => s.value) as [TaskStatus, ...TaskStatus[]];
const PRIORITY_VALUES = TASK_PRIORITY.map((p) => p.value) as [
  TaskPriority,
  ...TaskPriority[],
];

const createSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1, "Title is required.").max(300),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(STATUS_VALUES).optional(),
  priority: z.enum(PRIORITY_VALUES).optional(),
  section: z.string().max(100).optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  /** V1.0A/V0.5: owner department (renamed conceptually in V0.5). */
  departmentId: z.string().optional().nullable(),
  /** V0.5: optional explicit approver. Falls back to dept head/director. */
  approverId: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") ?? undefined;
  const section = url.searchParams.get("section") ?? undefined;
  const status = url.searchParams
    .getAll("status")
    .flatMap((v) => v.split(","))
    .filter((s) => STATUS_VALUES.includes(s as TaskStatus));
  const mineOnly = url.searchParams.get("mine") === "1";

  const tasks = await getTasksForUser(guard.userId, {
    projectId,
    section,
    status: status.length > 0 ? status : undefined,
    mineOnly,
  });

  return NextResponse.json({ tasks });
}

export async function POST(request: Request) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid task data.", parsed.error.flatten().fieldErrors);
  }

  // Verify the project is accessible (owner or member can create tasks).
  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, ...projectAccessFilter(guard.userId) },
    select: { id: true, name: true },
  });
  if (!project) {
    return badRequest("Project not found or not yours.");
  }

  // V0.14.5 (bug #C-1, 2026-09-14) — Assignee is now MANDATORY. Every
  // task belongs to someone. A task with no assignee was ending up with
  // no departmentId, which the list view then rendered in "All
  // Departments" for the whole project — leaking every task to every
  // member. If the caller genuinely wants a solo reminder, they should
  // assign it to themselves.
  if (!parsed.data.assigneeId) {
    return badRequest("Assignee is required.", {
      assigneeId: ["Pick someone to own this task."],
    });
  }

  const assignee = await prisma.user.findUnique({
    where: { id: parsed.data.assigneeId },
    select: { id: true },
  });
  if (!assignee) {
    return badRequest("Assignee not found.");
  }

  const status = parsed.data.status ?? "todo";

  try {
    // V0.14.5 (bug #C-1) — Auto-derive departmentId from the assignee.
    // Resolution order:
    //   1. Client-supplied departmentId, if it exists on this project.
    //   2. The assignee's DepartmentMember row on this project.
    //   3. Fallback: the department their ProjectMember.role maps to
    //      (via getDepartmentForRole — the role registry).
    //
    // If none of the three resolve, the assignee is a project-wide role
    // (Producer / Director / 1st AD / EP) and the CLIENT must have
    // supplied a departmentId. We fail closed here instead of falling
    // back to null, so the "shows to everyone" leak can't recur.
    let departmentId: string | null = null;
    if (parsed.data.departmentId) {
      const dept = await prisma.department.findFirst({
        where: { id: parsed.data.departmentId, projectId: project.id },
        select: { id: true },
      });
      if (dept) departmentId = dept.id;
    }
    if (!departmentId) {
      const deptMember = await prisma.departmentMember.findFirst({
        where: {
          userId: parsed.data.assigneeId,
          department: { projectId: project.id },
        },
        select: { departmentId: true },
      });
      if (deptMember) departmentId = deptMember.departmentId;
    }
    if (!departmentId) {
      const projMember = await prisma.projectMember.findFirst({
        where: { userId: parsed.data.assigneeId, projectId: project.id },
        select: { role: true },
      });
      const registryDept = projMember?.role
        ? getDepartmentForRole(projMember.role)
        : null;
      if (registryDept) {
        const dept = await prisma.department.findFirst({
          where: { projectId: project.id, key: registryDept.key },
          select: { id: true },
        });
        if (dept) departmentId = dept.id;
      }
    }
    if (!departmentId) {
      return badRequest(
        "This assignee isn't tied to a department. Pick a department yourself.",
        { departmentId: ["Required for a project-wide role."] },
      );
    }

    const task = await prisma.task.create({
      data: {
        projectId: parsed.data.projectId,
        departmentId,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        status,
        priority: parsed.data.priority ?? "medium",
        section: parsed.data.section ?? null,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        assigneeId: parsed.data.assigneeId ?? null,
        // V0.5: creator + approver tracking
        creatorId: guard.userId,
        approverId: parsed.data.approverId ?? null,
        completedAt: status === "done" ? new Date() : null,
      },
      include: {
        project: { select: { id: true, name: true, role: true } },
        assignee: { select: { id: true, name: true } },
      },
    });

    await logActivity({
      projectId: project.id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "task_created",
      message: `added task '${task.title}'.`,
      metadata: { taskId: task.id, section: task.section },
    });

    if (status === "done") {
      await logActivity({
        projectId: project.id,
        actorId: guard.userId,
        actorName: guard.userName,
        type: "task_completed",
        message: `completed '${task.title}'.`,
        metadata: { taskId: task.id },
      });
    }

    // V0.5: notify the assignee on initial assignment.
    if (task.assigneeId && task.assigneeId !== guard.userId) {
      await logActivity({
        projectId: project.id,
        actorId: guard.userId,
        actorName: guard.userName,
        type: "task_assigned",
        message: `assigned '${task.title}' to ${task.assignee?.name ?? "someone"}.`,
        metadata: { taskId: task.id, assigneeId: task.assigneeId },
      });
      await notify({
        userId: task.assigneeId,
        type: "task_assigned",
        title: `${guard.userName} assigned you a task`,
        body: task.title,
        link: `/projects/${task.projectId}/tasks`,
        metadata: { taskId: task.id, projectId: task.projectId },
      });
    }

    return NextResponse.json(
      {
        id: task.id,
        projectId: task.projectId,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        section: task.section,
        dueDate: task.dueDate?.toISOString() ?? null,
        completedAt: task.completedAt?.toISOString() ?? null,
        assigneeId: task.assigneeId,
        assignee: task.assignee,
        project: task.project,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (err) {
    log.error("[tasks.POST]", err instanceof Error ? err : { err: String(err) });
    return serverError("Failed to create task.");
  }
}
