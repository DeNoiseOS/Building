-- V0.13 — Purchases & Rentals
CREATE TABLE "Purchase" (
  "id"              TEXT PRIMARY KEY,
  "projectId"       TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "departmentId"    TEXT NOT NULL REFERENCES "Department"("id") ON DELETE CASCADE,
  "type"            TEXT NOT NULL,
  "categoryKey"     TEXT NOT NULL,
  "customCategory"  TEXT,
  "saveAsResource"  BOOLEAN NOT NULL DEFAULT FALSE,
  "equipmentId"     TEXT UNIQUE,
  "name"            TEXT NOT NULL,
  "description"     TEXT,
  "amount"          INTEGER NOT NULL,
  "vendor"          TEXT,
  "assigneeId"      TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "purchaseDate"    TIMESTAMP(3),
  "rentalStart"     TIMESTAMP(3),
  "rentalEnd"       TIMESTAMP(3),
  "receiptUrl"      TEXT,
  "paymentStatus"   TEXT NOT NULL DEFAULT 'unpaid',
  "createdByUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL
);

CREATE INDEX "Purchase_projectId_idx"       ON "Purchase"("projectId");
CREATE INDEX "Purchase_departmentId_idx"    ON "Purchase"("departmentId");
CREATE INDEX "Purchase_type_idx"            ON "Purchase"("type");
CREATE INDEX "Purchase_categoryKey_idx"     ON "Purchase"("categoryKey");
CREATE INDEX "Purchase_paymentStatus_idx"   ON "Purchase"("paymentStatus");
CREATE INDEX "Purchase_createdByUserId_idx" ON "Purchase"("createdByUserId");
