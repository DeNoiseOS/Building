-- V0.17 — Scene Planning & Department Workflow.

CREATE TABLE "Scene" (
  "id"               TEXT PRIMARY KEY,
  "projectId"        TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "number"           TEXT NOT NULL,
  "title"            TEXT NOT NULL,
  "description"      TEXT,
  "location"         TEXT,
  "type"             TEXT NOT NULL DEFAULT 'INT',
  "timeOfDay"        TEXT NOT NULL DEFAULT 'day',
  "status"           TEXT NOT NULL DEFAULT 'draft',
  "notes"            TEXT,
  "attachments"      JSONB,
  "createdByUserId"  TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "updatedByUserId"  TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "Scene_projectId_number_key" ON "Scene"("projectId", "number");
CREATE INDEX "Scene_projectId_idx" ON "Scene"("projectId");
CREATE INDEX "Scene_status_idx"    ON "Scene"("status");
CREATE INDEX "Scene_type_idx"      ON "Scene"("type");
CREATE INDEX "Scene_timeOfDay_idx" ON "Scene"("timeOfDay");

CREATE TABLE "SceneDepartment" (
  "id"               TEXT PRIMARY KEY,
  "sceneId"          TEXT NOT NULL REFERENCES "Scene"("id") ON DELETE CASCADE,
  "departmentId"     TEXT NOT NULL REFERENCES "Department"("id") ON DELETE CASCADE,
  "enabled"          BOOLEAN NOT NULL DEFAULT TRUE,
  "status"           TEXT NOT NULL DEFAULT 'not_started',
  "approvalStatus"   TEXT NOT NULL DEFAULT 'pending_review',
  "requirements"     TEXT,
  "notes"            TEXT,
  "attachments"      JSONB,
  "approvedByUserId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "approvedAt"       TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "SceneDepartment_sceneId_departmentId_key" ON "SceneDepartment"("sceneId", "departmentId");
CREATE INDEX "SceneDepartment_sceneId_idx"        ON "SceneDepartment"("sceneId");
CREATE INDEX "SceneDepartment_departmentId_idx"   ON "SceneDepartment"("departmentId");
CREATE INDEX "SceneDepartment_status_idx"         ON "SceneDepartment"("status");
CREATE INDEX "SceneDepartment_approvalStatus_idx" ON "SceneDepartment"("approvalStatus");
