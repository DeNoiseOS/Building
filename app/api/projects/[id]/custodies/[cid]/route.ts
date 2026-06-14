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

/** PATCH — issuer / owner can edit notes. */
export async function PATCH(request: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, cid } = await ctx.params;
  const existing = await prisma.custody.findFirst({
    where: { id: cid, projectId: id },
  });
  if (!existing) return notFound("Custody not found.");

  const cctx = await resolveCustodyContext(guard.userId, id);
  if (!cctx.isOwner && existing.issuedByUserId !== guard.userId) {
    return forbidden("Only the issuer / owner can edit this custody.");
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

  // Refuse cancellation if any purchased expense is already linked.
  const linkedSpent = await prisma.budgetRequest.count({
    where: { custodyId: cid, status: "purchased" },
  });
  if (linkedSpent > 0) {
    return badRequest("This custody has linked expenses — settle it instead.");
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
