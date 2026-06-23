-- V0.20 — Production Bible.
CREATE TABLE "BibleEntry" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "departmentId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "url" TEXT,
  "body" TEXT,
  "type" TEXT NOT NULL DEFAULT 'link',
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "addedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BibleEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BibleEntry_projectId_idx" ON "BibleEntry"("projectId");
CREATE INDEX "BibleEntry_departmentId_idx" ON "BibleEntry"("departmentId");
CREATE INDEX "BibleEntry_pinned_idx" ON "BibleEntry"("pinned");

ALTER TABLE "BibleEntry"
  ADD CONSTRAINT "BibleEntry_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BibleEntry"
  ADD CONSTRAINT "BibleEntry_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BibleEntry"
  ADD CONSTRAINT "BibleEntry_addedByUserId_fkey"
  FOREIGN KEY ("addedByUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
