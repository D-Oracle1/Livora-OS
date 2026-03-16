-- AddColumn: Two-Factor Authentication fields
-- Migration: 20260314000000_add_2fa_fields
-- Safe: adds nullable columns with defaults — no data loss

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "twoFactorSecret" TEXT,
  ADD COLUMN IF NOT EXISTS "twoFactorRecoveryCodes" JSONB NOT NULL DEFAULT '[]'::jsonb;
