/**
 * V0.6.3 — Department Expense status vocabulary. Client-safe (no
 * `server-only`, no Prisma). The server-side `lib/budget-data.ts` re-exports
 * these so server and client share one source of truth.
 *
 * The underlying Prisma model is still `BudgetRequest`; conceptually it
 * is now a Department Expense with approval routed through the department
 * head rather than the producer.
 */

export const BUDGET_STATUS = [
  { value: "draft", label: "Draft" },
  { value: "pending_department_approval", label: "Pending approval" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "purchased", label: "Purchased" },
] as const;

export type BudgetStatus = (typeof BUDGET_STATUS)[number]["value"];

export const BUDGET_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  BUDGET_STATUS.map((s) => [s.value, s.label])
);

/**
 * Tolerate legacy V0.6 rows that still carry "submitted" (any that slipped
 * past the V0.6.3 backfill). Treat them as pending department approval.
 */
export function normalizeBudgetStatus(status: string): string {
  return status === "submitted" ? "pending_department_approval" : status;
}
