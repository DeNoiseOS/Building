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
import { userHasProjectAccess } from "@/lib/access";
import {
  resolveBudgetContext,
  budgetVisibilityFilter,
  canCreateBudget,
  canApproveDepartmentExpense,
} from "@/lib/budget-data";
import { logActivity } from "@/lib/activity";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const createSchema = z.object({
  departmentId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  vendor: z.string().max(200).optional().nullable(),
  estimatedCost: z.number().int().min(0).max(1_000_000_00), // cents, capped
  needByDate: z.string().datetime().optional().nullable(),
  /**
   * V0.6.3 — Department heads can flip an expense straight to "purchased"
   * because the department already owns its approved budget. Honored only
   * for heads of the request's department; ignored otherwise.
   */
  directPurchase: z.boolean().optional(),
  /** V0.9 — optional link to a Custody (cash advance). */
  custodyId: z.string().optional().nullable(),
});

/** GET — list budget requests visible to the caller (with filters). */
export async function GET(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const access = await userHasProjectAccess(guard.userId, id);
  if (!access) return notFound("Project not found.");

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status");
  const departmentFilter = url.searchParams.get("department");
  const requesterFilter = url.searchParams.get("requester");

  try {
    const bctx = await resolveBudgetContext(guard.userId, id);
    const where: Record<string, unknown> = {
      projectId: id,
      ...budgetVisibilityFilter(bctx),
    };
    if (statusFilter) where.status = statusFilter;
    if (departmentFilter) where.departmentId = departmentFilter;
    if (requesterFilter) where.requesterId = requesterFilter;

    const rows = await prisma.budgetRequest.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        department: { select: { id: true, name: true, kind: true } },
        requester: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      requests: rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        vendor: r.vendor,
        estimatedCost: r.estimatedCost,
        needByDate: r.needByDate?.toISOString() ?? null,
        status: r.status,
        department: r.department,
        requester: r.requester,
        submittedAt: r.submittedAt?.toISOString() ?? null,
        approvedAt: r.approvedAt?.toISOString() ?? null,
        rejectedAt: r.rejectedAt?.toISOString() ?? null,
        purchasedAt: r.purchasedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[budget-requests.GET]", err);
    return serverError("Failed to load budget requests.");
  }
}

/** POST — create a new request (defaults to draft). */
export async function POST(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const access = await userHasProjectAccess(guard.userId, id);
  if (!access) return notFound("Project not found.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request data.", parsed.error.flatten().fieldErrors);
  }

  // Department must exist on this project.
  const dept = await prisma.department.findFirst({
    where: { id: parsed.data.departmentId, projectId: id },
    select: { id: true, name: true, kind: true },
  });
  if (!dept) return badRequest("Department not found on this project.");

  const bctx = await resolveBudgetContext(guard.userId, id);
  if (!canCreateBudget(bctx, dept.id)) {
    return forbidden("You can't create an expense for this department.");
  }

  // V0.6.3 — Department head shortcut: record purchase directly.
  // Honored only when the caller is the head of *this* department.
  const isHeadOfThisDept = canApproveDepartmentExpense(bctx, {
    departmentId: dept.id,
    departmentKind: dept.kind,
  });
  const directPurchase = !!parsed.data.directPurchase && isHeadOfThisDept;
  const now = new Date();

  // V0.9 — Validate optional custody link. The custody must be active and
  // belong to the same project+department.
  let custodyId: string | null = null;
  if (parsed.data.custodyId) {
    const cust = await prisma.custody.findFirst({
      where: {
        id: parsed.data.custodyId,
        projectId: id,
        departmentId: dept.id,
        status: "active",
      },
      select: { id: true, amount: true },
    });
    if (cust) custodyId = cust.id;
  }

  try {
    const created = await prisma.budgetRequest.create({
      data: {
        projectId: id,
        departmentId: dept.id,
        requesterId: guard.userId,
        title: parsed.data.title.trim(),
        description: parsed.data.description ?? null,
        vendor: parsed.data.vendor ?? null,
        estimatedCost: parsed.data.estimatedCost,
        needByDate: parsed.data.needByDate
          ? new Date(parsed.data.needByDate)
          : null,
        status: directPurchase ? "purchased" : "draft",
        submittedAt: directPurchase ? now : null,
        approvedAt: directPurchase ? now : null,
        purchasedAt: directPurchase ? now : null,
        custodyId,
      },
    });

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: directPurchase ? "purchase_completed" : "purchase_request_created",
      message: directPurchase
        ? `recorded a department expense '${created.title}'.`
        : `drafted an expense '${created.title}'.`,
      metadata: {
        purchaseRequestId: created.id,
        departmentId: dept.id,
        estimatedCost: created.estimatedCost,
        directPurchase,
      },
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err) {
    console.error("[budget-requests.POST]", err);
    return serverError("Failed to create budget request.");
  }
}
