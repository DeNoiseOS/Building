import { NextResponse } from "next/server";
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
  canRequestSettlement,
} from "@/lib/custody-data";
import { logActivity } from "@/lib/activity";
import { notifyMany } from "@/lib/notifications";

interface RouteContext {
  params: Promise<{ id: string; cid: string }>;
}

/** POST — holder or dept head requests settlement on an active custody. */
export async function POST(_req: Request, ctx: RouteContext) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id, cid } = await ctx.params;
  const existing = await prisma.custody.findFirst({
    where: { id: cid, projectId: id },
    include: { department: { select: { id: true, kind: true, name: true } } },
  });
  if (!existing) return notFound("Custody not found.");
  if (existing.status !== "active") {
    return badRequest("Only active custodies can be settled.");
  }
  if (existing.settlementStatus === "pending") {
    return badRequest("Settlement already requested.");
  }

  const cctx = await resolveCustodyContext(guard.userId, id);
  if (
    !canRequestSettlement(cctx, {
      holderUserId: existing.holderUserId,
      departmentId: existing.departmentId,
      departmentKind: existing.department.kind,
    })
  ) {
    return forbidden("Not allowed.");
  }

  try {
    await prisma.custody.update({
      where: { id: cid },
      data: {
        settlementStatus: "pending",
        settlementRequestedAt: new Date(),
      },
    });

    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "custody_settlement_requested",
      message: `requested settlement on a custody (${existing.department.name}).`,
      metadata: { custodyId: cid, departmentId: existing.departmentId },
    });

    // Notify project owner + producers.
    const project = await prisma.project.findUnique({
      where: { id },
      select: { userId: true },
    });
    const producers = await prisma.projectMember.findMany({
      where: { projectId: id, role: "producer" },
      select: { userId: true },
    });
    const targets = new Set<string>();
    if (project) targets.add(project.userId);
    producers.forEach((p) => targets.add(p.userId));

    await notifyMany(Array.from(targets), {
      type: "custody_settlement_requested",
      title: "Custody settlement requested",
      body: `${existing.department.name}`,
      link: `/projects/${id}/budget`,
      metadata: { custodyId: cid, projectId: id },
      skipUserId: guard.userId,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[custodies.request-settlement]", err);
    return serverError("Failed.");
  }
}
