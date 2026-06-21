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
import {
  resolveCustodyContext,
  canIssueCustody,
} from "@/lib/custody-data";
import { logActivity } from "@/lib/activity";

interface RouteContext {
  params: Promise<{ id: string; cid: string }>;
}

const patchSchema = z.object({
  notes: z.string().max(2000).optional().nullable(),
});

/**
 * PATCH — edit notes.
 *
 * V0.14.4 — Holder can edit their own custody's notes too (in addition
 * to issuer / owner / resolved dept head). Editing is only allowed
 * while the custody is `active`; once settled or cancelled, notes
 * become read-only.
 */
export async function PATCH(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, cid } = await ctx.params;
  const existing = await prisma.custody.findFirst({
    where: { id: cid, projectId: id },
  });
  if (!existing) return notFound("Custody not found.");

  if (existing.status !== "active") {
    return badRequest(
      "This custody is no longer active — notes can't be edited."
    );
  }

  const cctx = await resolveCustodyContext(guard.userId, id);
  const isHolder = existing.holderUserId === guard.userId;
  const isIssuer = existing.issuedByUserId === guard.userId;
  const isHead = canIssueCustody(cctx, existing.departmentId);
  if (!cctx.isOwner && !isHolder && !isIssuer && !isHead) {
    return forbidden("Only the holder, issuer, dept head, or owner can edit this custody.");
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

  try {
    await prisma.custody.update({
      where: { id: cid },
      data: {
        ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[custodies.PATCH]", err);
    return serverError("Failed to update.");
  }
}

/** DELETE — cancel an active custody. Producer/Owner only. */
export async function DELETE(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, cid } = await ctx.params;
  const cctx = await resolveCustodyContext(guard.userId, id);
  if (!canIssueCustody(cctx)) {
    return forbidden("Only producer / owner can cancel a custody.");
  }

  const existing = await prisma.custody.findFirst({
    where: { id: cid, projectId: id },
  });
  if (!existing) return notFound("Custody not found.");
  if (existing.status !== "active") {
    return badRequest("Only active custodies can be cancelled.");
  }

  // V0.14.3 — Refuse cancellation if ANY committed spend is linked,
  // across both the legacy BudgetRequest model (purchased OR approved
  // ready-to-purchase) AND the V0.13 Purchase model (pending OR
  // approved). Previously only `purchased` BudgetRequests were
  // counted, so a custody with linked Purchases could be cancelled
  // and orphan the spend.
  const [linkedRequests, linkedPurchases] = await Promise.all([
    prisma.budgetRequest.count({
      where: { custodyId: cid, status: { in: ["approved", "purchased"] } },
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m = (prisma as any).purchase;
      if (!m || typeof m.count !== "function") return 0;
      return (await m
        .count({
          where: {
            custodyId: cid,
            status: { in: ["pending", "approved"] },
          },
        })
        .catch(() => 0)) as number;
    })(),
  ]);
  if (linkedRequests + linkedPurchases > 0) {
    return badRequest(
      "This custody has linked spend (expenses or purchases) — settle it instead of cancelling."
    );
  }

  try {
    await prisma.custody.update({
      where: { id: cid },
      data: { status: "cancelled" },
    });
    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "custody_cancelled",
      message: `cancelled a custody.`,
      metadata: { custodyId: cid, departmentId: existing.departmentId },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[custodies.DELETE]", err);
    return serverError("Failed to cancel.");
  }
}
