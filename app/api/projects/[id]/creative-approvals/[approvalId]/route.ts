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
import { canDecideCreativeApproval } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

/**
 * V0.24 — POST /creative-approvals/[id] with { decision, reason }
 * to approve or reject an approval request.
 *
 * Only client-side roles (Creative Director, Copywriter, Brand
 * Manager, Account Manager) can decide.
 */
const patchSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().max(4000).nullable().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; approvalId: string }> }
) {
  const guard = await requireUser();
  if (guard.response) return guard.response;
  const { id, approvalId } = await ctx.params;
  if (!(await userHasProjectAccess(guard.userId, id)))
    return notFound("Project not found.");

  if (
    !(await canDecideCreativeApproval({
      userId: guard.userId,
      projectId: id,
    }))
  ) {
    return forbidden(
      "Only agency-side roles can decide creative approvals."
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = (prisma as any).creativeApproval;
  if (!m) return notFound("Not found.");
  const row = await m.findUnique({ where: { id: approvalId } });
  if (!row || row.projectId !== id) return notFound("Not found.");
  if (row.status !== "pending") {
    return badRequest("This approval has already been decided.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid payload.", parsed.error.flatten().fieldErrors);
  }
  if (
    parsed.data.decision === "rejected" &&
    !(parsed.data.reason?.trim())
  ) {
    return badRequest("Rejections need a short reason.");
  }

  try {
    await m.update({
      where: { id: approvalId },
      data: {
        status: parsed.data.decision,
        decidedByUserId: guard.userId,
        decidedAt: new Date(),
        decisionReason: parsed.data.reason ?? null,
      },
    });
    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type:
        parsed.data.decision === "approved"
          ? "creative_approval_approved"
          : "creative_approval_rejected",
      message: `${parsed.data.decision === "approved" ? "approved" : "rejected"} creative approval: '${row.title}'.`,
      metadata: { approvalId, sceneId: row.sceneId },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[creative-approvals.decide]", err);
    return serverError("Failed.");
  }
}
