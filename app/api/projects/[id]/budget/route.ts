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
import {
  getProjectBudget,
  getDepartmentBudgetDashboard,
} from "@/lib/project-budget";
import { canViewProjectBudget } from "@/lib/permissions";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const patchSchema = z.object({
  totalBudget: z.number().int().min(0).max(10_000_000_00).nullable().optional(),
  currency: z.string().min(3).max(8).optional(),
});

/**
 * GET — V0.6.2 — returns a different payload based on the caller's role:
 *
 *   { scope: "project", summary, departments }    → Owner / Producer / Director
 *   { scope: "department", currency, departments } → Department Heads
 *
 * Enforced server-side so manual API calls cannot leak project-wide data
 * to non-project-wide roles.
 */
export async function GET(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const access = await userHasProjectAccess(guard.userId, id);
  if (!access) return notFound("Project not found.");

  try {
    const canViewProjectWide = await canViewProjectBudget({
      userId: guard.userId,
      projectId: id,
    });
    if (canViewProjectWide) {
      const budget = await getProjectBudget(id);
      return NextResponse.json({ scope: "project", ...budget });
    }
    const dept = await getDepartmentBudgetDashboard(guard.userId, id);
    return NextResponse.json({ scope: "department", ...dept });
  } catch (err) {
    console.error("[project.budget.GET]", err);
    return serverError("Failed to load budget.");
  }
}

/**
 * PATCH — producer/owner set the total budget pool and/or currency.
 * Server-side validation: the new totalBudget cannot be less than the
 * existing sum of departmental allocations.
 */
export async function PATCH(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const owner = await userIsProjectOwner(guard.userId, id);
  const member = await prisma.projectMember.findFirst({
    where: { projectId: id, userId: guard.userId, role: "producer" },
    select: { id: true },
  });
  if (!owner && !member) {
    return forbidden("Only producers / owner can edit the project budget.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid data.", parsed.error.flatten().fieldErrors);
  }

  // Validate sum-of-allocations vs new total budget.
  if (parsed.data.totalBudget !== undefined && parsed.data.totalBudget !== null) {
    const sumRow = await prisma.departmentBudget.aggregate({
      where: { projectId: id },
      _sum: { allocatedAmount: true },
    });
    const sum = sumRow._sum.allocatedAmount ?? 0;
    if (sum > parsed.data.totalBudget) {
      const over = sum - parsed.data.totalBudget;
      return badRequest(
        `Over budget by ${over / 100}. Lower allocations first.`,
        { totalBudget: ["Allocations exceed this total."] }
      );
    }
  }

  try {
    await prisma.project.update({
      where: { id },
      data: {
        ...(parsed.data.totalBudget !== undefined && {
          totalBudget: parsed.data.totalBudget,
        }),
        ...(parsed.data.currency !== undefined && {
          currency: parsed.data.currency.toUpperCase(),
        }),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[project.budget.PATCH]", err);
    return serverError("Failed to update project budget.");
  }
}
