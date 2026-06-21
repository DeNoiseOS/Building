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
import { resolveCustodyContext, canIssueCustody } from "@/lib/custody-data";
import {
  findCategory,
  getDepartmentByKey,
} from "@/lib/department-registry";
import { logActivity } from "@/lib/activity";

interface RouteContext {
  params: Promise<{ id: string; purchaseId: string }>;
}

// V0.14.4 — Editable fields. Some are head-only at any time, some are
// creator-editable while the purchase is still pending.
const patchSchema = z.object({
  paymentStatus: z.enum(["paid", "unpaid"]).optional(),
  receiptUrl: z.string().url().max(800).nullable().optional(),
  vendor: z.string().max(200).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  // V0.14.4 — creator-editable while pending.
  name: z.string().min(1).max(200).optional(),
  amount: z.number().int().min(0).max(10_000_000_00).optional(),
  quantity: z.number().int().min(1).max(100_000).optional(),
  categoryKey: z.string().min(1).max(60).optional(),
  customCategory: z.string().max(120).nullable().optional(),
});

/**
 * PATCH — edit a purchase.
 *
 * V0.14.4 — Two editor roles:
 *   - Creator (while status=pending): can edit any of name, amount,
 *     quantity, vendor, description, categoryKey, customCategory,
 *     receiptUrl. They cannot change paymentStatus.
 *   - Resolved dept head / owner (any time): can edit paymentStatus,
 *     receiptUrl, vendor, description on approved purchases too.
 *
 * Approved AND rejected purchases are immutable apart from the head's
 * limited fields above — quantity/amount/name/category can never be
 * edited after approval. Rejected purchases are fully read-only.
 */
export async function PATCH(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, purchaseId } = await ctx.params;
  const existing = await prisma.purchase.findFirst({
    where: { id: purchaseId, projectId: id },
    include: {
      department: { select: { id: true, key: true, kind: true } },
    },
  });
  if (!existing) return notFound("Purchase not found.");

  const cctx = await resolveCustodyContext(guard.userId, id);
  const isHead =
    cctx.isOwner || canIssueCustody(cctx, existing.department.id);
  const isCreator = existing.createdByUserId === guard.userId;

  if (!isHead && !isCreator) {
    return forbidden("Only the creator or department head can update this purchase.");
  }

  if (existing.status === "rejected") {
    return badRequest("Rejected purchases are read-only.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid update.", parsed.error.flatten().fieldErrors);
  }

  // V0.14.4 — Decide which fields the caller is allowed to touch in
  // this state.
  const headFields = new Set([
    "paymentStatus",
    "receiptUrl",
    "vendor",
    "description",
  ]);
  const creatorPendingFields = new Set([
    "name",
    "amount",
    "quantity",
    "vendor",
    "description",
    "categoryKey",
    "customCategory",
    "receiptUrl",
  ]);

  const incoming = parsed.data;
  const requestedFields = Object.entries(incoming)
    .filter(([, v]) => v !== undefined)
    .map(([k]) => k);
  for (const field of requestedFields) {
    const allowed = isHead
      ? // Head can always touch their head-side fields. They can also
        // edit creator-pending fields, but only while pending.
        headFields.has(field) ||
        (existing.status === "pending" && creatorPendingFields.has(field))
      : // Creator: only pending + only the creator-pending field set.
        existing.status === "pending" && creatorPendingFields.has(field);
    if (!allowed) {
      return forbidden(
        `Field '${field}' isn't editable in this state.`
      );
    }
  }

  // V0.14.4 — If the creator is changing the category, re-validate it
  // against the registry to keep category integrity.
  if (incoming.categoryKey && incoming.categoryKey !== existing.categoryKey) {
    const reg = getDepartmentByKey(existing.department.key);
    const cat = reg
      ? findCategory(
          existing.department.key,
          existing.type as "purchase" | "rental",
          incoming.categoryKey
        )
      : null;
    if (!cat) {
      return badRequest("Unknown category for this department + type.");
    }
    if (incoming.categoryKey === "other") {
      const customName = incoming.customCategory ?? existing.customCategory;
      if (!customName || customName.trim().length === 0) {
        return badRequest("Custom category name required for 'Other'.");
      }
    }
  }

  try {
    await prisma.purchase.update({
      where: { id: purchaseId },
      data: {
        ...(incoming.paymentStatus !== undefined && {
          paymentStatus: incoming.paymentStatus,
        }),
        ...(incoming.receiptUrl !== undefined && {
          receiptUrl: incoming.receiptUrl,
        }),
        ...(incoming.vendor !== undefined && { vendor: incoming.vendor }),
        ...(incoming.description !== undefined && {
          description: incoming.description,
        }),
        ...(incoming.name !== undefined && { name: incoming.name }),
        ...(incoming.amount !== undefined && { amount: incoming.amount }),
        ...(incoming.quantity !== undefined && { quantity: incoming.quantity }),
        ...(incoming.categoryKey !== undefined && {
          categoryKey: incoming.categoryKey,
        }),
        ...(incoming.customCategory !== undefined && {
          customCategory: incoming.customCategory,
        }),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[purchase.PATCH]", err);
    return serverError("Failed to update purchase.");
  }
}

/** DELETE — head of the purchase's dept (or owner). */
export async function DELETE(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, purchaseId } = await ctx.params;
  const existing = await prisma.purchase.findFirst({
    where: { id: purchaseId, projectId: id },
    include: { department: { select: { id: true, name: true } } },
  });
  if (!existing) return notFound("Purchase not found.");

  const cctx = await resolveCustodyContext(guard.userId, id);
  if (!cctx.isOwner && !canIssueCustody(cctx, existing.department.id)) {
    return forbidden(
      "Only the department head (or owner) can delete this purchase."
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      // If an Equipment row was auto-created, drop it too — the asset
      // existed only because of this Purchase.
      if (existing.equipmentId) {
        await tx.equipment.delete({ where: { id: existing.equipmentId } });
      }
      await tx.purchase.delete({ where: { id: purchaseId } });
    });

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "purchase_deleted",
      message: `deleted purchase '${existing.name}' from ${existing.department.name}.`,
      metadata: { purchaseId, departmentId: existing.department.id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[purchase.DELETE]", err);
    return serverError("Failed to delete purchase.");
  }
}
