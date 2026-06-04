-- ============================================================
-- Livora OS: Company Hierarchy Migration (MASTER database)
-- Apply this in the MASTER database via Supabase SQL Editor
-- (This is the main Supabase project DB — same credentials)
-- ============================================================

-- 1. Create CompanyType enum
DO $$ BEGIN
  CREATE TYPE "CompanyType" AS ENUM ('PARENT', 'SUBSIDIARY', 'STANDALONE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add hierarchy and company detail fields to companies table
ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "type"           "CompanyType" NOT NULL DEFAULT 'STANDALONE',
  ADD COLUMN IF NOT EXISTS "parentId"       TEXT,
  ADD COLUMN IF NOT EXISTS "description"    TEXT,
  ADD COLUMN IF NOT EXISTS "address"        TEXT,
  ADD COLUMN IF NOT EXISTS "city"           TEXT,
  ADD COLUMN IF NOT EXISTS "state"          TEXT,
  ADD COLUMN IF NOT EXISTS "country"        TEXT,
  ADD COLUMN IF NOT EXISTS "phone"          TEXT,
  ADD COLUMN IF NOT EXISTS "email"          TEXT,
  ADD COLUMN IF NOT EXISTS "website"        TEXT,
  ADD COLUMN IF NOT EXISTS "registrationNo" TEXT,
  ADD COLUMN IF NOT EXISTS "taxId"          TEXT;

-- 3. Add foreign key for parent company
ALTER TABLE "companies"
  ADD CONSTRAINT "companies_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "companies"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Add indexes
CREATE INDEX IF NOT EXISTS "companies_parentId_idx" ON "companies"("parentId");
CREATE INDEX IF NOT EXISTS "companies_type_idx"     ON "companies"("type");
