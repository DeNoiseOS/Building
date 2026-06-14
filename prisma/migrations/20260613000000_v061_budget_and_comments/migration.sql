-- ─── V0.6.1 — Project budget pool + DepartmentBudget + Comments ────────
-- Additive. No data is removed. Existing BudgetRequest rows stay (they
-- are now conceptually "Purchase Requests").

-- AlterTable: Project gains a real budget pool.
ALTER TABLE "Project" ADD COLUMN "totalBudget" INTEGER;
ALTER TABLE "Project" ADD COLUMN "currency"    TEXT NOT NULL DEFAULT 'USD';

-- CreateTable: DepartmentBudget — one row per (project, department).
CREATE TABLE "DepartmentBudget" (
    "id"              TEXT     NOT NULL PRIMARY KEY,
    "projectId"       TEXT     NOT NULL,
    "departmentId"    TEXT     NOT NULL,
    "allocatedAmount" INTEGER  NOT NULL DEFAULT 0,
    "requestedAmount" INTEGER,
    "approvedAmount"  INTEGER,
    "status"          TEXT     NOT NULL DEFAULT 'pending',
    "reason"          TEXT,
    "approvedAt"      DATETIME,
    "rejectedAt"      DATETIME,
    "createdAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       DATETIME NOT NULL,

    CONSTRAINT "DepartmentBudget_projectId_fkey"    FOREIGN KEY ("projectId")    REFERENCES "Project"    ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DepartmentBudget_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DepartmentBudget_departmentId_key" ON "DepartmentBudget"("departmentId");
CREATE INDEX "DepartmentBudget_projectId_idx" ON "DepartmentBudget"("projectId");
CREATE INDEX "DepartmentBudget_status_idx"    ON "DepartmentBudget"("status");

-- CreateTable: Comment — polymorphic by (targetType, targetId).
CREATE TABLE "Comment" (
    "id"         TEXT     NOT NULL PRIMARY KEY,
    "projectId"  TEXT     NOT NULL,
    "authorId"   TEXT     NOT NULL,
    "targetType" TEXT     NOT NULL,
    "targetId"   TEXT     NOT NULL,
    "body"       TEXT     NOT NULL,
    "createdAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  DATETIME NOT NULL,

    CONSTRAINT "Comment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_authorId_fkey"  FOREIGN KEY ("authorId")  REFERENCES "User"    ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Comment_targetType_targetId_idx" ON "Comment"("targetType", "targetId");
CREATE INDEX "Comment_projectId_idx"           ON "Comment"("projectId");
CREATE INDEX "Comment_authorId_idx"            ON "Comment"("authorId");
