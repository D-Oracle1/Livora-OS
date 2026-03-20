-- Add RAFFLE to NotificationType enum (safe: skip if already exists)
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RAFFLE';

-- CreateEnum RaffleStatus
DO $$ BEGIN
  CREATE TYPE "RaffleStatus" AS ENUM ('DRAFT', 'SENT', 'COMPLETED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable raffle_sessions
CREATE TABLE IF NOT EXISTS "raffle_sessions" (
    "id"           TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "description"  TEXT,
    "codePrefix"   TEXT NOT NULL DEFAULT 'RAFFLE',
    "codeLength"   INTEGER NOT NULL DEFAULT 6,
    "status"       "RaffleStatus" NOT NULL DEFAULT 'DRAFT',
    "targetRoles"  TEXT[] DEFAULT ARRAY[]::TEXT[],
    "joinedAfter"  TIMESTAMP(3),
    "joinedBefore" TIMESTAMP(3),
    "sentAt"       TIMESTAMP(3),
    "totalSent"    INTEGER NOT NULL DEFAULT 0,
    "createdBy"    TEXT NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raffle_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable raffle_codes
CREATE TABLE IF NOT EXISTS "raffle_codes" (
    "id"         TEXT NOT NULL,
    "sessionId"  TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "code"       TEXT NOT NULL,
    "sentAt"     TIMESTAMP(3),
    "redeemedAt" TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raffle_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "raffle_codes_code_key" ON "raffle_codes"("code");
CREATE INDEX IF NOT EXISTS "raffle_sessions_status_idx" ON "raffle_sessions"("status");
CREATE INDEX IF NOT EXISTS "raffle_sessions_createdBy_idx" ON "raffle_sessions"("createdBy");
CREATE INDEX IF NOT EXISTS "raffle_codes_sessionId_idx" ON "raffle_codes"("sessionId");
CREATE INDEX IF NOT EXISTS "raffle_codes_userId_idx" ON "raffle_codes"("userId");

-- AddForeignKey
ALTER TABLE "raffle_codes" DROP CONSTRAINT IF EXISTS "raffle_codes_sessionId_fkey";
ALTER TABLE "raffle_codes" ADD CONSTRAINT "raffle_codes_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "raffle_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "raffle_codes" DROP CONSTRAINT IF EXISTS "raffle_codes_userId_fkey";
ALTER TABLE "raffle_codes" ADD CONSTRAINT "raffle_codes_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
