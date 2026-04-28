-- CreateTable: singleton row (id=1) — the HTML template used as style reference for PDF CV conversion
CREATE TABLE "SampleCv" (
    "id"        INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
    "fileName"  TEXT NOT NULL,
    "fileData"  TEXT NOT NULL,
    "mimeType"  TEXT NOT NULL DEFAULT 'text/html',
    "updatedAt" DATETIME NOT NULL
);
