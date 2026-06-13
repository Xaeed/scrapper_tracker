-- AlterTable
ALTER TABLE "Job" ADD COLUMN "appliedProfiles" TEXT NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "JobCv" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "cvProfileId" TEXT,
    "profileKey" TEXT NOT NULL,
    "profileName" TEXT NOT NULL,
    "cvHtml" TEXT NOT NULL,
    "fileName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "JobCv_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "JobCv_jobId_profileKey_key" ON "JobCv"("jobId", "profileKey");
