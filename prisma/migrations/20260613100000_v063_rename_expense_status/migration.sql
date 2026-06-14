-- ─── V0.6.3 — Expense status rename (data-only) ───────────────────────
-- V0.6.3 reframes BudgetRequest as a Department Expense. Status
-- "submitted" (waiting on producer approval, V0.6 semantics) becomes
-- "pending_department_approval" (waiting on department-head approval).
--
-- No schema change. Only the status string vocabulary is updated.

UPDATE "BudgetRequest"
SET "status" = 'pending_department_approval'
WHERE "status" = 'submitted';
