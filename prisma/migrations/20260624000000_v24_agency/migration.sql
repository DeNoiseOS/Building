-- V0.24 — Agency Access.

CREATE TABLE "SceneComment" (
  "id" TEXT NOT NULL,
  "sceneId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SceneComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SceneComment_sceneId_idx" ON "SceneComment"("sceneId");
CREATE INDEX "SceneComment_authorId_idx" ON "SceneComment"("authorId");
ALTER TABLE "SceneComment"
  ADD CONSTRAINT "SceneComment_sceneId_fkey"
  FOREIGN KEY ("sceneId") REFERENCES "Scene"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SceneComment"
  ADD CONSTRAINT "SceneComment_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CreativeApproval" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "sceneId" TEXT,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "requestedByUserId" TEXT NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedByUserId" TEXT,
  "decidedAt" TIMESTAMP(3),
  "decisionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreativeApproval_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CreativeApproval_projectId_idx" ON "CreativeApproval"("projectId");
CREATE INDEX "CreativeApproval_sceneId_idx" ON "CreativeApproval"("sceneId");
CREATE INDEX "CreativeApproval_status_idx" ON "CreativeApproval"("status");
ALTER TABLE "CreativeApproval"
  ADD CONSTRAINT "CreativeApproval_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeApproval"
  ADD CONSTRAINT "CreativeApproval_sceneId_fkey"
  FOREIGN KEY ("sceneId") REFERENCES "Scene"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreativeApproval"
  ADD CONSTRAINT "CreativeApproval_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeApproval"
  ADD CONSTRAINT "CreativeApproval_decidedByUserId_fkey"
  FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
