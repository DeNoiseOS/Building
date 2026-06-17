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

const bodySchema = z
  .object({ comment: z.string().max(2000).optional().nullable() })
  .optional();

/** POST — department head accepts the allocation as-is. */
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
    return badRequest("Only pending allocations can be accepted.");
  }

  // V0.12.3 — caller must be owner OR the resolved head of this
  // department (per V0.11 priority list — e.g., Production Designer
  // takes precedence over Art Director when both are present).
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
    return forbidden("Only the department head can accept this allocation.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = undefined;
  }
  const parsed = bodySchema.safeParse(body);
  const comment = parsed.success ? parsed.data?.comment ?? null : null;

  try {
    const updated = await prisma.departmentBudget.update({
      where: { id: allocId },
      data: {
        status: "approved",
        approvedAmount: allocation.allocatedAmount,
        approvedAt: new Date(),
        reason: null,
      },
    });

    if (comment && comment.trim()) {
      await prisma.comment.create({
        data: {
          projectId: id,
          authorId: guard.userId,
          targetType: "budget_allocation",
          targetId: allocId,
          body: comment.trim(),
        },
      });
    }

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "budget_allocation_accepted",
      message: `accepted ${allocation.department.name}'s budget allocation.`,
      metadata: {
        allocationId: allocId,
        departmentId: allocation.departmentId,
        amount: updated.approvedAmount,
      },
    });

    const approvers = await projectApproverUserIds(id);
    await notifyMany(approvers, {
      type: "budget_allocation_accepted",
      title: "Allocation accepted",
      body: `${allocation.department.name}`,
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
    console.error("[allocation.accept]", err);
    return serverError("Failed to accept allocation.");
  }
}
