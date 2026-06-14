-- AlterTable
ALTER TABLE "Activity" ADD COLUMN "actorId" TEXT;
ALTER TABLE "Activity" ADD COLUMN "actorName" TEXT;

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectInvitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectInvitation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectInvitation_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");

-- CreateIndex
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");

-- CreateIndex
CREATE INDEX "ProjectInvitation_email_idx" ON "ProjectInvitation"("email");

-- CreateIndex
CREATE INDEX "ProjectInvitation_projectId_idx" ON "ProjectInvitation"("projectId");

-- CreateIndex
CREATE INDEX "ProjectInvitation_status_idx" ON "ProjectInvitation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectInvitation_projectId_email_key" ON "ProjectInvitation"("projectId", "email");

-- CreateIndex
CREATE INDEX "Activity_actorId_idx" ON "Activity"("actorId");

-- ─── V0.2 data backfill ──────────────────────────────────────────────────
-- 1. Auto-create a ProjectMember row for the owner of every existing project.
--    The owner's role on the project is the project's primary role.
INSERT INTO "ProjectMember" ("id", "projectId", "userId", "role", "joinedAt")
SELECT
  'mem_' || hex(randomblob(8)) || hex(randomblob(4)),
  p."id",
  p."userId",
  p."role",
  p."createdAt"
FROM "Project" p
WHERE NOT EXISTS (
  SELECT 1 FROM "ProjectMember" pm
  WHERE pm."projectId" = p."id" AND pm."userId" = p."userId"
);

-- 2. Backfill Activity.actorId/actorName from the project owner.
--    All V0.1 activity was authored by the single user (the project owner).
UPDATE "Activity"
SET
  "actorId"   = (SELECT p."userId" FROM "Project" p WHERE p."id" = "Activity"."projectId"),
  "actorName" = (SELECT u."name" FROM "Project" p JOIN "User" u ON u."id" = p."userId" WHERE p."id" = "Activity"."projectId")
WHERE "actorId" IS NULL;
