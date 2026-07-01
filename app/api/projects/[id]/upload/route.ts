import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  requireUser,
  badRequest,
  notFound,
  serverError,
} from "@/lib/api";
import { userHasProjectAccess } from "@/lib/access";
import {
  OWNER_TYPES,
  isAcceptedMime,
  maxSizeForMime,
  isStorageConfigured,
  createSignedUploadUrl,
} from "@/lib/storage";

/**
 * V0.23 — POST /api/projects/[id]/upload
 *
 * Client sends { ownerType, ownerId, fileName, mimeType, size }.
 * Server validates + returns a signed URL the browser can PUT to
 * directly. We do NOT create the Attachment DB row here — the client
 * calls POST /attachments AFTER the upload completes, passing back
 * the storagePath. This split keeps failed uploads out of the DB.
 */

const requestSchema = z.object({
  ownerType: z.enum(OWNER_TYPES as unknown as [string, ...string[]]),
  ownerId: z.string().min(1).max(60),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  size: z.number().int().min(1),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireUser();
  if (guard.response) return guard.response;

  const { id } = await ctx.params;
  if (!(await userHasProjectAccess(guard.userId, id)))
    return notFound("Project not found.");

  if (!isStorageConfigured()) {
    return serverError(
      "File uploads aren't configured on this deployment. Ask the admin to set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid payload.", parsed.error.flatten().fieldErrors);
  }

  const { ownerType, ownerId, fileName, mimeType, size } = parsed.data;

  if (!isAcceptedMime(mimeType)) {
    return badRequest(
      `Files of type ${mimeType} aren't accepted. Try an image, PDF, doc, spreadsheet, video, or audio file.`
    );
  }
  const maxSize = maxSizeForMime(mimeType);
  if (size > maxSize) {
    const maxMB = Math.round(maxSize / (1024 * 1024));
    return badRequest(
      `File is too large — max ${maxMB} MB for this type.`
    );
  }

  // Safe filename: strip anything that could break the Storage path.
  const safeName = fileName
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
  const storagePath = `${id}/${ownerType}/${ownerId}/${randomUUID()}-${safeName}`;

  try {
    const signed = await createSignedUploadUrl(storagePath);
    return NextResponse.json({
      storagePath,
      signedUrl: signed.signedUrl,
      token: signed.token,
    });
  } catch (err) {
    console.error("[upload.POST]", err);
    return serverError((err as Error).message ?? "Failed to sign URL.");
  }
}
