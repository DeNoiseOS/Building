import { useMemo } from "react";

/**
 * V0.28 Phase B — Density tiers.
 *
 * A widget's information density is a pure function of its grid
 * footprint. Every widget renderer receives its current tier as a
 * prop and reveals more or fewer fields accordingly — the widget is
 * NEVER visually scaled.
 *
 * Tier boundaries chosen from the reference examples:
 *   1x1   → micro     (single big number)
 *   2x1   → compact   (number + sub-line)
 *   3x2   → standard  (grouped lists)
 *   4x3   → expanded  (detailed rows with metadata)
 *   6x4+  → full      (everything the widget offers)
 */
export type Density = "micro" | "compact" | "standard" | "expanded" | "full";

export function densityFor(w: number, h: number): Density {
  const area = w * h;
  if (w === 1 && h === 1) return "micro";
  if (area <= 3) return "compact";   // 2x1, 3x1
  if (area <= 8) return "standard";  // 2x2..4x2, 2x3
  if (area <= 15) return "expanded"; // 3x3..5x3, 3x4..3x5
  return "full";
}

export function useDensity(w: number, h: number): Density {
  return useMemo(() => densityFor(w, h), [w, h]);
}
