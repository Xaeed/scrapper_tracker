-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "linkedinId" TEXT,
    "link" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT,
    "postedAt" DATETIME,
    "searchKeyword" TEXT,
    "searchLocation" TEXT,
    "scrapedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Job_linkedinId_key" ON "Job"("linkedinId");

-- CreateIndex
CREATE UNIQUE INDEX "Job_link_key" ON "Job"("link");
