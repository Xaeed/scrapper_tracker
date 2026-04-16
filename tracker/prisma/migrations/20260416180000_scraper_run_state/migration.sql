-- CreateTable
CREATE TABLE "ScraperRunState" (
    "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
    "running" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "lastExitCode" INTEGER,
    "lastError" TEXT
);

INSERT INTO "ScraperRunState" ("id", "running") VALUES (1, 0);
