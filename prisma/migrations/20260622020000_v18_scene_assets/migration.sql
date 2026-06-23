-- V0.18 — SceneAsset (scene ↔ equipment link) + Equipment.quantity.

-- Equipment now carries an inventory count. Default 1 keeps every
-- existing row a single-piece item; new bulk purchases set it from
-- purchase.quantity.
ALTER TABLE "Equipment"
  ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1;

-- SceneAsset: one row per (scene, equipment) link.
CREATE TABLE "SceneAsset" (
  "id" TEXT NOT NULL,
  "sceneId" TEXT NOT NULL,
  "equipmentId" TEXT NOT NULL,
  "quantityNeeded" INTEGER NOT NULL DEFAULT 1,
  "notes" TEXT,
  "addedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SceneAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SceneAsset_sceneId_equipmentId_key"
  ON "SceneAsset"("sceneId", "equipmentId");
CREATE INDEX "SceneAsset_sceneId_idx" ON "SceneAsset"("sceneId");
CREATE INDEX "SceneAsset_equipmentId_idx" ON "SceneAsset"("equipmentId");

ALTER TABLE "SceneAsset"
  ADD CONSTRAINT "SceneAsset_sceneId_fkey"
  FOREIGN KEY ("sceneId") REFERENCES "Scene"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SceneAsset"
  ADD CONSTRAINT "SceneAsset_equipmentId_fkey"
  FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SceneAsset"
  ADD CONSTRAINT "SceneAsset_addedByUserId_fkey"
  FOREIGN KEY ("addedByUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
