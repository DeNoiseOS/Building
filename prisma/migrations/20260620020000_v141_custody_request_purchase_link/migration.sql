-- V0.14.1 — Purchase ↔ Custody link + Custody requests.

ALTER TABLE "Purchase" ADD COLUMN "custodyId" TEXT REFERENCES "Custody"("id") ON DELETE SET NULL;
CREATE INDEX "Purchase_custodyId_idx" ON "Purchase"("custodyId");

CREATE TABLE "CustodyRequest" (
  "id"                  TEXT PRIMARY KEY,
  "projectId"           TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "departmentId"        TEXT NOT NULL REFERENCES "Department"("id") ON DELETE CASCADE,
  "requesterUserId"     TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "amount"              INTEGER NOT NULL,
  "reason"              TEXT NOT NULL,
  "status"              TEXT NOT NULL DEFAULT 'pending',
  "decidedByUserId"     TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "decidedAt"           TIMESTAMP(3),
  "decisionReason"      TEXT,
  "fulfilledCustodyId"  TEXT UNIQUE,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL
);

CREATE INDEX "CustodyRequest_projectId_idx"       ON "CustodyRequest"("projectId");
CREATE INDEX "CustodyRequest_departmentId_idx"    ON "CustodyRequest"("departmentId");
CREATE INDEX "CustodyRequest_requesterUserId_idx" ON "CustodyRequest"("requesterUserId");
CREATE INDEX "CustodyRequest_status_idx"          ON "CustodyRequest"("status");
