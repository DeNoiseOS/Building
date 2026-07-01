import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  badRequest,
  notFound,
  serverError,
} from "@/lib/api";
import { userHasProjectAccess } from "@/lib/access";
import { OWNER_TYPES, getPublicUrl } from "@/lib/storage";

/**
 * V0.23 — Attachment records.
 *
 * GET  — list attachments for (ownerType, ownerId) on this project.
 * POST — create the record AFTER the file successfully landed in
 *        Storage (client → signed URL → PUT → this endpoint).
 */

const createSchema = z.object({
  ownerType: z.enum(OWNER_TYPES as unknown as [string, ...string[]]),
  ownerId: z.string().min(1).max(60),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  size: z.number().int().min(1),
  storagePath: z.string().min(1).max(1024),
});

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireUser();
  if (guard.response) return guard.response;
  const { id } = await ctx.params;
  if (!(await userHasProjectAccess(guard.userId, id)))
    return notFound("Project not found.");

  const sp = new URL(req.url).searchParams;
  const ownerType = sp.get("ownerType");
  const ownerId = sp.get("ownerId");
  if (!ownerType || !ownerId) {
    return badRequest("ownerType + ownerId are required.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = (prisma as any).attachment;
  if (!m || typeof m.findMany !== "function") {
    return NextResponse.json({ attachments: [] });
  }
  const rows = await m
    .findMany({
      where: { projectId: id, ownerType, ownerId },
      orderBy: { createdAt: "desc" },
      include: { uploadedBy: { select: { id: true, name: true } } },
    })
    .catch(() => []);

  type Row = {
    id: string;
    ownerType: string;
    ownerId: string;
    fileName: string;
    mimeType: string;
    size: number;
    storagePath: string;
    thumbnailPath: string | null;
    createdAt: Date;
    uploadedBy: { id: string; name: string } | null;
  };
  return NextResponse.json({
    attachments: (rows as Row[]).map((r) => ({
      id: r.id,
      ownerType: r.ownerType,
      ownerId: r.ownerId,
      fileName: r.fileName,
      mimeType: r.mimeType,
      size: r.size,
      storagePath: r.storagePath,
      url: safePublicUrl(r.storagePath),
      thumbnailUrl: r.thumbnailPath ? safePublicUrl(r.thumbnailPath) : null,
      uploadedBy: r.uploadedBy,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

function safePublicUrl(path: string): string | null {
  try {
    return getPublicUrl(path);
  } catch {
    return null;
  }
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

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = (prisma as any).attachment;
    const created = await m.create({
      data: {
        projectId: id,
        ownerType: parsed.data.ownerType,
        ownerId: parsed.data.ownerId,
        fileName: parsed.data.fileName,
        mimeType: parsed.data.mimeType,
        size: parsed.data.size,
        storagePath: parsed.data.storagePath,
        uploadedByUserId: guard.userId,
      },
    });
    return NextResponse.json({
      id: created.id,
      url: safePublicUrl(parsed.data.storagePath),
    });
  } catch (err) {
    console.error("[attachments.POST]", err);
    return serverError("Failed to record attachment.");
  }
}
