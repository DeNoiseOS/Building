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
import { logActivity } from "@/lib/activity";

interface RouteContext {
  params: Promise<{ id: string; purchaseId: string }>;
}

const patchSchema = z.object({
  paymentStatus: z.enum(["paid", "unpaid"]).optional(),
  receiptUrl: z.string().url().max(800).nullable().optional(),
  vendor: z.string().max(200).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
});

/** PATCH — head of the purchase's dept (or owner) can update small fields. */
export async function PATCH(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, purchaseId } = await ctx.params;
  const existing = await prisma.purchase.findFirst({
    where: { id: purchaseId, projectId: id },
    include: { department: { select: { id: true, kind: true } } },
  });
  if (!existing) return notFound("Purchase not found.");

  const cctx = await resolveCustodyContext(guard.userId, id);
  if (!cctx.isOwner && !canIssueCustody(cctx, existing.department.id)) {
    return forbidden(
      "Only the department head (or owner) can update this purchase."
    );
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

  try {
    await prisma.purchase.update({
      where: { id: purchaseId },
      data: {
        ...(parsed.data.paymentStatus !== undefined && {
          paymentStatus: parsed.data.paymentStatus,
        }),
        ...(parsed.data.receiptUrl !== undefined && {
          receiptUrl: parsed.data.receiptUrl,
        }),
        ...(parsed.data.vendor !== undefined && { vendor: parsed.data.vendor }),
        ...(parsed.data.description !== undefined && {
          description: parsed.data.description,
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
