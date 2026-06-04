-- ============================================================
-- Livora OS: Branch System Migration
-- Apply this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Add BRANCH_MANAGER to UserRole enum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'BRANCH_MANAGER';

-- 2. Create branches table
CREATE TABLE IF NOT EXISTS "branches" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name"        TEXT NOT NULL,
  "code"        TEXT NOT NULL,
  "description" TEXT,
  "address"     TEXT NOT NULL,
  "city"        TEXT NOT NULL,
  "state"       TEXT NOT NULL,
  "country"     TEXT NOT NULL DEFAULT 'Nigeria',
  "latitude"    DOUBLE PRECISION,
  "longitude"   DOUBLE PRECISION,
  "phone"       TEXT,
  "email"       TEXT,
  "managerId"   TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "branches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "branches_code_key" UNIQUE ("code"),
  CONSTRAINT "branches_managerId_key" UNIQUE ("managerId")
);

CREATE INDEX IF NOT EXISTS "branches_city_idx"     ON "branches"("city");
CREATE INDEX IF NOT EXISTS "branches_isActive_idx" ON "branches"("isActive");

-- 3. Add branchId to users table
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "branchId" TEXT;

-- 4. Add branchId and deletedAt to properties table
ALTER TABLE "properties"
  ADD COLUMN IF NOT EXISTS "branchId"   TEXT,
  ADD COLUMN IF NOT EXISTS "deletedAt"  TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "properties_branchId_idx" ON "properties"("branchId");

-- 5. Add branchId to sales table
ALTER TABLE "sales"
  ADD COLUMN IF NOT EXISTS "branchId" TEXT;

CREATE INDEX IF NOT EXISTS "sales_branchId_idx" ON "sales"("branchId");

-- 6. Add branchId to expenses table
ALTER TABLE "expenses"
  ADD COLUMN IF NOT EXISTS "branchId" TEXT;

-- 7. Create property_transfers table
CREATE TABLE IF NOT EXISTS "property_transfers" (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "propertyId"    TEXT NOT NULL,
  "fromBranchId"  TEXT NOT NULL,
  "toBranchId"    TEXT NOT NULL,
  "initiatedById" TEXT NOT NULL,
  "approvedById"  TEXT,
  "reason"        TEXT,
  "status"        TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "property_transfers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "property_transfers_propertyId_idx"   ON "property_transfers"("propertyId");
CREATE INDEX IF NOT EXISTS "property_transfers_fromBranchId_idx" ON "property_transfers"("fromBranchId");
CREATE INDEX IF NOT EXISTS "property_transfers_toBranchId_idx"   ON "property_transfers"("toBranchId");
CREATE INDEX IF NOT EXISTS "property_transfers_status_idx"       ON "property_transfers"("status");

-- 8. Add branchId to leads table (raw table — no Prisma model)
ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "branchId" TEXT;

-- 9. Add foreign key constraints
ALTER TABLE "branches"
  ADD CONSTRAINT "branches_managerId_fkey"
    FOREIGN KEY ("managerId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "users"
  ADD CONSTRAINT "users_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "branches"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "properties"
  ADD CONSTRAINT "properties_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "branches"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sales"
  ADD CONSTRAINT "sales_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "branches"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "branches"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "property_transfers"
  ADD CONSTRAINT "property_transfers_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "properties"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "property_transfers"
  ADD CONSTRAINT "property_transfers_fromBranchId_fkey"
    FOREIGN KEY ("fromBranchId") REFERENCES "branches"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "property_transfers"
  ADD CONSTRAINT "property_transfers_toBranchId_fkey"
    FOREIGN KEY ("toBranchId") REFERENCES "branches"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
