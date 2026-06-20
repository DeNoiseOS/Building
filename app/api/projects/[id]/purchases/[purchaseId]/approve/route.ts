import { NextResponse } from "next/server";
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
import { notify } from "@/lib/notifications";

/**
 * V0.14 — Approve a pending Purchase.
 *
 * Only the resolved head of the purchase's department (or project owner)
 * can approve. On approval, if the category is a Resource type — or the
 * user opted-in via `saveAsResource` for the "other" category — an
 * Equipment row is created in the same transaction.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string; purchaseId: string }> }
) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, purchaseId } = await ctx.params;
  const existing = await prisma.purchase.findFirst({
    where: { id: purchaseId, projectId: id },
    include: {
      department: { select: { id: true, name: true, key: true, kind: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
  if (!existing) return notFound("Purchase not found.");
  if (existing.status !== "pending") {
    return badRequest("Only pending purchases can be approved.");
  }

  const cctx = await resolveCustodyContext(guard.userId, id);
  if (!cctx.isOwner && !canIssueCustody(cctx, existing.department.id)) {
    return forbidden(
      "Only the department head (or owner) can approve this purchase."
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      let equipmentId: string | null = existing.equipmentId;
      if (existing.saveAsResource && !equipmentId) {
        const reg = getDepartmentByKey(existing.department.key);
        const category = reg
          ? findCategory(
              existing.department.key,
              existing.type as "purchase" | "rental",
              existing.categoryKey
            )
          : null;
        const eq = await tx.equipment.create({
          data: {
            projectId: id,
            departmentId: existing.department.id,
            name: existing.name,
            category:
              existing.categoryKey === "other"
                ? existing.customCategory ?? null
                : category?.label ?? null,
            notes:
              existing.type === "rental"
                ? `Rental — returns ${existing.rentalEnd?.toISOString() ?? ""}`
                : null,
            status: "available",
          },
        });
        equipmentId = eq.id;
      }
      await tx.purchase.update({
        where: { id: purchaseId },
        data: {
          status: "approved",
          approvedByUserId: guard.userId,
          approvedAt: new Date(),
          rejectedAt: null,
          rejectionReason: null,
          ...(equipmentId !== existing.equipmentId && { equipmentId }),
        },
      });
    });

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "purchase_approved",
      message: `approved ${existing.type} '${existing.name}' for ${existing.department.name}.`,
      metadata: {
        purchaseId,
        departmentId: existing.department.id,
        amount: existing.amount,
      },
    });

    if (existing.createdBy.id !== guard.userId) {
      await notify({
        userId: existing.createdBy.id,
        type: "purchase_approved",
        title: `${guard.userName} approved your purchase`,
        body: `${existing.name} — ${existing.department.name}`,
        link: `/projects/${id}/budget`,
        metadata: {
          purchaseId,
          projectId: id,
          departmentId: existing.department.id,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[purchase.approve]", err);
    return serverError("Failed to approve purchase.");
  }
}
