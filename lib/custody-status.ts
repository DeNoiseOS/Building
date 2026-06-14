/** V0.9 — Client-safe custody status vocabulary. */
export const CUSTODY_STATUS = [
  { value: "active", label: "Active" },
  { value: "settled", label: "Settled" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export type CustodyStatus = (typeof CUSTODY_STATUS)[number]["value"];

export const CUSTODY_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  CUSTODY_STATUS.map((s) => [s.value, s.label])
);

export const SETTLEMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Settlement pending",
  approved: "Settlement approved",
};
