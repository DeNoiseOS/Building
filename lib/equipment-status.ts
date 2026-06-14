/** V0.10 — Client-safe equipment status vocabulary. */
export const EQUIPMENT_STATUS = [
  { value: "available", label: "Available" },
  { value: "checked_out", label: "Checked out" },
  { value: "returned", label: "Returned" },
  { value: "damaged", label: "Damaged" },
  { value: "lost", label: "Lost" },
] as const;

export type EquipmentStatus = (typeof EQUIPMENT_STATUS)[number]["value"];

export const EQUIPMENT_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  EQUIPMENT_STATUS.map((s) => [s.value, s.label])
);

export const DAMAGE_SEVERITY = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

export type DamageSeverity = (typeof DAMAGE_SEVERITY)[number]["value"];

export const DAMAGE_SEVERITY_LABELS: Record<string, string> = Object.fromEntries(
  DAMAGE_SEVERITY.map((s) => [s.value, s.label])
);
