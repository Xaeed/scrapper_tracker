-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ScraperConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "keywords" TEXT NOT NULL,
    "locations" TEXT NOT NULL,
    "excludedCompanies" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ScraperConfig" ("id", "keywords", "locations", "updatedAt") SELECT "id", "keywords", "locations", "updatedAt" FROM "ScraperConfig";
DROP TABLE "ScraperConfig";
ALTER TABLE "new_ScraperConfig" RENAME TO "ScraperConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
