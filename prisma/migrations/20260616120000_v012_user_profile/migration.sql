-- V0.12 — User profile / talent foundation.
-- All fields are nullable / default-empty so existing rows stay valid.

ALTER TABLE "User"
  ADD COLUMN     "profileImage"      TEXT,
  ADD COLUMN     "primaryRole"       TEXT,
  ADD COLUMN     "additionalRoles"   TEXT[]   NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN     "experienceLevel"   TEXT,
  ADD COLUMN     "location"          TEXT,
  ADD COLUMN     "languages"         TEXT[]   NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN     "contactPhone"      TEXT,
  ADD COLUMN     "contactWebsite"    TEXT,
  ADD COLUMN     "portfolioLinks"    JSONB,
  ADD COLUMN     "profileSkippedAt"  TIMESTAMP(3);

-- Indexes to make crew discovery (future talent search) cheap.
CREATE INDEX "User_primaryRole_idx" ON "User"("primaryRole");
CREATE INDEX "User_location_idx"    ON "User"("location");
