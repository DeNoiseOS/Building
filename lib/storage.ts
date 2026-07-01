import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * V0.23 — Supabase Storage helper.
 *
 * The client is created lazily so pages that don't upload don't pay
 * the initialization cost. Reads NEXT_PUBLIC_SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY from the environment.
 *
 * Bucket layout:
 *   production-files/{projectId}/{ownerType}/{ownerId}/{uuid}-{name}
 *
 * The bucket must exist and be public-read. Signed URLs are used for
 * uploads (60s TTL); reads use the public URL.
 */

export const STORAGE_BUCKET = "production-files";

let cachedClient: ReturnType<typeof createClient> | null = null;

export function isStorageConfigured(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function getClient() {
  if (cachedClient) return cachedClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase Storage isn't configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

/**
 * Ask Supabase for a URL the browser can PUT to directly. Uses the
 * service key on the server so the browser never sees it.
 */
export async function createSignedUploadUrl(
  storagePath: string
): Promise<{ signedUrl: string; token: string; path: string }> {
  const client = getClient();
  const { data, error } = await client.storage
    .from(STORAGE_BUCKET)
    .createSignedUploadUrl(storagePath);
  if (error || !data) {
    throw new Error(`Signed URL failed: ${error?.message ?? "unknown"}`);
  }
  return { signedUrl: data.signedUrl, token: data.token, path: data.path };
}

/**
 * The permanent public URL for a stored file. Bucket must be
 * configured as public for this to work in production.
 */
export function getPublicUrl(storagePath: string): string {
  const client = getClient();
  const { data } = client.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath);
  return data.publicUrl;
}

/** Remove a file from the bucket. Failures are logged, not thrown. */
export async function removeStorageFile(storagePath: string): Promise<void> {
  try {
    const client = getClient();
    await client.storage.from(STORAGE_BUCKET).remove([storagePath]);
  } catch (err) {
    console.error("[storage.remove]", storagePath, err);
  }
}

/** Owner types the upload API accepts. */
export const OWNER_TYPES = [
  "scene",
  "scene_cover",
  "scene_dept",
  "bible",
  "purchase",
  "equipment",
  "user",
  "custody",
] as const;
export type OwnerType = (typeof OWNER_TYPES)[number];

export const MIME_LIMITS: Record<string, number> = {
  // Images — 20 MB
  "image/jpeg": 20 * 1024 * 1024,
  "image/png": 20 * 1024 * 1024,
  "image/webp": 20 * 1024 * 1024,
  "image/gif": 20 * 1024 * 1024,
  "image/heic": 20 * 1024 * 1024,
  "image/heif": 20 * 1024 * 1024,
  // Docs — 10 MB
  "text/plain": 10 * 1024 * 1024,
  "text/markdown": 10 * 1024 * 1024,
  "text/csv": 10 * 1024 * 1024,
  "application/msword": 10 * 1024 * 1024,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": 10 * 1024 * 1024,
  "application/rtf": 10 * 1024 * 1024,
  "application/vnd.oasis.opendocument.text": 10 * 1024 * 1024,
  "application/vnd.ms-excel": 10 * 1024 * 1024,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": 10 * 1024 * 1024,
  // PDF — 50 MB
  "application/pdf": 50 * 1024 * 1024,
  // Video — 200 MB
  "video/mp4": 200 * 1024 * 1024,
  "video/quicktime": 200 * 1024 * 1024,
  "video/webm": 200 * 1024 * 1024,
  // Audio — 50 MB
  "audio/mpeg": 50 * 1024 * 1024,
  "audio/mp3": 50 * 1024 * 1024,
  "audio/wav": 50 * 1024 * 1024,
  "audio/mp4": 50 * 1024 * 1024,
  "audio/x-m4a": 50 * 1024 * 1024,
  // Film-specific — 10 MB
  "application/x-final-draft": 10 * 1024 * 1024,
};

export function isAcceptedMime(mime: string): boolean {
  return mime in MIME_LIMITS;
}

export function maxSizeForMime(mime: string): number {
  return MIME_LIMITS[mime] ?? 0;
}
