import type { WidgetGeometry, WidgetInstance } from "@/lib/widgets/schema";

/**
 * V0.28 Phase B — Client-side layout helpers.
 *
 * Geometry + collision resolution + compact-up shared by the
 * drag/resize pipeline. Server actions re-clamp on write, so these
 * are safe optimistic.
 */

export const GRID_COLS = 12;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** True when two rects share ANY x-range (used by compact-up which
 *  only cares about vertical collisions inside the same column band). */
function xOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x;
}

export function clampWithinGrid(g: WidgetGeometry): WidgetGeometry {
  const w = Math.max(1, Math.min(GRID_COLS, g.w));
  const h = Math.max(1, g.h);
  const x = Math.max(0, Math.min(GRID_COLS - w, g.x));
  const y = Math.max(0, g.y);
  return { x, y, w, h };
}

/**
 * Full layout resolve after a widget was moved or resized:
 *
 *   1. PUSH DOWN — every non-mover widget that now overlaps the mover
 *      (or another widget) is pushed just far enough down to clear.
 *   2. COMPACT UP — every non-mover widget is then pulled UP as high
 *      as it can go without re-introducing overlap. This eliminates
 *      the "leftover gap" problem where a small resize pushes some
 *      widgets down but leaves others behind, creating a big visible
 *      hole in the layout.
 *
 * The mover (`movingId`) is NEVER moved by either phase — its
 * position is fixed by the user's action.
 */
export function resolveCollisions(
  layout: WidgetInstance[],
  movingId: string,
): WidgetInstance[] {
  const next: WidgetInstance[] = layout.map((w) => ({ ...w }));

  // ── Phase 1: push down until no overlap ──────────────────────────
  for (let pass = 0; pass < 30; pass++) {
    let changed = false;
    const sorted = [...next].sort((a, b) => a.y - b.y);
    for (const w of sorted) {
      if (w.id === movingId) continue;
      let requiredY = w.y;
      for (const other of sorted) {
        if (other.id === w.id) continue;
        if (rectsOverlap(w, other)) {
          const belowOther = other.y + other.h;
          if (belowOther > requiredY) requiredY = belowOther;
        }
      }
      if (requiredY !== w.y) {
        const idx = next.findIndex((x) => x.id === w.id);
        next[idx] = { ...next[idx], y: requiredY };
        changed = true;
      }
    }
    if (!changed) break;
  }

  // ── Phase 2: compact up so the layout stays tight ────────────────
  // Sort ascending so we compact top-to-bottom.
  for (let pass = 0; pass < 30; pass++) {
    let changed = false;
    const sortedAsc = [...next].sort((a, b) => a.y - b.y);
    for (const w of sortedAsc) {
      if (w.id === movingId) continue;
      // The lowest y where w can sit without overlapping anything
      // whose bottom is at or above the CURRENT w.y. That is the max
      // bottom of every widget above w in w's column band.
      let bestY = 0;
      for (const other of next) {
        if (other.id === w.id) continue;
        if (!xOverlap(w, other)) continue;
        const belowOther = other.y + other.h;
        // Only consider widgets whose bottom sits above w's top
        // (i.e., truly "above" in this column).
        if (belowOther <= w.y && belowOther > bestY) {
          bestY = belowOther;
        }
      }
      if (bestY < w.y) {
        const idx = next.findIndex((x) => x.id === w.id);
        next[idx] = { ...next[idx], y: bestY };
        changed = true;
      }
    }
    if (!changed) break;
  }

  return next;
}

/** First fully-empty row below every widget — used when adding a
 *  brand-new widget so it never lands on top of something. */
export function nextFreeRow(layout: WidgetInstance[]): number {
  let bottom = 0;
  for (const w of layout) {
    const b = w.y + w.h;
    if (b > bottom) bottom = b;
  }
  return bottom;
}
