-- Add jobTypes and workplaceTypes columns to ScraperConfig
-- Keywords/locations shape migration (string[] → {label,enabled}[]) is handled at runtime in getOrCreateConfig()
ALTER TABLE "ScraperConfig" ADD COLUMN "jobTypes" TEXT NOT NULL DEFAULT '["F","C"]';
ALTER TABLE "ScraperConfig" ADD COLUMN "workplaceTypes" TEXT NOT NULL DEFAULT '["1","2","3"]';
