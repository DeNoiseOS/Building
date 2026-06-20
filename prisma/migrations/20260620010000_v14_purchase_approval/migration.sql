-- V0.14 — Purchase approval workflow.
-- Existing rows are auto-approved (everything previously recorded was by a head).
ALTER TABLE "Purchase"
  ADD COLUMN "status"           TEXT NOT NULL DEFAULT 'approved',
  ADD COLUMN "approvedByUserId" TEXT,
  ADD COLUMN "approvedAt"       TIMESTAMP(3),
  ADD COLUMN "rejectedAt"       TIMESTAMP(3),
  ADD COLUMN "rejectionReason"  TEXT;

CREATE INDEX "Purchase_status_idx" ON "Purchase"("status");
