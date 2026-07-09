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
import { canManageCast, isClientCaller } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

/**
 * V0.25 — Talent list + create.
 *
 * GET  — everyone in the project can list. For client roles the
 *        response strips contact / rate / agent fields (creative
 *        view only).
 * POST — Casting Director + scene-manager roles only.
 */

const createSchema = z.object({
  departmentId: z.string().min(1),
  name: z.string().min(1).max(200),
  characterName: z.string().max(200).nullable().optional(),
  bio: z.string().max(4000).nullable().optional(),
  headshotUrl: z.string().url().max(800).nullable().optional().or(z.literal("")),
  contactPhone: z.string().max(60).nullable().optional(),
  contactEmail: z.string().email().max(200).nullable().optional().or(z.literal("")),
  agentName: z.string().max(200).nullable().optional(),
  agentContact: z.string().max(200).nullable().optional(),
  dayRate: z.number().int().min(0).max(10_000_000_00).nullable().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const guard = await requireUser();
  if (guard.response) return guard.response;
  const { id } = await ctx.params;
  if (!(await userHasProjectAccess(guard.userId, id)))
    return notFound("Project not found.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = (prisma as any).talent;
  if (!m || typeof m.findMany !== "function") {
    return NextResponse.json({ talents: [] });
  }

  const isClient = await isClientCaller({
    userId: guard.userId,
    projectId: id,
  });

  const rows = await m
    .findMany({
      where: { projectId: id },
      orderBy: { createdAt: "asc" },
      include: {
        department: { select: { id: true, name: true, kind: true } },
        _count: { select: { sceneLinks: true } },
      },
    })
    .catch(() => []);

  type Row = {
    id: string;
    name: string;
    characterName: string | null;
    bio: string | null;
    headshotUrl: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
    agentName: string | null;
    agentContact: string | null;
    dayRate: number | null;
    department: { id: string; name: string; kind: string };
    _count: { sceneLinks: number };
  };

  return NextResponse.json({
    talents: (rows as Row[]).map((r) => ({
      id: r.id,
      name: r.name,
      characterName: r.characterName,
      bio: r.bio,
      headshotUrl: r.headshotUrl,
      // V0.25 — Business info stripped from client-role response.
      contactPhone: isClient ? null : r.contactPhone,
      contactEmail: isClient ? null : r.contactEmail,
      agentName: isClient ? null : r.agentName,
      agentContact: isClient ? null : r.agentContact,
      dayRate: isClient ? null : r.dayRate,
      department: r.department,
      sceneCount: r._count.sceneLinks,
    })),
  });
}

export async function POST(req: Request, ctx: Ctx) {
  const guard = await requireUser();
  if (guard.response) return guard.response;
  const { id } = await ctx.params;
  if (!(await userHasProjectAccess(guard.userId, id)))
    return notFound("Project not found.");

  if (!(await canManageCast({ userId: guard.userId, projectId: id }))) {
    return forbidden(
      "Only Casting Director / Director / AD / Producer / EP / Owner can add talent."
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

  const dept = await prisma.department.findFirst({
    where: { id: parsed.data.departmentId, projectId: id },
    select: { id: true, name: true },
  });
  if (!dept) return badRequest("Department not found on this project.");

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = (prisma as any).talent;
    const created = await m.create({
      data: {
        projectId: id,
        departmentId: dept.id,
        name: parsed.data.name.trim(),
        characterName: parsed.data.characterName?.trim() || null,
        bio: parsed.data.bio?.trim() || null,
        headshotUrl: parsed.data.headshotUrl || null,
        contactPhone: parsed.data.contactPhone?.trim() || null,
        contactEmail: parsed.data.contactEmail || null,
        agentName: parsed.data.agentName?.trim() || null,
        agentContact: parsed.data.agentContact?.trim() || null,
        dayRate: parsed.data.dayRate ?? null,
        createdByUserId: guard.userId,
      },
    });
    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "talent_added",
      message: `added ${parsed.data.name.trim()} to Cast (${dept.name}).`,
      metadata: { talentId: created.id, departmentId: dept.id },
    });
    return NextResponse.json({ ok: true, id: created.id });
  } catch (err) {
    console.error("[talents.POST]", err);
    return serverError("Failed to add talent.");
  }
}
