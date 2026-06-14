-- ─── V0.7 — Communication layer ───────────────────────────────────────
-- 1. Comment gains parentId for one-level reply threading.
-- 2. New Announcement table for project-wide announcements.

-- AlterTable: Comment.parentId
ALTER TABLE "Comment" ADD COLUMN "parentId" TEXT REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Comment_parentId_idx" ON "Comment"("parentId");

-- CreateTable: Announcement
CREATE TABLE "Announcement" (
    "id"        TEXT     NOT NULL PRIMARY KEY,
    "projectId" TEXT     NOT NULL,
    "authorId"  TEXT     NOT NULL,
    "title"     TEXT     NOT NULL,
    "body"      TEXT     NOT NULL,
    "pinned"    BOOLEAN  NOT NULL DEFAULT false,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    CONSTRAINT "Announcement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Announcement_authorId_fkey"  FOREIGN KEY ("authorId")  REFERENCES "User"    ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Announcement_projectId_idx" ON "Announcement"("projectId");
CREATE INDEX "Announcement_pinned_idx"    ON "Announcement"("pinned");
CREATE INDEX "Announcement_expiresAt_idx" ON "Announcement"("expiresAt");
