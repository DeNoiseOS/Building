/**
 * V0.10 (+V0.16) — Client-safe equipment status vocabulary.
 *
 * Canonicalised in Phase 1.1 of the backend cleanup: this file is the
 * single source of truth. `lib/equipment-data.ts` re-exports from
 * here so consumers can import either path and get the same values.
 *
 * V0.16 introduced three additional lifecycle stages (assigned,
 * in_maintenance, retired). Before Phase 1.1, importing from this
 * file silently missed those three; now every consumer gets the
 * complete list.
 */

export const EQUIPMENT_STATUS = [
  { value: "available", label: "Available" },
  // V0.16 — preferred check-out status.
  { value: "assigned", label: "Assigned" },
  // Legacy: kept for backward compatibility.
  { value: "checked_out", label: "Checked out" },
  { value: "returned", label: "Returned" },
  // V0.16 — new lifecycle stages.
  { value: "in_maintenance", label: "In Maintenance" },
  { value: "damaged", label: "Damaged" },
  { value: "retired", label: "Retired" },
  { value: "lost", label: "Lost" },
] as const;

export type EquipmentStatus = (typeof EQUIPMENT_STATUS)[number]["value"];

export const EQUIPMENT_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  EQUIPMENT_STATUS.map((s) => [s.value, s.label]),
);

// ─── Damage severity (unchanged since V0.10) ────────────────────────

export const DAMAGE_SEVERITY = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

export type DamageSeverity = (typeof DAMAGE_SEVERITY)[number]["value"];

export const DAMAGE_SEVERITY_LABELS: Record<string, string> = Object.fromEntries(
  DAMAGE_SEVERITY.map((s) => [s.value, s.label]),
);
