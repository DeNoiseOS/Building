-- V0.16 — Asset Management 2.0.
-- All additive. Existing rows stay valid.

-- Equipment: asset profile fields.
ALTER TABLE "Equipment"
  ADD COLUMN "purchaseDate" TIMESTAMP(3),
  ADD COLUMN "purchaseCost" INTEGER;

-- EquipmentAssignment: support dept assignments + check-in fields.
ALTER TABLE "EquipmentAssignment"
  ALTER COLUMN "assignedToUserId" DROP NOT NULL;

ALTER TABLE "EquipmentAssignment"
  ADD COLUMN "assignedToDepartmentId" TEXT REFERENCES "Department"("id") ON DELETE SET NULL,
  ADD COLUMN "expectedReturnDate"     TIMESTAMP(3),
  ADD COLUMN "returnedByUserId"       TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  ADD COLUMN "returnCondition"        TEXT;

CREATE INDEX "EquipmentAssignment_assignedToDepartmentId_idx" ON "EquipmentAssignment"("assignedToDepartmentId");
CREATE INDEX "EquipmentAssignment_expectedReturnDate_idx"     ON "EquipmentAssignment"("expectedReturnDate");

-- MaintenanceRecord (new).
CREATE TABLE "MaintenanceRecord" (
  "id"              TEXT PRIMARY KEY,
  "equipmentId"     TEXT NOT NULL REFERENCES "Equipment"("id") ON DELETE CASCADE,
  "createdByUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "type"            TEXT NOT NULL,
  "vendor"          TEXT,
  "cost"            INTEGER,
  "notes"           TEXT,
  "startedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"     TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL
);

CREATE INDEX "MaintenanceRecord_equipmentId_idx"   ON "MaintenanceRecord"("equipmentId");
CREATE INDEX "MaintenanceRecord_type_idx"          ON "MaintenanceRecord"("type");
CREATE INDEX "MaintenanceRecord_completedAt_idx"   ON "MaintenanceRecord"("completedAt");
