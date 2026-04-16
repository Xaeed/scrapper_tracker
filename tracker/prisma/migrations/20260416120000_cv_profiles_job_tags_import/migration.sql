-- CreateTable
CREATE TABLE "CvProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileData" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "CvProfile_name_key" ON "CvProfile"("name");

-- AlterTable
ALTER TABLE "Job" ADD COLUMN "importMethod" TEXT NOT NULL DEFAULT 'scraped';
ALTER TABLE "Job" ADD COLUMN "tags" TEXT NOT NULL DEFAULT '[]';

-- Heuristic backfill: jobs created via manual add typically have no linkedinId
UPDATE "Job" SET "importMethod" = 'manual' WHERE "linkedinId" IS NULL;
