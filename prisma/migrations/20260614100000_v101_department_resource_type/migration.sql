-- ─── V0.10.1 — Department-first refactor (additive) ────────────────────
-- Adds a `resourceType` column to Department, then backfills it from the
-- existing `kind` column using the V0.10.1 registry mapping.
--
-- No data is deleted. Existing Department rows keep their `kind` and
-- `key`; only the `resourceType` field is set. The application reads
-- through `lib/department-registry.ts` which handles legacy kinds.

ALTER TABLE "Department" ADD COLUMN "resourceType" TEXT NOT NULL DEFAULT 'equipment';

-- Backfill via CASE: V0.10.1 registry resource types per (legacy or new) kind.
UPDATE "Department" SET "resourceType" = CASE "kind"
  -- Director Department (covers legacy 'assistant_director' alias)
  WHEN 'director'             THEN 'documents'
  WHEN 'assistant_director'   THEN 'documents'
  -- Production Department
  WHEN 'producer'             THEN 'documents'
  -- Art Department
  WHEN 'art_director'         THEN 'props'
  -- Camera Department (covers legacy 'camera_department')
  WHEN 'camera_department'    THEN 'equipment'
  WHEN 'director_of_photography' THEN 'equipment'
  -- Sound Department (covers legacy 'sound_department')
  WHEN 'sound_department'     THEN 'equipment'
  WHEN 'sound_mixer'          THEN 'equipment'
  -- Post Production (covers legacy 'editor')
  WHEN 'editor'               THEN 'deliverables'
  WHEN 'post_supervisor'      THEN 'deliverables'
  -- Locations
  WHEN 'location_manager'     THEN 'location_assets'
  -- Casting (covers legacy 'casting_manager')
  WHEN 'casting_manager'      THEN 'talent'
  WHEN 'casting_director'     THEN 'talent'
  ELSE 'equipment'
END;
