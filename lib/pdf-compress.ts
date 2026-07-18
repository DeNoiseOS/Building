/**
 * V0.27 — Client-side PDF re-serialization before upload.
 *
 * Re-saves the PDF with object streams enabled, which dedupes and
 * compresses the document's internal structure without touching
 * page content — output is byte-for-byte the same when rendered.
 * This is NOT image recompression (that needs a native renderer we
 * don't have on Vercel serverless); it mainly helps text-heavy
 * documents like script sign-offs and call sheets, which is most of
 * what gets attached here.
 *
 * Never blocks an upload: any parse/save failure (encrypted,
 * corrupt, or already-optimized PDFs) falls back to the original
 * file untouched.
 */

export async function compressPdfFile(file: File): Promise<File> {
  if (file.type !== "application/pdf") return file;

  try {
    const { PDFDocument } = await import("pdf-lib");
    const bytes = await file.arrayBuffer();
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const saved = await doc.save({ useObjectStreams: true });

    if (saved.byteLength >= file.size) return file;

    return new File([new Uint8Array(saved)], file.name, {
      type: "application/pdf",
    });
  } catch {
    return file;
  }
}
