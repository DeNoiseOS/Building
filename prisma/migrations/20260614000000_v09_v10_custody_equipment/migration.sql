-- ─── V0.9 — Custody + expense linking ───────────────────────────────
ALTER TABLE "BudgetRequest" ADD COLUMN "custodyId" TEXT
  REFERENCES "Custody"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "BudgetRequest_custodyId_idx" ON "BudgetRequest"("custodyId");

CREATE TABLE "Custody" (
    "id"                    TEXT     NOT NULL PRIMARY KEY,
    "projectId"             TEXT     NOT NULL,
    "departmentId"          TEXT     NOT NULL,
    "holderUserId"          TEXT     NOT NULL,
    "issuedByUserId"        TEXT     NOT NULL,
    "amount"                INTEGER  NOT NULL,
    "currency"              TEXT     NOT NULL DEFAULT 'USD',
    "status"                TEXT     NOT NULL DEFAULT 'active',
    "settlementRequestedAt" DATETIME,
    "settlementStatus"      TEXT,
    "issuedAt"              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt"             DATETIME,
    "notes"                 TEXT,
    "createdAt"             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             DATETIME NOT NULL,
    CONSTRAINT "Custody_projectId_fkey"    FOREIGN KEY ("projectId")    REFERENCES "Project"    ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Custody_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Custody_holderUserId_fkey" FOREIGN KEY ("holderUserId") REFERENCES "User"       ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Custody_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "User"   ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Custody_projectId_idx"    ON "Custody"("projectId");
CREATE INDEX "Custody_departmentId_idx" ON "Custody"("departmentId");
CREATE INDEX "Custody_holderUserId_idx" ON "Custody"("holderUserId");
CREATE INDEX "Custody_status_idx"       ON "Custody"("status");

-- ─── V0.10 — Equipment / Assignment / Damage Report ─────────────────
CREATE TABLE "Equipment" (
    "id"           TEXT     NOT NULL PRIMARY KEY,
    "projectId"    TEXT     NOT NULL,
    "departmentId" TEXT     NOT NULL,
    "name"         TEXT     NOT NULL,
    "serialNumber" TEXT,
    "category"     TEXT,
    "notes"        TEXT,
    "status"       TEXT     NOT NULL DEFAULT 'available',
    "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    DATETIME NOT NULL,
    CONSTRAINT "Equipment_projectId_fkey"    FOREIGN KEY ("projectId")    REFERENCES "Project"    ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Equipment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Equipment_projectId_idx"    ON "Equipment"("projectId");
CREATE INDEX "Equipment_departmentId_idx" ON "Equipment"("departmentId");
CREATE INDEX "Equipment_status_idx"       ON "Equipment"("status");

CREATE TABLE "EquipmentAssignment" (
    "id"               TEXT     NOT NULL PRIMARY KEY,
    "equipmentId"      TEXT     NOT NULL,
    "assignedToUserId" TEXT     NOT NULL,
    "assignedByUserId" TEXT     NOT NULL,
    "assignedAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt"       DATETIME,
    "notes"            TEXT,
    CONSTRAINT "EquipmentAssignment_equipmentId_fkey"      FOREIGN KEY ("equipmentId")      REFERENCES "Equipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EquipmentAssignment_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"      ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EquipmentAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"      ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "EquipmentAssignment_equipmentId_idx"      ON "EquipmentAssignment"("equipmentId");
CREATE INDEX "EquipmentAssignment_assignedToUserId_idx" ON "EquipmentAssignment"("assignedToUserId");
CREATE INDEX "EquipmentAssignment_returnedAt_idx"       ON "EquipmentAssignment"("returnedAt");

CREATE TABLE "DamageReport" (
    "id"               TEXT     NOT NULL PRIMARY KEY,
    "equipmentId"      TEXT     NOT NULL,
    "reportedByUserId" TEXT     NOT NULL,
    "description"      TEXT     NOT NULL,
    "severity"         TEXT     NOT NULL DEFAULT 'low',
    "status"           TEXT     NOT NULL DEFAULT 'open',
    "createdAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt"       DATETIME,
    "resolution"       TEXT,
    CONSTRAINT "DamageReport_equipmentId_fkey"      FOREIGN KEY ("equipmentId")      REFERENCES "Equipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DamageReport_reportedByUserId_fkey" FOREIGN KEY ("reportedByUserId") REFERENCES "User"      ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "DamageReport_equipmentId_idx"      ON "DamageReport"("equipmentId");
CREATE INDEX "DamageReport_reportedByUserId_idx" ON "DamageReport"("reportedByUserId");
CREATE INDEX "DamageReport_status_idx"           ON "DamageReport"("status");
CREATE INDEX "DamageReport_severity_idx"         ON "DamageReport"("severity");
