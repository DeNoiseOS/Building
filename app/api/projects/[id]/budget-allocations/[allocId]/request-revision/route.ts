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
import { isResolvedDepartmentHead } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { notifyMany } from "@/lib/notifications";
import { projectApproverUserIds } from "@/lib/project-budget";

interface RouteContext {
  params: Promise<{ id: string; allocId: string }>;
}

const bodySchema = z.object({
  requestedAmount: z.number().int().min(0).max(10_000_000_00),
  reason: z.string().min(1).max(2000),
});

/**
 * POST — department head counters with a different amount + reason.
 * Allocation moves to `revision_requested`; producer resolves it next.
 */
export async function POST(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, allocId } = await ctx.params;
  const allocation = await prisma.departmentBudget.findFirst({
    where: { id: allocId, projectId: id },
    include: { department: { select: { id: true, name: true, kind: true } } },
  });
  if (!allocation) return notFound("Allocation not found.");
  if (allocation.status !== "pending") {
    return badRequest("Only pending allocations can be revised.");
  }

  // V0.12.3 — owner OR resolved head of this dept.
  const isOwner = await prisma.project.findFirst({
    where: { id, userId: guard.userId },
    select: { id: true },
  });
  const isResolvedHead = await isResolvedDepartmentHead(
    { userId: guard.userId, projectId: id },
    allocation.department.kind
  );
  const isLeadInDept = await prisma.departmentMember.findFirst({
    where: { departmentId: allocation.departmentId, userId: guard.userId, role: "lead" },
    select: { id: true },
  });
  if (!isOwner && !isResolvedHead && !isLeadInDept) {
    return forbidden("Only the department head can request a revision.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid data.", parsed.error.flatten().fieldErrors);
  }

  try {
    await prisma.departmentBudget.update({
      where: { id: allocId },
      data: {
        status: "revision_requested",
        requestedAmount: parsed.data.requestedAmount,
        reason: parsed.data.reason.trim(),
      },
    });

    await prisma.comment.create({
      data: {
        projectId: id,
        authorId: guard.userId,
        targetType: "budget_allocation",
        targetId: allocId,
        body: parsed.data.reason.trim(),
      },
    });

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "budget_revision_requested",
      message: `requested a budget revision for ${allocation.department.name}.`,
      metadata: {
        allocationId: allocId,
        departmentId: allocation.departmentId,
        requestedAmount: parsed.data.requestedAmount,
        reason: parsed.data.reason,
      },
    });

    const approvers = await projectApproverUserIds(id);
    await notifyMany(approvers, {
      type: "budget_revision_requested",
      title: "Budget revision requested",
      body: `${allocation.department.name}: ${parsed.data.requestedAmount / 100}`,
      link: `/projects/${id}/budget`,
      metadata: {
        allocationId: allocId,
        projectId: id,
        departmentId: allocation.departmentId,
      },
      skipUserId: guard.userId,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[allocation.request-revision]", err);
    return serverError("Failed to request revision.");
  }
}
