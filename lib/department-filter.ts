/**
 * V0.6 — URL query helpers for the department filter shared across the
 * global Tasks page, project Tasks/Kanban, Calendar, and Activity views.
 *
 *   ?dept=all              → no filter (every department + untagged)
 *   ?dept=mine             → caller's departments + untagged
 *   ?dept=<id1>,<id2>,...  → explicit list of department IDs
 *   (missing)              → default for that surface
 */

export type DeptFilterMode = "all" | "mine" | "custom";

export interface DeptFilter {
  mode: DeptFilterMode;
  departmentIds: string[];
}

export function parseDeptFilter(value: string | null | undefined): DeptFilter {
  if (!value) return { mode: "all", departmentIds: [] };
  if (value === "all") return { mode: "all", departmentIds: [] };
  if (value === "mine") return { mode: "mine", departmentIds: [] };
  const ids = value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (ids.length === 0) return { mode: "all", departmentIds: [] };
  return { mode: "custom", departmentIds: ids };
}

export function serializeDeptFilter(filter: DeptFilter): string | null {
  if (filter.mode === "all") return null;
  if (filter.mode === "mine") return "mine";
  if (filter.departmentIds.length === 0) return null;
  return filter.departmentIds.join(",");
}

/**
 * Build a Prisma `where` fragment for filtering items by their
 * `departmentId` column.
 *
 *   - all       → no filter
 *   - mine      → caller's departments + untagged (NULL)
 *   - custom    → only the listed department IDs
 */
export function deptFilterToPrismaWhere(
  filter: DeptFilter,
  myDeptIds: string[]
): object | undefined {
  if (filter.mode === "all") return undefined;
  if (filter.mode === "mine") {
    if (myDeptIds.length === 0) return { departmentId: null };
    return {
      OR: [{ departmentId: { in: myDeptIds } }, { departmentId: null }],
    };
  }
  return { departmentId: { in: filter.departmentIds } };
}
