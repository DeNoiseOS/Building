-- ─── V0.5 Workflow layer ────────────────────────────────────────────────
-- 1. Task gets creatorId / approverId (optional)
-- 2. New Notification table
-- 3. Backfill: creatorId = project owner for legacy tasks

-- AlterTable: Task new optional FKs
ALTER TABLE "Task" ADD COLUMN "creatorId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD COLUMN "approverId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Task_creatorId_idx" ON "Task"("creatorId");
CREATE INDEX "Task_approverId_idx" ON "Task"("approverId");

-- CreateTable: Notification
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "metadata" TEXT,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- ─── Backfill: Task.creatorId = project owner ──────────────────────────
-- Every legacy task pre-V0.5 was authored implicitly by the project owner
-- (single-user era) or by an unknown actor (V0.2-V1.0A); attribute to the
-- owner so visibility / "created by me" filters behave sensibly.
UPDATE "Task"
SET "creatorId" = (
  SELECT p."userId" FROM "Project" p WHERE p."id" = "Task"."projectId"
)
WHERE "creatorId" IS NULL;
