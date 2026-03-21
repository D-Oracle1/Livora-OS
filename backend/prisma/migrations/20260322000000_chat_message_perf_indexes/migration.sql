-- ──────────────────────────────────────────────────────────────────
-- Chat performance indexes
--
-- The key bottleneck: message queries do
--   WHERE "roomId" = ? ORDER BY "createdAt" DESC LIMIT N
-- A composite index (roomId, createdAt DESC) lets PostgreSQL satisfy
-- both the filter and the sort with a single index scan — no sort step.
-- ──────────────────────────────────────────────────────────────────

-- Composite covering index for the hot message-pagination query
CREATE INDEX IF NOT EXISTS "messages_roomId_createdAt_idx"
  ON "messages"("roomId", "createdAt" DESC);

-- Room list is ordered by lastMessageAt — needs an index
CREATE INDEX IF NOT EXISTS "chat_rooms_lastMessageAt_idx"
  ON "chat_rooms"("lastMessageAt" DESC);

-- Room list filters by type (SUPPORT exclusion) — add index
CREATE INDEX IF NOT EXISTS "chat_rooms_type_idx"
  ON "chat_rooms"("type");
