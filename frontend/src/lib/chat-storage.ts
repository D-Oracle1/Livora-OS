/**
 * localStorage persistence for chat — gives WhatsApp-like instant load.
 * Rooms and recent messages are stored so they render immediately on
 * page load/refresh before any network request completes.
 */

import type { ChatRoom, ChatMessage } from '@/contexts/chat-context';

const SCHEMA_VERSION = 2;
const MAX_ROOMS = 20;       // keep the most-recent 20 rooms
const MAX_MSGS_PER_ROOM = 30; // keep last 30 messages per room

interface StoredState {
  v: number;
  userId: string;
  rooms: ChatRoom[];
  messages: Record<string, ChatMessage[]>;
  msgsCachedAt: Record<string, number>;  // roomId → epoch ms
}

function key(userId: string) {
  return `livora_chat_v${SCHEMA_VERSION}_${userId}`;
}

const empty = (): Omit<StoredState, 'v' | 'userId'> => ({
  rooms: [],
  messages: {},
  msgsCachedAt: {},
});

export function loadChatStorage(userId: string) {
  if (typeof window === 'undefined') return empty();
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return empty();
    const parsed: StoredState = JSON.parse(raw);
    if (parsed.v !== SCHEMA_VERSION || parsed.userId !== userId) return empty();
    return { rooms: parsed.rooms, messages: parsed.messages, msgsCachedAt: parsed.msgsCachedAt };
  } catch {
    return empty();
  }
}

export function saveChatStorage(
  userId: string,
  rooms: ChatRoom[],
  messageCache: Map<string, ChatMessage[]>,
  msgsCachedAt: Map<string, number>,
) {
  if (typeof window === 'undefined') return;
  try {
    const messages: Record<string, ChatMessage[]> = {};
    const cachedAt: Record<string, number> = {};
    rooms.slice(0, MAX_ROOMS).forEach((room) => {
      const msgs = messageCache.get(room.id);
      if (msgs && msgs.length > 0) {
        messages[room.id] = msgs.slice(-MAX_MSGS_PER_ROOM);
        cachedAt[room.id] = msgsCachedAt.get(room.id) ?? 0;
      }
    });
    const state: StoredState = {
      v: SCHEMA_VERSION,
      userId,
      rooms: rooms.slice(0, MAX_ROOMS),
      messages,
      msgsCachedAt: cachedAt,
    };
    localStorage.setItem(key(userId), JSON.stringify(state));
  } catch {
    // localStorage quota exceeded — silently ignore
  }
}
