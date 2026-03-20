-- Add isPublished column to raffle_sessions
ALTER TABLE "raffle_sessions" ADD COLUMN IF NOT EXISTS "isPublished" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "raffle_sessions_isPublished_idx" ON "raffle_sessions"("isPublished");
