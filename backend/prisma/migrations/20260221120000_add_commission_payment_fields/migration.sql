-- Add payment tracking columns to commissions table (idempotent)
ALTER TABLE "commissions" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "commissions" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
ALTER TABLE "commissions" ADD COLUMN IF NOT EXISTS "paymentReference" TEXT;
ALTER TABLE "commissions" ADD COLUMN IF NOT EXISTS "paymentNotes" TEXT;
