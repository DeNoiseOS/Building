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
import { isHead } from "@/lib/hierarchy";
import { logActivity } from "@/lib/activity";
import { notifyMany } from "@/lib/notifications";
import { projectApproverUserIds } from "@/lib/project-budget";

interface RouteContext {
  params: Promise<{ id: string; allocId: string }>;
}

const bodySchema = z.object({
  reason: z.string().min(1).max(2000),
});

/** POST — department head rejects the allocation. Reason required. */
export async function POST(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, allocId } = await ctx.params;
  const allocation = await prisma.departmentBudget.findFirst({
    where: { id: allocId, projectId: id },
    include: { department: { select: { id: true, name: true, kind: true } } },
  });
  if (!allocation) return notFound("Allocation not found.");
  if (allocation.status !== "pending" && allocation.status !== "revision_requested") {
    return badRequest("This allocation can no longer be rejected.");
  }

  const member = await prisma.projectMember.findFirst({
    where: { projectId: id, userId: guard.userId },
    select: { role: true },
  });
  const isOwner = await prisma.project.findFirst({
    where: { id, userId: guard.userId },
    select: { id: true },
  });
  const isLeadInDept = await prisma.departmentMember.findFirst({
    where: { departmentId: allocation.departmentId, userId: guard.userId, role: "lead" },
    select: { id: true },
  });
  const isMatchingHead =
    !!member && isHead(member.role) && member.role === allocation.department.kind;
  if (!isOwner && !isLeadInDept && !isMatchingHead) {
    return forbidden("Only the department head can reject this allocation.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("A reason is required.", parsed.error.flatten().fieldErrors);
  }

  try {
    await prisma.departmentBudget.update({
      where: { id: allocId },
      data: {
        status: "rejected",
        rejectedAt: new Date(),
        reason: parsed.data.reason.trim(),
        approvedAmount: null,
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
      type: "budget_allocation_rejected",
      message: `rejected ${allocation.department.name}'s budget allocation.`,
      metadata: {
        allocationId: allocId,
        departmentId: allocation.departmentId,
        reason: parsed.data.reason,
      },
    });

    const approvers = await projectApproverUserIds(id);
    await notifyMany(approvers, {
      type: "budget_allocation_rejected",
      title: "Allocation rejected",
      body: `${allocation.department.name}: ${parsed.data.reason}`,
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
    console.error("[allocation.reject]", err);
    return serverError("Failed to reject allocation.");
  }
}
