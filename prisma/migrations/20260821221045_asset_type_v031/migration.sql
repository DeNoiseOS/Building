-- AlterTable
ALTER TABLE "Equipment" ADD COLUMN     "assetType" TEXT DEFAULT 'general';

-- AlterTable
ALTER TABLE "SceneAsset" ADD COLUMN     "assetTypeOverride" TEXT;
