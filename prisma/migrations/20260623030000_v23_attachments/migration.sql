-- V0.23 — File Uploads.
CREATE TABLE "Attachment" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "ownerType" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "storagePath" TEXT NOT NULL,
  "thumbnailPath" TEXT,
  "uploadedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Attachment_projectId_idx" ON "Attachment"("projectId");
CREATE INDEX "Attachment_ownerType_ownerId_idx"
  ON "Attachment"("ownerType", "ownerId");

ALTER TABLE "Attachment"
  ADD CONSTRAINT "Attachment_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Attachment"
  ADD CONSTRAINT "Attachment_uploadedByUserId_fkey"
  FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
