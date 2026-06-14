-- ─── V1.0A Departments foundation ──────────────────────────────────────
-- New: Department, DepartmentMember.
-- Existing: Task / Note / Reference get a nullable departmentId FK.
-- Backfill: seed Department per (project, ProjectMember.role); join
-- DepartmentMember rows from ProjectMember; map Task/Note/Reference
-- section keys to their owning department via a reverse map.

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Department_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Department_projectId_key_key" ON "Department"("projectId", "key");
CREATE INDEX "Department_projectId_idx" ON "Department"("projectId");

-- CreateTable
CREATE TABLE "DepartmentMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "departmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DepartmentMember_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DepartmentMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DepartmentMember_departmentId_userId_key" ON "DepartmentMember"("departmentId", "userId");
CREATE INDEX "DepartmentMember_departmentId_idx" ON "DepartmentMember"("departmentId");
CREATE INDEX "DepartmentMember_userId_idx" ON "DepartmentMember"("userId");

-- AlterTable: add nullable departmentId on Task / Note / Reference
ALTER TABLE "Task" ADD COLUMN "departmentId" TEXT REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Note" ADD COLUMN "departmentId" TEXT REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Reference" ADD COLUMN "departmentId" TEXT REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Task_departmentId_idx" ON "Task"("departmentId");
CREATE INDEX "Note_departmentId_idx" ON "Note"("departmentId");
CREATE INDEX "Reference_departmentId_idx" ON "Reference"("departmentId");

-- ─── Backfill 1: seed Departments per (project, distinct ProjectMember.role) ─
-- One Department row per (projectId, role) where any ProjectMember has that role.
-- key = role slug, kind = role slug, name = human label via CASE.
INSERT INTO "Department" ("id", "projectId", "key", "name", "kind", "order", "createdAt", "updatedAt")
SELECT
  'dept_' || hex(randomblob(8)) || hex(randomblob(4)) AS id,
  pm."projectId",
  pm."role" AS key,
  CASE pm."role"
    WHEN 'director' THEN 'Director'
    WHEN 'assistant_director' THEN 'Assistant Director'
    WHEN 'art_director' THEN 'Art Department'
    WHEN 'producer' THEN 'Producer'
    WHEN 'camera_department' THEN 'Camera Department'
    WHEN 'sound_department' THEN 'Sound Department'
    WHEN 'editor' THEN 'Editorial'
    WHEN 'location_manager' THEN 'Locations'
    WHEN 'casting_manager' THEN 'Casting'
    ELSE pm."role"
  END AS name,
  pm."role" AS kind,
  0 AS "order",
  CURRENT_TIMESTAMP AS createdAt,
  CURRENT_TIMESTAMP AS updatedAt
FROM (
  SELECT DISTINCT "projectId", "role" FROM "ProjectMember"
) pm
WHERE NOT EXISTS (
  SELECT 1 FROM "Department" d
  WHERE d."projectId" = pm."projectId" AND d."key" = pm."role"
);

-- ─── Backfill 2: every ProjectMember becomes a DepartmentMember ─────────
-- of the Department matching their role in the same project. Project owner
-- gets role="lead", others get "member".
INSERT INTO "DepartmentMember" ("id", "departmentId", "userId", "role", "joinedAt")
SELECT
  'dmem_' || hex(randomblob(8)) || hex(randomblob(4)) AS id,
  d."id" AS departmentId,
  pm."userId",
  CASE WHEN p."userId" = pm."userId" THEN 'lead' ELSE 'member' END AS role,
  pm."joinedAt"
FROM "ProjectMember" pm
JOIN "Department" d ON d."projectId" = pm."projectId" AND d."key" = pm."role"
JOIN "Project" p ON p."id" = pm."projectId"
WHERE NOT EXISTS (
  SELECT 1 FROM "DepartmentMember" dm
  WHERE dm."departmentId" = d."id" AND dm."userId" = pm."userId"
);

-- ─── Backfill 3: map Task.section → Task.departmentId ───────────────────
-- The section→role map embedded here mirrors lib/sections.ts. Any section
-- not in this map (or NULL section) leaves departmentId NULL.
UPDATE "Task"
SET "departmentId" = (
  SELECT d."id" FROM "Department" d
  WHERE d."projectId" = "Task"."projectId"
    AND d."key" = CASE "Task"."section"
      WHEN 'director_notes' THEN 'director'
      WHEN 'creative_notes' THEN 'director'
      WHEN 'director_references' THEN 'director'
      WHEN 'director_tasks' THEN 'director'
      WHEN 'schedule' THEN 'assistant_director'
      WHEN 'crew_notes' THEN 'assistant_director'
      WHEN 'followups' THEN 'assistant_director'
      WHEN 'production_tasks' THEN 'assistant_director'
      WHEN 'moodboards' THEN 'art_director'
      WHEN 'art_references' THEN 'art_director'
      WHEN 'props' THEN 'art_director'
      WHEN 'art_tasks' THEN 'art_director'
      WHEN 'budget_notes' THEN 'producer'
      WHEN 'vendor_notes' THEN 'producer'
      WHEN 'producer_tasks' THEN 'producer'
      WHEN 'camera_notes' THEN 'camera_department'
      WHEN 'camera_references' THEN 'camera_department'
      WHEN 'camera_tasks' THEN 'camera_department'
      WHEN 'sound_notes' THEN 'sound_department'
      WHEN 'sound_references' THEN 'sound_department'
      WHEN 'sound_tasks' THEN 'sound_department'
      WHEN 'edit_notes' THEN 'editor'
      WHEN 'edit_references' THEN 'editor'
      WHEN 'edit_tasks' THEN 'editor'
      WHEN 'location_notes' THEN 'location_manager'
      WHEN 'location_references' THEN 'location_manager'
      WHEN 'location_tasks' THEN 'location_manager'
      WHEN 'casting_notes' THEN 'casting_manager'
      WHEN 'casting_references' THEN 'casting_manager'
      WHEN 'casting_tasks' THEN 'casting_manager'
      ELSE NULL
    END
)
WHERE "departmentId" IS NULL AND "section" IS NOT NULL;

UPDATE "Note"
SET "departmentId" = (
  SELECT d."id" FROM "Department" d
  WHERE d."projectId" = "Note"."projectId"
    AND d."key" = CASE "Note"."section"
      WHEN 'director_notes' THEN 'director'
      WHEN 'creative_notes' THEN 'director'
      WHEN 'director_references' THEN 'director'
      WHEN 'director_tasks' THEN 'director'
      WHEN 'schedule' THEN 'assistant_director'
      WHEN 'crew_notes' THEN 'assistant_director'
      WHEN 'followups' THEN 'assistant_director'
      WHEN 'production_tasks' THEN 'assistant_director'
      WHEN 'moodboards' THEN 'art_director'
      WHEN 'art_references' THEN 'art_director'
      WHEN 'props' THEN 'art_director'
      WHEN 'art_tasks' THEN 'art_director'
      WHEN 'budget_notes' THEN 'producer'
      WHEN 'vendor_notes' THEN 'producer'
      WHEN 'producer_tasks' THEN 'producer'
      WHEN 'camera_notes' THEN 'camera_department'
      WHEN 'camera_references' THEN 'camera_department'
      WHEN 'camera_tasks' THEN 'camera_department'
      WHEN 'sound_notes' THEN 'sound_department'
      WHEN 'sound_references' THEN 'sound_department'
      WHEN 'sound_tasks' THEN 'sound_department'
      WHEN 'edit_notes' THEN 'editor'
      WHEN 'edit_references' THEN 'editor'
      WHEN 'edit_tasks' THEN 'editor'
      WHEN 'location_notes' THEN 'location_manager'
      WHEN 'location_references' THEN 'location_manager'
      WHEN 'location_tasks' THEN 'location_manager'
      WHEN 'casting_notes' THEN 'casting_manager'
      WHEN 'casting_references' THEN 'casting_manager'
      WHEN 'casting_tasks' THEN 'casting_manager'
      ELSE NULL
    END
)
WHERE "departmentId" IS NULL;

UPDATE "Reference"
SET "departmentId" = (
  SELECT d."id" FROM "Department" d
  WHERE d."projectId" = "Reference"."projectId"
    AND d."key" = CASE "Reference"."section"
      WHEN 'director_notes' THEN 'director'
      WHEN 'creative_notes' THEN 'director'
      WHEN 'director_references' THEN 'director'
      WHEN 'director_tasks' THEN 'director'
      WHEN 'schedule' THEN 'assistant_director'
      WHEN 'crew_notes' THEN 'assistant_director'
      WHEN 'followups' THEN 'assistant_director'
      WHEN 'production_tasks' THEN 'assistant_director'
      WHEN 'moodboards' THEN 'art_director'
      WHEN 'art_references' THEN 'art_director'
      WHEN 'props' THEN 'art_director'
      WHEN 'art_tasks' THEN 'art_director'
      WHEN 'budget_notes' THEN 'producer'
      WHEN 'vendor_notes' THEN 'producer'
      WHEN 'producer_tasks' THEN 'producer'
      WHEN 'camera_notes' THEN 'camera_department'
      WHEN 'camera_references' THEN 'camera_department'
      WHEN 'camera_tasks' THEN 'camera_department'
      WHEN 'sound_notes' THEN 'sound_department'
      WHEN 'sound_references' THEN 'sound_department'
      WHEN 'sound_tasks' THEN 'sound_department'
      WHEN 'edit_notes' THEN 'editor'
      WHEN 'edit_references' THEN 'editor'
      WHEN 'edit_tasks' THEN 'editor'
      WHEN 'location_notes' THEN 'location_manager'
      WHEN 'location_references' THEN 'location_manager'
      WHEN 'location_tasks' THEN 'location_manager'
      WHEN 'casting_notes' THEN 'casting_manager'
      WHEN 'casting_references' THEN 'casting_manager'
      WHEN 'casting_tasks' THEN 'casting_manager'
      ELSE NULL
    END
)
WHERE "departmentId" IS NULL;
