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
import { userHasProjectAccess, userIsProjectOwner } from "@/lib/access";
import { logActivity } from "@/lib/activity";
import { notifyMany } from "@/lib/notifications";
import {
  projectedAllocationTotal,
  departmentHeadUserIds,
  getCallerDepartmentIds,
} from "@/lib/project-budget";
import { canViewProjectBudget } from "@/lib/permissions";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const upsertSchema = z.object({
  departmentId: z.string().min(1),
  allocatedAmount: z.number().int().min(0).max(10_000_000_00),
});

/** GET — same as /budget but returns just the allocations list. */
export async function GET(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const access = await userHasProjectAccess(guard.userId, id);
  if (!access) return notFound("Project not found.");

  // V0.6.2 — Department Heads only see their own department's allocation.
  const canViewProjectWide = await canViewProjectBudget({
    userId: guard.userId,
    projectId: id,
  });
  const where: Record<string, unknown> = { projectId: id };
  if (!canViewProjectWide) {
    const myDeptIds = await getCallerDepartmentIds(guard.userId, id);
    if (myDeptIds.length === 0) {
      return NextResponse.json({ allocations: [] });
    }
    where.departmentId = { in: myDeptIds };
  }

  const rows = await prisma.departmentBudget.findMany({
    where,
    include: {
      department: { select: { id: true, name: true, kind: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({
    allocations: rows.map((r) => ({
      id: r.id,
      departmentId: r.departmentId,
      department: r.department,
      allocatedAmount: r.allocatedAmount,
      requestedAmount: r.requestedAmount,
      approvedAmount: r.approvedAmount,
      status: r.status,
      reason: r.reason,
    })),
  });
}

/**
 * POST — producer/owner creates or updates a department allocation.
 * Resets status to "pending" so the dept head re-acknowledges. Server
 * blocks when sum-of-allocations would exceed Project.totalBudget.
 */
export async function POST(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const owner = await userIsProjectOwner(guard.userId, id);
  const producer = await prisma.projectMember.findFirst({
    where: { projectId: id, userId: guard.userId, role: "producer" },
    select: { id: true },
  });
  if (!owner && !producer) {
    return forbidden("Only producer / owner can set allocations.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid data.", parsed.error.flatten().fieldErrors);
  }

  const dept = await prisma.department.findFirst({
    where: { id: parsed.data.departmentId, projectId: id },
    select: { id: true, name: true },
  });
  if (!dept) return badRequest("Department not found on this project.");

  // Validation: sum cannot exceed totalBudget if set.
  const project = await prisma.project.findUnique({
    where: { id },
    select: { totalBudget: true, currency: true },
  });
  if (project?.totalBudget !== null && project?.totalBudget !== undefined) {
    const next = await projectedAllocationTotal(
      id,
      dept.id,
      parsed.data.allocatedAmount
    );
    if (next > project.totalBudget) {
      const over = next - project.totalBudget;
      return badRequest(
        `Over budget by ${over / 100}. Sum of allocations cannot exceed total budget.`,
        { allocatedAmount: ["Sum exceeds total budget."] }
      );
    }
  }

  try {
    const saved = await prisma.departmentBudget.upsert({
      where: { departmentId: dept.id },
      create: {
        projectId: id,
        departmentId: dept.id,
        allocatedAmount: parsed.data.allocatedAmount,
        status: "pending",
      },
      update: {
        allocatedAmount: parsed.data.allocatedAmount,
        // Re-pending forces the head to re-confirm.
        status: "pending",
        approvedAmount: null,
        requestedAmount: null,
        reason: null,
        approvedAt: null,
        rejectedAt: null,
      },
    });

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "budget_allocated",
      message: `allocated ${parsed.data.allocatedAmount / 100} ${project?.currency ?? ""} to ${dept.name}.`,
      metadata: {
        departmentId: dept.id,
        allocationId: saved.id,
        amount: saved.allocatedAmount,
      },
    });

    const heads = await departmentHeadUserIds(id, dept.id);
    await notifyMany(heads, {
      type: "budget_allocated",
      title: `Budget allocation received`,
      body: `${dept.name}: ${saved.allocatedAmount / 100} ${project?.currency ?? ""}`,
      link: `/projects/${id}/budget`,
      metadata: { allocationId: saved.id, projectId: id, departmentId: dept.id },
      skipUserId: guard.userId,
    });

    return NextResponse.json({ id: saved.id }, { status: 201 });
  } catch (err) {
    console.error("[budget-allocations.POST]", err);
    return serverError("Failed to save allocation.");
  }
}
