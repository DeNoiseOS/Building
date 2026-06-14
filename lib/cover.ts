/**
 * Deterministic palette assignment for project covers. Same project always
 * gets the same gradient class. Five palettes; cycled by hash of the project
 * id. Used by ProjectCard, project header art, project switcher icon.
 */

const PALETTES = [
  "cover-gradient-violet",
  "cover-gradient-amber",
  "cover-gradient-emerald",
  "cover-gradient-rose",
  "cover-gradient-sky",
] as const;

export type CoverPalette = (typeof PALETTES)[number];

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function coverFor(projectId: string): CoverPalette {
  return PALETTES[hashString(projectId) % PALETTES.length];
}
