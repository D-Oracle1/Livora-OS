'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { getToken, getUser } from '@/lib/auth-storage';
import { loadChatStorage, saveChatStorage } from '@/lib/chat-storage';
import { usePusher } from './pusher-context';
import { playChatMessageSound } from '@/lib/notification-sounds';
import { toast } from 'sonner';

export interface ChatParticipant {
  id: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  role?: string;
}

export interface VoiceMessageData {
  audioUrl: string;
  duration: number;
  waveform: number[];
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  sender: ChatParticipant;
  content: string;
  type: string;
  attachments: any;
  metadata: any;
  readBy: string[];
  createdAt: string;
  updatedAt: string;
  voiceMessage?: VoiceMessageData;
}

export interface ChatRoom {
  id: string;
  name: string | null;
  type: 'DIRECT' | 'GROUP';
  participants: ChatParticipant[];
  lastMessage: ChatMessage | null;
  unreadCount: number;
  lastMessageAt: string | null;
  createdAt: string;
}

interface TypingUser {
  userId: string;
  roomId: string;
}

interface ChatContextValue {
  rooms: ChatRoom[];
  activeRoom: ChatRoom | null;
  messages: ChatMessage[];
  isLoadingRooms: boolean;
  isLoadingMessages: boolean;
  typingUsers: TypingUser[];
  fetchRooms: () => Promise<void>;
  selectRoom: (room: ChatRoom) => Promise<void>;
  sendMessage: (content: string, type?: string, attachments?: string[]) => Promise<void>;
  sendVoiceMessage: (blob: Blob, duration: number, mimeType: string) => Promise<void>;
  createRoom: (participantIds: string[], name?: string) => Promise<ChatRoom>;
  sendTyping: (isTyping: boolean) => void;
  setActiveRoom: (room: ChatRoom | null) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

// Messages within this window skip the network fetch entirely
const CACHE_TTL_MS = 30_000; // 30 s

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { subscribeToUserEvent, unsubscribeFromUserEvent, subscribeToChannel, unsubscribeFromChannel, broadcastToChannel } = usePusher();

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  const activeRoomRef = useRef<string | null>(null);
  const roomsRef = useRef<ChatRoom[]>([]);                      // always-current ref for callbacks
  const messageCacheRef = useRef<Map<string, ChatMessage[]>>(new Map());
  const cacheFetchedAtRef = useRef<Map<string, number>>(new Map());

  // Keep roomsRef in sync with state
  useEffect(() => { roomsRef.current = rooms; }, [rooms]);

  // ── Persistence helper ────────────────────────────────────────────────────
  const persist = useCallback(() => {
    const userId = getUser()?.id;
    if (!userId) return;
    saveChatStorage(userId, roomsRef.current, messageCacheRef.current, cacheFetchedAtRef.current);
  }, []);

  // ── Initial hydration from localStorage ──────────────────────────────────
  useEffect(() => {
    const userId = getUser()?.id;
    const token = getToken();
    if (!userId || !token || token === 'demo-token') return;

    // 1. Instantly render from localStorage (zero network latency)
    const stored = loadChatStorage(userId);
    if (stored.rooms.length > 0) {
      setRooms(stored.rooms);
      roomsRef.current = stored.rooms;
    }
    Object.entries(stored.messages).forEach(([roomId, msgs]) => {
      messageCacheRef.current.set(roomId, msgs);
      cacheFetchedAtRef.current.set(roomId, stored.msgsCachedAt[roomId] ?? 0);
    });

    // 2. Eagerly refresh rooms in the background (don't await — non-blocking)
    fetchRooms();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // ── Fetch rooms ──────────────────────────────────────────────────────────
  const fetchRooms = useCallback(async () => {
    const token = getToken();
    if (!token || token === 'demo-token') return;

    setIsLoadingRooms(true);
    try {
      const res = await api.get<any>('/chat/rooms');
      const raw = res?.data ?? res;
      const roomsList: ChatRoom[] = Array.isArray(raw) ? raw : [];
      setRooms(roomsList);
      roomsRef.current = roomsList;

      // Persist updated rooms
      const userId = getUser()?.id;
      if (userId) {
        saveChatStorage(userId, roomsList, messageCacheRef.current, cacheFetchedAtRef.current);
      }
    } catch (err) {
      console.error('[Chat] Failed to fetch rooms:', err);
    } finally {
      setIsLoadingRooms(false);
    }
  }, []);

  // ── Select room ──────────────────────────────────────────────────────────
  const selectRoom = useCallback(async (room: ChatRoom) => {
    if (activeRoomRef.current) {
      unsubscribeFromChannel(`chat-${activeRoomRef.current}`);
    }

    setActiveRoom(room);
    activeRoomRef.current = room.id;

    // Show cached messages immediately — no spinner
    const cached = messageCacheRef.current.get(room.id);
    const cachedAt = cacheFetchedAtRef.current.get(room.id) ?? 0;
    const isFresh = Date.now() - cachedAt < CACHE_TTL_MS;

    if (cached && cached.length > 0) {
      setMessages(cached);
      setIsLoadingMessages(false);
      if (isFresh) {
        api.post(`/chat/rooms/${room.id}/read`).catch(() => {});
        setRooms((prev) => prev.map((r) => (r.id === room.id ? { ...r, unreadCount: 0 } : r)));
        subscribeToTyping(room.id);
        return; // skip network fetch — cache is fresh
      }
    } else {
      setMessages([]);
      setIsLoadingMessages(true);
    }

    subscribeToTyping(room.id);

    try {
      const res = await api.get<any>(`/chat/rooms/${room.id}/messages?limit=30`);
      const raw = res?.data ?? res;
      const msgs: ChatMessage[] = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);

      if (activeRoomRef.current === room.id) {
        setMessages(msgs);
        messageCacheRef.current.set(room.id, msgs);
        cacheFetchedAtRef.current.set(room.id, Date.now());

        // Persist messages
        const userId = getUser()?.id;
        if (userId) {
          saveChatStorage(userId, roomsRef.current, messageCacheRef.current, cacheFetchedAtRef.current);
        }
      }

      api.post(`/chat/rooms/${room.id}/read`).catch(() => {});
      setRooms((prev) => prev.map((r) => (r.id === room.id ? { ...r, unreadCount: 0 } : r)));
    } catch (err) {
      console.error('[Chat] Failed to load messages:', err);
    } finally {
      if (activeRoomRef.current === room.id) setIsLoadingMessages(false);
    }
  }, [unsubscribeFromChannel]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Typing subscription helper ───────────────────────────────────────────
  const subscribeToTyping = useCallback((roomId: string) => {
    const channel = subscribeToChannel(`chat-${roomId}`);
    if (!channel) return;
    channel
      .on('broadcast', { event: 'client-typing' }, (payload) => {
        const data = payload.payload as { userId: string; isTyping: boolean };
        if (data.isTyping) {
          setTypingUsers((prev) => {
            if (prev.some((t) => t.userId === data.userId && t.roomId === roomId)) return prev;
            return [...prev, { userId: data.userId, roomId }];
          });
          setTimeout(() => {
            setTypingUsers((prev) => prev.filter((t) => !(t.userId === data.userId && t.roomId === roomId)));
          }, 3000);
        } else {
          setTypingUsers((prev) => prev.filter((t) => !(t.userId === data.userId && t.roomId === roomId)));
        }
      })
      .subscribe();
  }, [subscribeToChannel]);

  // ── Send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (content: string, type = 'TEXT', attachments?: string[]) => {
    if (!activeRoomRef.current || (!content.trim() && (!attachments || attachments.length === 0))) return;
    try {
      const res = await api.post<any>(`/chat/rooms/${activeRoomRef.current}/messages`, {
        content: content.trim(),
        type,
        ...(attachments && attachments.length > 0 ? { attachments } : {}),
      });
      const msg = res?.data ?? res;
      setMessages((prev) => {
        const updated = [...prev, msg];
        if (activeRoomRef.current) {
          messageCacheRef.current.set(activeRoomRef.current, updated);
          cacheFetchedAtRef.current.set(activeRoomRef.current, Date.now());
        }
        return updated;
      });
      setRooms((prev) =>
        prev.map((r) => (r.id === activeRoomRef.current ? { ...r, lastMessage: msg, lastMessageAt: msg.createdAt } : r)),
      );
      persist();
    } catch (err) {
      console.error('[Chat] Failed to send message:', err);
      throw new Error('Failed to send message');
    }
  }, [persist]);

  // ── Send voice message ───────────────────────────────────────────────────
  const sendVoiceMessage = useCallback(async (blob: Blob, duration: number, mimeType: string) => {
    if (!activeRoomRef.current) return;
    const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'm4a' : 'webm';
    const formData = new FormData();
    formData.append('audio', blob, `voice.${ext}`);
    formData.append('duration', String(duration));
    const res = await api.postForm<any>(`/chat/rooms/${activeRoomRef.current}/voice`, formData);
    const msg = res?.data ?? res;
    setMessages((prev) => {
      const updated = [...prev, msg];
      if (activeRoomRef.current) {
        messageCacheRef.current.set(activeRoomRef.current, updated);
        cacheFetchedAtRef.current.set(activeRoomRef.current, Date.now());
      }
      return updated;
    });
    setRooms((prev) =>
      prev.map((r) => (r.id === activeRoomRef.current ? { ...r, lastMessage: msg, lastMessageAt: msg.createdAt } : r)),
    );
    persist();
  }, [persist]);

  // ── Create room ──────────────────────────────────────────────────────────
  const createRoom = useCallback(async (participantIds: string[], name?: string) => {
    const res = await api.post<any>('/chat/rooms', { participantIds, name });
    const newRoom = res?.data ?? res;
    setRooms((prev) => {
      if (!newRoom?.id || prev.some((r) => r.id === newRoom.id)) return prev;
      return [{ ...newRoom, lastMessage: newRoom.lastMessage ?? null, unreadCount: newRoom.unreadCount ?? 0 }, ...prev];
    });
    return newRoom;
  }, []);

  // ── Typing ───────────────────────────────────────────────────────────────
  const sendTyping = useCallback((isTyping: boolean) => {
    if (!activeRoomRef.current) return;
    broadcastToChannel(`chat-${activeRoomRef.current}`, 'client-typing', { isTyping });
  }, [broadcastToChannel]);

  // ── Real-time message handler ────────────────────────────────────────────
  useEffect(() => {
    const handleNewMessage = (data: { roomId: string; message: ChatMessage }) => {
      if (data.roomId === activeRoomRef.current) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          const updated = [...prev, data.message];
          messageCacheRef.current.set(data.roomId, updated);
          cacheFetchedAtRef.current.set(data.roomId, Date.now());
          // Fire-and-forget persist
          const userId = getUser()?.id;
          if (userId) saveChatStorage(userId, roomsRef.current, messageCacheRef.current, cacheFetchedAtRef.current);
          return updated;
        });
        api.post(`/chat/rooms/${data.roomId}/read`).catch(() => {});
        playChatMessageSound();
      } else {
        setRooms((prev) =>
          prev.map((r) =>
            r.id === data.roomId
              ? { ...r, unreadCount: r.unreadCount + 1, lastMessage: data.message, lastMessageAt: data.message.createdAt }
              : r,
          ),
        );
        playChatMessageSound();
        const senderName = data.message.sender
          ? `${data.message.sender.firstName} ${data.message.sender.lastName}`
          : 'Someone';
        toast(senderName, {
          description: data.message.content.length > 60
            ? data.message.content.substring(0, 60) + '...'
            : data.message.content,
        });
      }
    };
    subscribeToUserEvent('chat:message', handleNewMessage);
    return () => unsubscribeFromUserEvent('chat:message', handleNewMessage);
  }, [subscribeToUserEvent, unsubscribeFromUserEvent]);

  return (
    <ChatContext.Provider
      value={{
        rooms,
        activeRoom,
        messages,
        isLoadingRooms,
        isLoadingMessages,
        typingUsers,
        fetchRooms,
        selectRoom,
        sendMessage,
        sendVoiceMessage,
        createRoom,
        sendTyping,
        setActiveRoom,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
