/** V0.6.1 — Client-safe allocation status vocabulary. */
export const ALLOCATION_STATUS = [
  { value: "pending", label: "Pending" },
  { value: "revision_requested", label: "Revision requested" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
] as const;

export type AllocationStatus = (typeof ALLOCATION_STATUS)[number]["value"];

export const ALLOCATION_STATUS_LABELS: Record<string, string> =
  Object.fromEntries(ALLOCATION_STATUS.map((s) => [s.value, s.label]));
