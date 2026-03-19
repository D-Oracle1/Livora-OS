'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth-storage';
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

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  sender: ChatParticipant;
  content: string;
  type: string;
  attachments: any;
  readBy: string[];
  createdAt: string;
  updatedAt: string;
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
  createRoom: (participantIds: string[], name?: string) => Promise<ChatRoom>;
  sendTyping: (isTyping: boolean) => void;
  setActiveRoom: (room: ChatRoom | null) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { subscribeToUserEvent, unsubscribeFromUserEvent, subscribeToChannel, unsubscribeFromChannel, broadcastToChannel } = usePusher();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const activeRoomRef = useRef<string | null>(null);
  const messageCacheRef = useRef<Map<string, ChatMessage[]>>(new Map());

  const isDemo = () => getToken() === 'demo-token';

  const fetchRooms = useCallback(async () => {
    const token = getToken();
    if (!token || isDemo()) return;

    setIsLoadingRooms(true);
    try {
      const res = await api.get<any>('/chat/rooms');
      // Handle TransformInterceptor wrapper: { success, data, timestamp }
      const raw = res?.data ?? res;
      const roomsList = Array.isArray(raw) ? raw : [];
      setRooms(roomsList);
    } catch (err) {
      console.error('[Chat] Failed to fetch rooms:', err);
    } finally {
      setIsLoadingRooms(false);
    }
  }, []);

  const selectRoom = useCallback(async (room: ChatRoom) => {
    // Unsubscribe from previous chat channel
    if (activeRoomRef.current) {
      unsubscribeFromChannel(`chat-${activeRoomRef.current}`);
    }

    setActiveRoom(room);
    activeRoomRef.current = room.id;

    // Show cached messages instantly (no spinner if we have cache)
    const cached = messageCacheRef.current.get(room.id);
    if (cached && cached.length > 0) {
      setMessages(cached);
      setIsLoadingMessages(false);
    } else {
      setMessages([]);
      setIsLoadingMessages(true);
    }

    // Subscribe to new chat room channel for typing events
    const channel = subscribeToChannel(`chat-${room.id}`);
    if (channel) {
      channel
        .on('broadcast', { event: 'client-typing' }, (payload) => {
          const data = payload.payload as { userId: string; isTyping: boolean };
          if (data.isTyping) {
            setTypingUsers((prev) => {
              if (prev.some((t) => t.userId === data.userId && t.roomId === room.id)) return prev;
              return [...prev, { userId: data.userId, roomId: room.id }];
            });
            setTimeout(() => {
              setTypingUsers((prev) =>
                prev.filter((t) => !(t.userId === data.userId && t.roomId === room.id)),
              );
            }, 3000);
          } else {
            setTypingUsers((prev) =>
              prev.filter((t) => !(t.userId === data.userId && t.roomId === room.id)),
            );
          }
        })
        .subscribe();
    }

    // Fetch fresh messages (background refresh if cached, foreground if not)
    try {
      const res = await api.get<any>(`/chat/rooms/${room.id}/messages?limit=50`);
      const raw = res?.data ?? res;
      // getMessages returns { data: [...], meta: {} } — unwrap the inner data array
      const msgs = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
      console.log('[Chat] Loaded messages:', msgs.length, 'for room', room.id);

      // Only update if this room is still active
      if (activeRoomRef.current === room.id) {
        setMessages(msgs);
        messageCacheRef.current.set(room.id, msgs);
      }

      // Mark as read (fire-and-forget)
      api.post(`/chat/rooms/${room.id}/read`).catch(() => {});
      setRooms((prev) => prev.map((r) => (r.id === room.id ? { ...r, unreadCount: 0 } : r)));
    } catch (err) {
      console.error('[Chat] Failed to load messages:', err);
    } finally {
      if (activeRoomRef.current === room.id) {
        setIsLoadingMessages(false);
      }
    }
  }, [subscribeToChannel, unsubscribeFromChannel]);

  const sendMessage = useCallback(async (content: string, type = 'TEXT', attachments?: string[]) => {
    if (!activeRoomRef.current || (!content.trim() && (!attachments || attachments.length === 0))) return;

    try {
      const res = await api.post<any>(`/chat/rooms/${activeRoomRef.current}/messages`, {
        content: content.trim(),
        type,
        ...(attachments && attachments.length > 0 ? { attachments } : {}),
      });
      // Handle TransformInterceptor wrapper: { success, data: { message }, timestamp }
      const msg = res?.data ?? res;
      console.log('[Chat] Message sent:', msg?.id);
      setMessages((prev) => {
        const updated = [...prev, msg];
        if (activeRoomRef.current) messageCacheRef.current.set(activeRoomRef.current, updated);
        return updated;
      });

      setRooms((prev) =>
        prev.map((r) => {
          if (r.id === activeRoomRef.current) {
            return { ...r, lastMessage: msg, lastMessageAt: msg.createdAt };
          }
          return r;
        }),
      );
    } catch (err) {
      console.error('[Chat] Failed to send message:', err);
      throw new Error('Failed to send message');
    }
  }, []);

  const createRoom = useCallback(async (participantIds: string[], name?: string) => {
    const res = await api.post<any>('/chat/rooms', { participantIds, name });
    const newRoom = res?.data ?? res;
    console.log('[Chat] Room created/found:', newRoom?.id);
    // Avoid adding a duplicate if the room already exists in state (e.g. existing direct chat)
    setRooms((prev) => {
      if (!newRoom?.id || prev.some((r) => r.id === newRoom.id)) return prev;
      return [{ ...newRoom, lastMessage: newRoom.lastMessage ?? null, unreadCount: newRoom.unreadCount ?? 0 }, ...prev];
    });
    return newRoom;
  }, []);

  const sendTyping = useCallback((isTyping: boolean) => {
    if (!activeRoomRef.current) return;
    broadcastToChannel(`chat-${activeRoomRef.current}`, 'client-typing', { isTyping });
  }, [broadcastToChannel]);

  // Listen for chat messages on the user's channel
  useEffect(() => {
    const handleNewMessage = (data: { roomId: string; message: ChatMessage }) => {
      console.log('[Chat] Real-time message received:', data?.roomId, data?.message?.id);
      if (data.roomId === activeRoomRef.current) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          const updated = [...prev, data.message];
          messageCacheRef.current.set(data.roomId, updated);
          return updated;
        });
        api.post(`/chat/rooms/${data.roomId}/read`).catch(() => {});
        playChatMessageSound();
      } else {
        setRooms((prev) =>
          prev.map((r) => {
            if (r.id === data.roomId) {
              return {
                ...r,
                unreadCount: r.unreadCount + 1,
                lastMessage: data.message,
                lastMessageAt: data.message.createdAt,
              };
            }
            return r;
          }),
        );
        // Play sound and show toast for messages in other rooms
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
    return () => {
      unsubscribeFromUserEvent('chat:message', handleNewMessage);
    };
  }, [subscribeToUserEvent, unsubscribeFromUserEvent]);

  // Rooms are fetched lazily — chat page calls fetchRooms() when it mounts

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
  if (!ctx) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return ctx;
}
