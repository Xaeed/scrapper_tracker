-- CreateTable
CREATE TABLE "ScraperConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "keywords" TEXT NOT NULL,
    "locations" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
