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
import { userIsProjectOwner } from "@/lib/access";
import { logActivity } from "@/lib/activity";
import { notifyMany } from "@/lib/notifications";
import {
  departmentHeadUserIds,
  projectedAllocationTotal,
} from "@/lib/project-budget";

interface RouteContext {
  params: Promise<{ id: string; allocId: string }>;
}

const bodySchema = z.object({
  /** "approve_revision" = use requestedAmount; "keep_original" = use allocated. */
  decision: z.enum(["approve_revision", "keep_original"]),
  comment: z.string().max(2000).optional().nullable(),
});

/**
 * POST — producer / owner settles a revision-requested allocation. They
 * either approve the head's counter-amount or keep the original.
 */
export async function POST(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, allocId } = await ctx.params;
  const owner = await userIsProjectOwner(guard.userId, id);
  const producer = await prisma.projectMember.findFirst({
    where: { projectId: id, userId: guard.userId, role: "producer" },
    select: { id: true },
  });
  if (!owner && !producer) {
    return forbidden("Only producer / owner can resolve revisions.");
  }

  const allocation = await prisma.departmentBudget.findFirst({
    where: { id: allocId, projectId: id },
    include: { department: { select: { id: true, name: true, kind: true } } },
  });
  if (!allocation) return notFound("Allocation not found.");
  if (allocation.status !== "revision_requested") {
    return badRequest("Only revision-requested allocations can be resolved.");
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

  const decided =
    parsed.data.decision === "approve_revision"
      ? allocation.requestedAmount ?? allocation.allocatedAmount
      : allocation.allocatedAmount;

  // Budget pool re-validation when accepting an upward revision.
  if (parsed.data.decision === "approve_revision") {
    const project = await prisma.project.findUnique({
      where: { id },
      select: { totalBudget: true },
    });
    if (project?.totalBudget !== null && project?.totalBudget !== undefined) {
      const next = await projectedAllocationTotal(
        id,
        allocation.departmentId,
        decided
      );
      if (next > project.totalBudget) {
        const over = next - project.totalBudget;
        return badRequest(
          `Revision would exceed total budget by ${over / 100}.`,
          { decision: ["Sum of allocations exceeds total budget."] }
        );
      }
    }
  }

  try {
    const newAllocated =
      parsed.data.decision === "approve_revision" ? decided : allocation.allocatedAmount;
    await prisma.departmentBudget.update({
      where: { id: allocId },
      data: {
        status: "approved",
        allocatedAmount: newAllocated,
        approvedAmount: decided,
        approvedAt: new Date(),
        requestedAmount: null,
      },
    });

    if (parsed.data.comment && parsed.data.comment.trim()) {
      await prisma.comment.create({
        data: {
          projectId: id,
          authorId: guard.userId,
          targetType: "budget_allocation",
          targetId: allocId,
          body: parsed.data.comment.trim(),
        },
      });
    }

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "budget_allocation_accepted",
      message:
        parsed.data.decision === "approve_revision"
          ? `approved the revised allocation for ${allocation.department.name}.`
          : `kept the original allocation for ${allocation.department.name}.`,
      metadata: {
        allocationId: allocId,
        departmentId: allocation.departmentId,
        approvedAmount: decided,
        decision: parsed.data.decision,
      },
    });

    const heads = await departmentHeadUserIds(id, allocation.departmentId);
    await notifyMany(heads, {
      type: "budget_revision_resolved",
      title:
        parsed.data.decision === "approve_revision"
          ? "Revision approved"
          : "Original allocation kept",
      body: allocation.department.name,
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
    console.error("[allocation.resolve]", err);
    return serverError("Failed to resolve.");
  }
}
