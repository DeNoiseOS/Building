-- AlterTable
ALTER TABLE "Scene" ADD COLUMN     "estimatedMinutes" INTEGER,
ADD COLUMN     "pagesCount" TEXT,
ADD COLUMN     "shootDayId" TEXT,
ADD COLUMN     "shootOrder" INTEGER;

-- CreateTable
CREATE TABLE "ShootDay" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "label" TEXT,
    "generalCallTime" TEXT,
    "wrapTime" TEXT,
    "locationName" TEXT,
    "locationAddress" TEXT,
    "weather" TEXT,
    "sunrise" TEXT,
    "sunset" TEXT,
    "hospitalName" TEXT,
    "hospitalPhone" TEXT,
    "emergencyContact" TEXT,
    "mealTimes" JSONB,
    "generalNotes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShootDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShootDay_projectId_idx" ON "ShootDay"("projectId");

-- CreateIndex
CREATE INDEX "ShootDay_date_idx" ON "ShootDay"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ShootDay_projectId_date_key" ON "ShootDay"("projectId", "date");

-- CreateIndex
CREATE INDEX "Scene_shootDayId_idx" ON "Scene"("shootDayId");

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_shootDayId_fkey" FOREIGN KEY ("shootDayId") REFERENCES "ShootDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShootDay" ADD CONSTRAINT "ShootDay_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShootDay" ADD CONSTRAINT "ShootDay_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
