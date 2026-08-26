/**
 * V0.31 — Per-department Asset Type vocabularies.
 *
 * Hard-coded catalogue keyed by `Department.kind`. Each department
 * exposes a list of "roles" an asset can play — e.g. Art has Action
 * Prop / Raccord Prop, Camera has Main Lens / Additional Lens / Filter.
 *
 * `"general"` is the universal fallback and every department includes
 * it explicitly. Existing rows are backfilled to "general".
 */

export interface AssetTypeOption {
  key: string;
  label: string;
}

const GENERAL: AssetTypeOption = { key: "general", label: "General" };

const ART: AssetTypeOption[] = [
  { key: "action_prop", label: "Action Prop" },
  { key: "raccord_prop", label: "Raccord Prop" },
  GENERAL,
];

const CAMERA: AssetTypeOption[] = [
  { key: "main_lens", label: "Main Lens" },
  { key: "additional_lens", label: "Additional Lens" },
  { key: "filter", label: "Filter" },
  { key: "steadicam", label: "Steadicam" },
  { key: "gimbal", label: "Gimbal" },
  GENERAL,
];

const SOUND: AssetTypeOption[] = [
  { key: "boom", label: "Boom" },
  { key: "wireless_lav", label: "Wireless Lav" },
  { key: "playback", label: "Playback" },
  { key: "sfx", label: "SFX" },
  GENERAL,
];

const WARDROBE: AssetTypeOption[] = [
  { key: "hero_costume", label: "Hero Costume" },
  { key: "background_costume", label: "Background Costume" },
  { key: "change", label: "Change" },
  { key: "double", label: "Double" },
  GENERAL,
];

const MAKEUP: AssetTypeOption[] = [
  { key: "hero_look", label: "Hero Look" },
  { key: "effects_makeup", label: "Effects Makeup" },
  { key: "continuity_look", label: "Continuity Look" },
  GENERAL,
];

const LIGHTING: AssetTypeOption[] = [
  { key: "key_light", label: "Key" },
  { key: "fill_light", label: "Fill" },
  { key: "practical", label: "Practical" },
  GENERAL,
];

const GRIP: AssetTypeOption[] = [
  { key: "dolly", label: "Dolly" },
  { key: "crane", label: "Crane" },
  { key: "track", label: "Track" },
  GENERAL,
];

/** Map Department.kind → its asset-type vocabulary. */
export const DEPT_ASSET_TYPES: Record<string, AssetTypeOption[]> = {
  art_director: ART,
  set_decorator: ART,
  props_master: ART,
  camera_department: CAMERA,
  director_of_photography: CAMERA,
  camera_operator: CAMERA,
  focus_puller: CAMERA,
  steadicam: CAMERA,
  dit: CAMERA,
  sound_department: SOUND,
  sound_mixer: SOUND,
  boom_operator: SOUND,
  wardrobe: WARDROBE,
  costume_designer: WARDROBE,
  makeup_artist: MAKEUP,
  hair_stylist: MAKEUP,
  gaffer: LIGHTING,
  best_boy: LIGHTING,
  electrician: LIGHTING,
  lighting: LIGHTING,
  key_grip: GRIP,
  grip: GRIP,
};

/** Options for a department. Departments without a specialized list
 *  fall through to [General]. */
export function assetTypesForDept(kind: string): AssetTypeOption[] {
  return DEPT_ASSET_TYPES[kind] ?? [GENERAL];
}

/** Human label for a type key within a department context. Unknown
 *  or missing keys render as "General". */
export function assetTypeLabel(
  deptKind: string,
  typeKey: string | null | undefined,
): string {
  if (!typeKey) return "General";
  const list = assetTypesForDept(deptKind);
  return list.find((t) => t.key === typeKey)?.label ?? "General";
}

/** True iff the given dept has a specialized (non-just-General)
 *  vocabulary — useful to decide whether to render the dropdown at
 *  all in a form. */
export function deptHasSpecializedTypes(kind: string): boolean {
  return (DEPT_ASSET_TYPES[kind]?.length ?? 0) > 1;
}
