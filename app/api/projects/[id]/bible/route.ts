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
import { canEditBibleSection } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

/**
 * V0.20 — Production Bible.
 *
 * GET  — list entries for a project (everyone with project access).
 *        Pinned first, then by createdAt desc.
 * POST — create an entry. Requires canEditBibleSection for the
 *        target departmentId (NULL = Direction & Production).
 */

const BIBLE_TYPES = [
  "note",
  "link",
  "image",
  "document",
  "video",
  "mood_board",
  "other",
] as const;

const createSchema = z.object({
  /** NULL = "Direction & Production" pseudo-section. */
  departmentId: z.string().nullable().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  /** Either url, body, or both. UI enforces that at least one is set. */
  url: z.string().url().max(800).nullable().optional(),
  body: z.string().max(20_000).nullable().optional(),
  type: z.enum(BIBLE_TYPES).default("link"),
  pinned: z.boolean().default(false),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireUser();
  if (guard.response) return guard.response;
  const { id } = await ctx.params;
  if (!(await userHasProjectAccess(guard.userId, id)))
    return notFound("Project not found.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = (prisma as any).bibleEntry;
  if (!m || typeof m.findMany !== "function") {
    return NextResponse.json({ entries: [] });
  }
  const rows = await m
    .findMany({
      where: { projectId: id },
      include: {
        department: { select: { id: true, name: true, kind: true } },
        addedBy: { select: { id: true, name: true } },
      },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    })
    .catch(() => []);
  return NextResponse.json({ entries: rows });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireUser();
  if (guard.response) return guard.response;
  const { id } = await ctx.params;
  if (!(await userHasProjectAccess(guard.userId, id)))
    return notFound("Project not found.");

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
  if (!parsed.data.url && !parsed.data.body) {
    return badRequest("Entry must have a URL or a text body.");
  }

  let deptKind: string | null = null;
  let deptName: string | null = null;
  if (parsed.data.departmentId) {
    const dept = await prisma.department.findFirst({
      where: { id: parsed.data.departmentId, projectId: id },
      select: { id: true, kind: true, name: true },
    });
    if (!dept) return notFound("Department not found on this project.");
    deptKind = dept.kind;
    deptName = dept.name;
  }

  const allowed = await canEditBibleSection(
    { userId: guard.userId, projectId: id },
    deptKind
  );
  if (!allowed) {
    return forbidden(
      deptKind === null
        ? "Only Director / AD / Producer / EP / Owner can add to Direction & Production."
        : `Only the ${deptName} head (or scene authors) can add here.`
    );
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = (prisma as any).bibleEntry;
    const created = await m.create({
      data: {
        projectId: id,
        departmentId: parsed.data.departmentId ?? null,
        title: parsed.data.title.trim(),
        description: parsed.data.description ?? null,
        url: parsed.data.url ?? null,
        body: parsed.data.body ?? null,
        type: parsed.data.type,
        pinned: parsed.data.pinned,
        addedByUserId: guard.userId,
      },
    });
    await logActivity({
      projectId: id,
      actorId: guard.userId,
      actorName: guard.userName,
      type: "bible_entry_added",
      message: `added "${parsed.data.title.trim()}" to the Production Bible${deptName ? ` (${deptName})` : ""}.`,
      metadata: { entryId: created.id, departmentId: deptKind ? parsed.data.departmentId : null },
    });
    return NextResponse.json({ ok: true, id: created.id });
  } catch (err) {
    console.error("[bible.POST]", err);
    return serverError("Failed to add entry.");
  }
}
