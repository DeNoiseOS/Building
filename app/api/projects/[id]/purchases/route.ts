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
import { resolveCustodyContext, canIssueCustody } from "@/lib/custody-data";
import {
  findCategory,
  getDepartmentByKey,
  getDepartmentForRole,
} from "@/lib/department-registry";
import { notify } from "@/lib/notifications";
import { logActivity } from "@/lib/activity";

/**
 * V0.13 — Purchases & Rentals API.
 *
 * Permission model mirrors custody issuance:
 *   - Owner — any dept
 *   - Resolved dept head — only their own dept
 *
 * On create:
 *   - If the chosen category has `isResource=true`, OR the user picked
 *     "other" and explicitly toggled `saveAsResource`, we create an
 *     Equipment row in the same transaction and link it via
 *     Purchase.equipmentId so the asset appears in the dept's
 *     Resources tab.
 */

interface RouteContext {
  params: Promise<{ id: string }>;
}

const createSchema = z
  .object({
    departmentId: z.string().min(1),
    type: z.enum(["purchase", "rental"]),
    categoryKey: z.string().min(1).max(60),
    customCategory: z.string().max(120).optional().nullable(),
    saveAsResource: z.boolean().optional().default(false),
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional().nullable(),
    quantity: z.number().int().min(1).max(100_000).optional(),
    amount: z.number().int().min(0).max(10_000_000_00),
    vendor: z.string().max(200).optional().nullable(),
    assigneeId: z.string().optional().nullable(),
    purchaseDate: z.string().datetime().optional().nullable(),
    rentalStart: z.string().datetime().optional().nullable(),
    rentalEnd: z.string().datetime().optional().nullable(),
    receiptUrl: z.string().url().max(800).optional().nullable(),
    paymentStatus: z.enum(["paid", "unpaid"]).optional().default("unpaid"),
  })
  .refine(
    (d) => {
      if (d.type === "rental") return !!d.rentalStart && !!d.rentalEnd;
      if (d.type === "purchase") return !!d.purchaseDate;
      return true;
    },
    {
      message:
        "Purchase needs purchaseDate; rental needs rentalStart and rentalEnd.",
      path: ["type"],
    }
  )
  .refine(
    (d) => {
      if (d.type === "rental" && d.rentalStart && d.rentalEnd) {
        return new Date(d.rentalEnd) >= new Date(d.rentalStart);
      }
      return true;
    },
    {
      message: "Rental end date must be on or after the start date.",
      path: ["rentalEnd"],
    }
  )
  .refine(
    (d) => {
      // When category is "other", customCategory must be provided.
      if (d.categoryKey === "other") {
        return !!d.customCategory && d.customCategory.trim().length > 0;
      }
      return true;
    },
    {
      message: "Name your custom category.",
      path: ["customCategory"],
    }
  );

/** GET — list purchases on this project (filterable by department + type). */
export async function GET(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  const access = await userHasProjectAccess(guard.userId, id);
  if (!access) return notFound("Project not found.");

  const sp = new URL(request.url).searchParams;
  const where: Record<string, unknown> = { projectId: id };
  if (sp.get("department")) where.departmentId = sp.get("department");
  if (sp.get("type")) where.type = sp.get("type");
  if (sp.get("paymentStatus")) where.paymentStatus = sp.get("paymentStatus");
  // V0.14.1 — head can filter by submitter.
  if (sp.get("createdBy")) where.createdByUserId = sp.get("createdBy");

  const rows = await prisma.purchase.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      department: { select: { id: true, name: true, kind: true } },
      assignee: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  type PurchaseStatus = "pending" | "approved" | "rejected";
  type PaymentStatus = "paid" | "unpaid";

  return NextResponse.json({
    purchases: rows.map((p) => ({
      id: p.id,
      type: p.type,
      categoryKey: p.categoryKey,
      customCategory: p.customCategory,
      saveAsResource: p.saveAsResource,
      equipmentId: p.equipmentId,
      name: p.name,
      description: p.description,
      quantity: p.quantity,
      amount: p.amount,
      vendor: p.vendor,
      purchaseDate: p.purchaseDate?.toISOString() ?? null,
      rentalStart: p.rentalStart?.toISOString() ?? null,
      rentalEnd: p.rentalEnd?.toISOString() ?? null,
      receiptUrl: p.receiptUrl,
      custodyId: p.custodyId,
      paymentStatus: p.paymentStatus as PaymentStatus,
      status: p.status as PurchaseStatus,
      approvedAt: p.approvedAt?.toISOString() ?? null,
      rejectedAt: p.rejectedAt?.toISOString() ?? null,
      rejectionReason: p.rejectionReason,
      department: p.department,
      assignee: p.assignee,
      createdBy: p.createdBy,
      createdAt: p.createdAt.toISOString(),
    })),
  });
}

/** POST — head-of-dept (or owner) creates a Purchase. */
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
    return badRequest("Invalid purchase.", parsed.error.flatten().fieldErrors);
  }

  // Verify the department belongs to this project.
  const dept = await prisma.department.findFirst({
    where: { id: parsed.data.departmentId, projectId: id },
    select: { id: true, key: true, name: true, kind: true },
  });
  if (!dept) return badRequest("Department not found on this project.");

  // V0.14 — Permission widened: any project member can SUBMIT a
  // purchase for a department they belong to. Heads auto-approve;
  // members create as `pending` and need approval.
  const cctx = await resolveCustodyContext(guard.userId, id);
  const isHead = cctx.isOwner || canIssueCustody(cctx, dept.id);

  // Non-heads must belong to the department (member by role mapping
  // OR explicit DepartmentMember row).
  if (!isHead) {
    const callerRole = cctx.memberRole;
    const callerDept = callerRole ? getDepartmentForRole(callerRole) : null;
    const belongsByRole =
      !!callerDept &&
      (await prisma.department.findFirst({
        where: { id: dept.id, key: callerDept.key },
        select: { id: true },
      }));
    const belongsByMembership = await prisma.departmentMember.findFirst({
      where: { departmentId: dept.id, userId: guard.userId },
      select: { id: true },
    });
    if (!belongsByRole && !belongsByMembership) {
      return forbidden(
        "You can only record purchases for a department you belong to."
      );
    }
  }

  const initialStatus: "approved" | "pending" = isHead ? "approved" : "pending";

  // V0.14.1 — Resolve custody link for member submissions. A member
  // must have an active custody for this department; the purchase
  // deducts from it. Heads recording directly can skip the link
  // (purchase deducts from the dept budget pool instead).
  let custodyIdForPurchase: string | null = null;
  if (!isHead) {
    const openCustody = await prisma.custody.findFirst({
      where: {
        projectId: id,
        departmentId: dept.id,
        holderUserId: guard.userId,
        status: "active",
      },
      orderBy: { issuedAt: "desc" },
      select: { id: true },
    });
    if (!openCustody) {
      return badRequest(
        "You need an active custody for this department before recording a purchase. Ask your department head to issue one."
      );
    }
    custodyIdForPurchase = openCustody.id;
  }

  // V0.14.1 — Members can only assign the purchase to themselves.
  const assigneeIdForPurchase = isHead
    ? parsed.data.assigneeId ?? null
    : guard.userId;

  // Validate the category against the registry — defence in depth.
  const reg = getDepartmentByKey(dept.key);
  if (!reg) return badRequest("Department key is not in the registry.");
  const category = findCategory(dept.key, parsed.data.type, parsed.data.categoryKey);
  if (!category) {
    return badRequest("Unknown category for this department + type.");
  }

  // Resolve whether to auto-create an Equipment row.
  const willCreateResource =
    parsed.data.categoryKey === "other"
      ? !!parsed.data.saveAsResource
      : category.isResource;

  try {
    // V0.14 — Equipment row only auto-created when the purchase is
    // immediately approved (head creating it). For pending purchases,
    // the Equipment is created later on approval.
    const result = await prisma.$transaction(async (tx) => {
      let equipmentId: string | null = null;
      if (willCreateResource && initialStatus === "approved") {
        const eq = await tx.equipment.create({
          data: {
            projectId: id,
            departmentId: dept.id,
            name: parsed.data.name,
            category:
              parsed.data.categoryKey === "other"
                ? parsed.data.customCategory ?? null
                : category.label,
            notes:
              parsed.data.type === "rental"
                ? `Rental — returns ${parsed.data.rentalEnd ?? ""}`
                : null,
            status: "available",
          },
        });
        equipmentId = eq.id;
      }

      const purchase = await tx.purchase.create({
        data: {
          projectId: id,
          departmentId: dept.id,
          type: parsed.data.type,
          categoryKey: parsed.data.categoryKey,
          customCategory: parsed.data.customCategory ?? null,
          saveAsResource: willCreateResource,
          equipmentId,
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          quantity: parsed.data.quantity ?? 1,
          amount: parsed.data.amount,
          vendor: parsed.data.vendor ?? null,
          assigneeId: assigneeIdForPurchase,
          custodyId: custodyIdForPurchase,
          purchaseDate: parsed.data.purchaseDate
            ? new Date(parsed.data.purchaseDate)
            : null,
          rentalStart: parsed.data.rentalStart
            ? new Date(parsed.data.rentalStart)
            : null,
          rentalEnd: parsed.data.rentalEnd
            ? new Date(parsed.data.rentalEnd)
            : null,
          receiptUrl: parsed.data.receiptUrl ?? null,
          paymentStatus: parsed.data.paymentStatus ?? "unpaid",
          status: initialStatus,
          approvedByUserId:
            initialStatus === "approved" ? guard.userId : null,
          approvedAt: initialStatus === "approved" ? new Date() : null,
          createdByUserId: guard.userId,
        },
      });
      return purchase;
    });

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "purchase_recorded",
      message:
        initialStatus === "pending"
          ? `submitted ${parsed.data.type} '${parsed.data.name}' for ${dept.name} (awaiting approval).`
          : `recorded ${parsed.data.type} '${parsed.data.name}' for ${dept.name}.`,
      metadata: {
        purchaseId: result.id,
        departmentId: dept.id,
        amount: parsed.data.amount,
        type: parsed.data.type,
        category: parsed.data.categoryKey,
        status: initialStatus,
      },
    });

    // V0.14 — notify the dept head when a member submits a pending
    // purchase. We pick the resolved head's userId (the first project
    // member whose role appears in this dept's headRoles priority).
    if (initialStatus === "pending") {
      const reg = getDepartmentByKey(dept.key);
      if (reg) {
        const presentHeads = await prisma.projectMember.findMany({
          where: { projectId: id, role: { in: reg.headRoles } },
          select: { userId: true, role: true },
        });
        const orderedHead = reg.headRoles
          .map((r) => presentHeads.find((m) => m.role === r))
          .find((m) => !!m);
        if (orderedHead && orderedHead.userId !== guard.userId) {
          await notify({
            userId: orderedHead.userId,
            type: "purchase_recorded",
            title: `${guard.userName} submitted a purchase for approval`,
            body: `${parsed.data.name} — ${dept.name}`,
            link: `/projects/${id}/budget`,
            metadata: {
              purchaseId: result.id,
              projectId: id,
              departmentId: dept.id,
            },
          });
        }
      }
    }

    return NextResponse.json({ id: result.id }, { status: 201 });
  } catch (err) {
    console.error("[purchases.POST]", err);
    return serverError("Failed to record purchase.");
  }
}
