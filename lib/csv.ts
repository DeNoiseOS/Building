/**
 * V0.21 — Minimal CSV helper.
 *
 * Quotes any cell that contains a comma, quote, or newline; doubles
 * internal quotes per RFC 4180. Returns a single string ready to
 * stream as text/csv.
 */
export function toCSV(rows: Array<Array<string | number | null>>): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          if (cell === null || cell === undefined) return "";
          const s = String(cell);
          if (s.includes(",") || s.includes('"') || s.includes("\n")) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        })
        .join(",")
    )
    .join("\n");
}

/** Stamp filename: project-name_kind_2026-06-23.csv */
export function exportFilename(
  projectName: string,
  kind: string,
  date = new Date()
): string {
  const safe = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const stamp = date.toISOString().slice(0, 10);
  return `${safe || "project"}_${kind}_${stamp}.csv`;
}
