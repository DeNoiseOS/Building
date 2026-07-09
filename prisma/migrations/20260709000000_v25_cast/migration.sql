-- V0.25 — Cast / Talent.

CREATE TABLE "Talent" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "characterName" TEXT,
  "bio" TEXT,
  "headshotUrl" TEXT,
  "contactPhone" TEXT,
  "contactEmail" TEXT,
  "agentName" TEXT,
  "agentContact" TEXT,
  "dayRate" INTEGER,
  "purchaseId" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Talent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Talent_purchaseId_key" ON "Talent"("purchaseId");
CREATE INDEX "Talent_projectId_idx" ON "Talent"("projectId");
CREATE INDEX "Talent_departmentId_idx" ON "Talent"("departmentId");

ALTER TABLE "Talent"
  ADD CONSTRAINT "Talent_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Talent"
  ADD CONSTRAINT "Talent_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Talent"
  ADD CONSTRAINT "Talent_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SceneCast" (
  "id" TEXT NOT NULL,
  "sceneId" TEXT NOT NULL,
  "talentId" TEXT NOT NULL,
  "characterName" TEXT,
  "callTime" TIMESTAMP(3),
  "notes" TEXT,
  "addedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SceneCast_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SceneCast_sceneId_talentId_key" ON "SceneCast"("sceneId", "talentId");
CREATE INDEX "SceneCast_sceneId_idx" ON "SceneCast"("sceneId");
CREATE INDEX "SceneCast_talentId_idx" ON "SceneCast"("talentId");

ALTER TABLE "SceneCast"
  ADD CONSTRAINT "SceneCast_sceneId_fkey"
  FOREIGN KEY ("sceneId") REFERENCES "Scene"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SceneCast"
  ADD CONSTRAINT "SceneCast_talentId_fkey"
  FOREIGN KEY ("talentId") REFERENCES "Talent"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SceneCast"
  ADD CONSTRAINT "SceneCast_addedByUserId_fkey"
  FOREIGN KEY ("addedByUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
