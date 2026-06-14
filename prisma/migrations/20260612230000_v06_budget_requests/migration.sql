-- ─── V0.6 — Budget Requests ────────────────────────────────────────────
-- New table: BudgetRequest. Workflow only — NOT accounting. Belongs to
-- a project and a department; created by a user (requester).

CREATE TABLE "BudgetRequest" (
    "id"              TEXT     NOT NULL PRIMARY KEY,
    "projectId"       TEXT     NOT NULL,
    "departmentId"    TEXT     NOT NULL,
    "requesterId"     TEXT     NOT NULL,

    "title"           TEXT     NOT NULL,
    "description"     TEXT,
    "vendor"          TEXT,
    "estimatedCost"   INTEGER  NOT NULL DEFAULT 0,
    "needByDate"      DATETIME,

    "status"          TEXT     NOT NULL DEFAULT 'draft',

    "submittedAt"     DATETIME,
    "approvedAt"      DATETIME,
    "rejectedAt"      DATETIME,
    "purchasedAt"     DATETIME,
    "rejectionReason" TEXT,

    "createdAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       DATETIME NOT NULL,

    CONSTRAINT "BudgetRequest_projectId_fkey"    FOREIGN KEY ("projectId")    REFERENCES "Project"    ("id") ON DELETE CASCADE  ON UPDATE CASCADE,
    CONSTRAINT "BudgetRequest_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE CASCADE  ON UPDATE CASCADE,
    CONSTRAINT "BudgetRequest_requesterId_fkey"  FOREIGN KEY ("requesterId")  REFERENCES "User"       ("id") ON DELETE CASCADE  ON UPDATE CASCADE
);

CREATE INDEX "BudgetRequest_projectId_idx"    ON "BudgetRequest"("projectId");
CREATE INDEX "BudgetRequest_departmentId_idx" ON "BudgetRequest"("departmentId");
CREATE INDEX "BudgetRequest_requesterId_idx"  ON "BudgetRequest"("requesterId");
CREATE INDEX "BudgetRequest_status_idx"       ON "BudgetRequest"("status");
