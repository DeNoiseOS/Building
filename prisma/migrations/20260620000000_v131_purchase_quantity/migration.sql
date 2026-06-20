-- V0.13.1 — Purchase line quantity (defaults to 1 for existing rows)
ALTER TABLE "Purchase" ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1;
