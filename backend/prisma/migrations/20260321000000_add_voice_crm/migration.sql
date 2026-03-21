-- Add VOICE to MessageType enum
ALTER TYPE "MessageType" ADD VALUE IF NOT EXISTS 'VOICE';

-- Add metadata column to messages (JSON extra data)
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- Add CRM engagement fields to client_profiles
ALTER TABLE "client_profiles"
  ADD COLUMN IF NOT EXISTS "lastContactedAt"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastMessageSnippet" TEXT,
  ADD COLUMN IF NOT EXISTS "engagementScore"    INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "client_profiles_engagementScore_idx" ON "client_profiles"("engagementScore");
CREATE INDEX IF NOT EXISTS "client_profiles_lastContactedAt_idx" ON "client_profiles"("lastContactedAt");

-- VoiceMessage table
CREATE TABLE IF NOT EXISTS "voice_messages" (
  "id"            TEXT        NOT NULL,
  "messageId"     TEXT        NOT NULL,
  "audioUrl"      TEXT        NOT NULL,
  "duration"      INTEGER     NOT NULL,
  "waveform"      JSONB       NOT NULL,
  "transcription" TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "voice_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "voice_messages_messageId_key" ON "voice_messages"("messageId");

ALTER TABLE "voice_messages"
  DROP CONSTRAINT IF EXISTS "voice_messages_messageId_fkey";
ALTER TABLE "voice_messages"
  ADD CONSTRAINT "voice_messages_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CrmActivity table
CREATE TABLE IF NOT EXISTS "crm_activities" (
  "id"           TEXT        NOT NULL,
  "agentId"      TEXT        NOT NULL,
  "clientId"     TEXT        NOT NULL,
  "activityType" TEXT        NOT NULL,
  "referenceId"  TEXT,
  "notes"        TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "crm_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "crm_activities_agentId_idx"      ON "crm_activities"("agentId");
CREATE INDEX IF NOT EXISTS "crm_activities_clientId_idx"     ON "crm_activities"("clientId");
CREATE INDEX IF NOT EXISTS "crm_activities_createdAt_idx"    ON "crm_activities"("createdAt");
CREATE INDEX IF NOT EXISTS "crm_activities_activityType_idx" ON "crm_activities"("activityType");

ALTER TABLE "crm_activities"
  DROP CONSTRAINT IF EXISTS "crm_activities_agentId_fkey";
ALTER TABLE "crm_activities"
  ADD CONSTRAINT "crm_activities_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "crm_activities"
  DROP CONSTRAINT IF EXISTS "crm_activities_clientId_fkey";
ALTER TABLE "crm_activities"
  ADD CONSTRAINT "crm_activities_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
