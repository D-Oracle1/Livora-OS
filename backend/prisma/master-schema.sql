-- Master DB schema — idempotent (safe to run multiple times)
-- Applied by POST /api/v1/master/platform-settings/migrate-db

-- super_admins
CREATE TABLE IF NOT EXISTS "super_admins" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "avatar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "super_admins_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "super_admins_email_key" ON "super_admins"("email");

-- companies
CREATE TABLE IF NOT EXISTS "companies" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "databaseUrl" TEXT NOT NULL,
    "logo" TEXT,
    "primaryColor" TEXT DEFAULT '#3b82f6',
    "inviteCode" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "plan" TEXT NOT NULL DEFAULT 'standard',
    "maxUsers" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "companies_slug_key" ON "companies"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "companies_domain_key" ON "companies"("domain");
CREATE UNIQUE INDEX IF NOT EXISTS "companies_inviteCode_key" ON "companies"("inviteCode");
CREATE INDEX IF NOT EXISTS "companies_domain_idx" ON "companies"("domain");
CREATE INDEX IF NOT EXISTS "companies_inviteCode_idx" ON "companies"("inviteCode");

-- support_threads
CREATE TABLE IF NOT EXISTS "support_threads" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "companyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "support_threads_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "support_threads_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "support_threads_companyId_key" ON "support_threads"("companyId");

-- support_messages
CREATE TABLE IF NOT EXISTS "support_messages" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "threadId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "senderType" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "support_messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "support_threads"("id") ON DELETE CASCADE
);

-- master_settings
CREATE TABLE IF NOT EXISTS "master_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "master_settings_pkey" PRIMARY KEY ("key")
);

-- New columns added after initial release (safe if already present)
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "logo" TEXT;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "primaryColor" TEXT DEFAULT '#3b82f6';
ALTER TABLE "super_admins" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "super_admins" ADD COLUMN IF NOT EXISTS "avatar" TEXT;
