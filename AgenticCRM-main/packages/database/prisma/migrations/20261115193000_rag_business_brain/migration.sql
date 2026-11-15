-- Task 11: document metadata and permission-aware business knowledge.
ALTER TABLE "MemoryFile"
  ADD COLUMN IF NOT EXISTS "originalName" TEXT,
  ADD COLUMN IF NOT EXISTS "originalSize" INTEGER,
  ADD COLUMN IF NOT EXISTS "mimeType" TEXT,
  ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'COMPANY',
  ADD COLUMN IF NOT EXISTS "allowedUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS "MemoryFile_company_source_visibility_idx"
  ON "MemoryFile" ("companyId", "source", "visibility");
