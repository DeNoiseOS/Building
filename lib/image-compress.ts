/**
 * V0.27 — Client-side image compression before upload.
 *
 * Supabase Storage is on the free tier, so we shrink photos in the
 * browser before they ever leave the device. Location/wardrobe shots
 * and scene covers are the common case — real photos, transparency
 * doesn't matter — so we re-encode everything raster to JPEG at a
 * capped resolution rather than trying to preserve original formats.
 *
 * Never blocks an upload: any decode/encode failure falls back to the
 * original file untouched.
 */

const COMPRESSIBLE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_DIMENSION = 2000; // px, longest side
const JPEG_QUALITY = 0.82;

export async function compressImageFile(file: File): Promise<File> {
  if (!COMPRESSIBLE_TYPES.has(file.type)) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality: JPEG_QUALITY,
    });

    // Only swap in the compressed version if it's actually smaller —
    // small/already-optimized images can grow slightly on re-encode.
    if (blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
