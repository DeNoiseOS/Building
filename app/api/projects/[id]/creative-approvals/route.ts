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
import { canRequestCreativeApproval } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

/**
 * V0.24 — Creative approvals.
 *
 * GET  — list approvals on the project (filterable by status/kind).
 * POST — production side requests a client sign-off. Kinds cover
 *        script/treatment/casting/wardrobe/location/cut milestones
 *        + an "other" catch-all.
 */

const APPROVAL_KINDS = [
  "script_signoff",
  "treatment",
  "casting",
  "wardrobe",
  "location",
  "cut_v1",
  "cut_final",
  "other",
] as const;

const createSchema = z.object({
  kind: z.enum(APPROVAL_KINDS as unknown as [string, ...string[]]),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).nullable().optional(),
  sceneId: z.string().nullable().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const guard = await requireUser();
  if (guard.response) return guard.response;
  const { id } = await ctx.params;
  if (!(await userHasProjectAccess(guard.userId, id)))
    return notFound("Project not found.");

  const sp = new URL(req.url).searchParams;
  const status = sp.get("status");
  const where: Record<string, unknown> = { projectId: id };
  if (status) where.status = status;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = (prisma as any).creativeApproval;
  if (!m || typeof m.findMany !== "function") {
    return NextResponse.json({ approvals: [] });
  }
  const rows = await m
    .findMany({
      where,
      orderBy: { requestedAt: "desc" },
      include: {
        requestedBy: { select: { id: true, name: true } },
        decidedBy: { select: { id: true, name: true } },
        scene: { select: { id: true, number: true, title: true } },
      },
    })
    .catch(() => []);

  type Row = {
    id: string;
    kind: string;
    title: string;
    description: string | null;
    status: string;
    requestedAt: Date;
    decidedAt: Date | null;
    decisionReason: string | null;
    requestedBy: { id: string; name: string } | null;
    decidedBy: { id: string; name: string } | null;
    scene: { id: string; number: string; title: string } | null;
  };
  return NextResponse.json({
    approvals: (rows as Row[]).map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      description: r.description,
      status: r.status,
      requestedAt: r.requestedAt.toISOString(),
      decidedAt: r.decidedAt?.toISOString() ?? null,
      decisionReason: r.decisionReason,
      requestedBy: r.requestedBy,
      decidedBy: r.decidedBy,
      scene: r.scene,
    })),
  });
}

export async function POST(req: Request, ctx: Ctx) {
  const guard = await requireUser();
  if (guard.response) return guard.response;
  const { id } = await ctx.params;
  if (!(await userHasProjectAccess(guard.userId, id)))
    return notFound("Project not found.");

  if (
    !(await canRequestCreativeApproval({
      userId: guard.userId,
      projectId: id,
    }))
  ) {
    return forbidden(
      "Only Director / AD / Producer / EP / Owner can request an approval."
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid payload.", parsed.error.flatten().fieldErrors);
  }

  if (parsed.data.sceneId) {
    const scene = await prisma.scene.findFirst({
      where: { id: parsed.data.sceneId, projectId: id },
      select: { id: true },
    });
    if (!scene) return badRequest("Scene not found on this project.");
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = (prisma as any).creativeApproval;
    const created = await m.create({
      data: {
        projectId: id,
        sceneId: parsed.data.sceneId ?? null,
        kind: parsed.data.kind,
        title: parsed.data.title.trim(),
        description: parsed.data.description ?? null,
        requestedByUserId: guard.userId,
      },
    });
    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "creative_approval_requested",
      message: `requested creative approval: '${parsed.data.title.trim()}'.`,
      metadata: {
        approvalId: created.id,
        kind: parsed.data.kind,
        sceneId: parsed.data.sceneId ?? null,
      },
    });
    return NextResponse.json({ ok: true, id: created.id });
  } catch (err) {
    console.error("[creative-approvals.POST]", err);
    return serverError("Failed.");
  }
}
