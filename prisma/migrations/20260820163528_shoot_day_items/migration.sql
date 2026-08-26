-- V0.30 — Shoot Day items + call sheet branding
--
-- Steps:
--   1. Add new columns on ShootDay (branding + weather icon)
--   2. Create ShootDayItem table
--   3. Backfill ShootDayItem from existing Scene.shootOrder / shootDayId
--   4. Drop Scene.shootOrder (order now lives on ShootDayItem)

-- AlterTable
ALTER TABLE "ShootDay" ADD COLUMN     "clientLogoUrl" TEXT,
ADD COLUMN     "productionLogoUrl" TEXT,
ADD COLUMN     "weatherIcon" TEXT;

-- CreateTable
CREATE TABLE "ShootDayItem" (
    "id" TEXT NOT NULL,
    "shootDayId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "sceneId" TEXT,
    "label" TEXT,
    "startTime" TEXT,
    "endTime" TEXT,
    "durationMinutes" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShootDayItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShootDayItem_sceneId_key" ON "ShootDayItem"("sceneId");

-- CreateIndex
CREATE INDEX "ShootDayItem_shootDayId_order_idx" ON "ShootDayItem"("shootDayId", "order");

-- CreateIndex
CREATE INDEX "ShootDayItem_sceneId_idx" ON "ShootDayItem"("sceneId");

-- AddForeignKey
ALTER TABLE "ShootDayItem" ADD CONSTRAINT "ShootDayItem_shootDayId_fkey" FOREIGN KEY ("shootDayId") REFERENCES "ShootDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShootDayItem" ADD CONSTRAINT "ShootDayItem_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data migration: rebuild existing scene ordering as ShootDayItem rows.
INSERT INTO "ShootDayItem" ("id", "shootDayId", "order", "kind", "sceneId", "createdAt", "updatedAt")
SELECT
  substr(md5(random()::text || clock_timestamp()::text || s.id), 1, 24),
  s."shootDayId",
  COALESCE(s."shootOrder", 0),
  'scene',
  s.id,
  now(),
  now()
FROM "Scene" s
WHERE s."shootDayId" IS NOT NULL;

-- AlterTable — drop the now-obsolete Scene.shootOrder AFTER backfill.
ALTER TABLE "Scene" DROP COLUMN "shootOrder";
