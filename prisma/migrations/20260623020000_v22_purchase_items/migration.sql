-- V0.22 — Purchase line items.

CREATE TABLE "PurchaseItem" (
  "id" TEXT NOT NULL,
  "purchaseId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitPrice" INTEGER,
  "lineTotal" INTEGER NOT NULL,
  "equipmentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PurchaseItem_equipmentId_key"
  ON "PurchaseItem"("equipmentId");
CREATE INDEX "PurchaseItem_purchaseId_idx" ON "PurchaseItem"("purchaseId");

ALTER TABLE "PurchaseItem"
  ADD CONSTRAINT "PurchaseItem_purchaseId_fkey"
  FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Back-fill: every existing Purchase becomes a 1-item invoice.
-- We mirror name / quantity / amount and preserve the existing
-- equipmentId link by transferring it onto the new PurchaseItem
-- row (the Purchase.equipmentId column stays in place for legacy
-- code paths; new code reads via PurchaseItem.equipmentId).
INSERT INTO "PurchaseItem"
  ("id", "purchaseId", "name", "quantity", "unitPrice", "lineTotal",
   "equipmentId", "createdAt", "updatedAt")
SELECT
  'pi_' || substring(md5(random()::text || p."id") for 24),
  p."id",
  p."name",
  COALESCE(p."quantity", 1),
  CASE
    WHEN COALESCE(p."quantity", 1) > 0
      THEN p."amount" / COALESCE(p."quantity", 1)
    ELSE NULL
  END,
  p."amount",
  p."equipmentId",
  p."createdAt",
  p."updatedAt"
FROM "Purchase" p;
