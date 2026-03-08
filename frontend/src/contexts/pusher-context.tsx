'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { getToken, getUser } from '@/lib/auth-storage';

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

const log = (...args: any[]) => console.log('[Realtime]', ...args);
const warn = (...args: any[]) => console.warn('[Realtime]', ...args);

type EventHandler = (data: any) => void;

interface RealtimeContextValue {
  isConnected: boolean;
  onlineUsers: string[];
  subscribeToUserEvent: (event: string, handler: EventHandler) => void;
  unsubscribeFromUserEvent: (event: string, handler: EventHandler) => void;
  subscribeToChannel: (channelName: string) => RealtimeChannel | null;
  unsubscribeFromChannel: (channelName: string) => void;
  broadcastToChannel: (channelName: string, event: string, payload: any) => void;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  isConnected: false,
  onlineUsers: [],
  subscribeToUserEvent: () => {},
  unsubscribeFromUserEvent: () => {},
  subscribeToChannel: () => null,
  unsubscribeFromChannel: () => void 0,
  broadcastToChannel: () => {},
});

export function PusherProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const supabaseRef = useRef<SupabaseClient | null>(null);
  const channelsRef = useRef<Map<string, RealtimeChannel>>(new Map());
  const userEventHandlersRef = useRef<Map<string, Set<EventHandler>>>(new Map());
  const mountedRef = useRef(true);

  const initRealtime = useCallback(() => {
    const token = getToken();
    const user = getUser();

    if (!token || token === 'demo-token' || !user) {
      log('Skipping init: no auth', { hasToken: !!token, hasUser: !!user });
      return;
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      warn('Skipping init: missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
      return;
    }

    log('Initializing...', { userId: user.id, role: user.role, url: SUPABASE_URL.substring(0, 30) + '...' });

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: { params: { eventsPerSecond: 10 } },
    });
    supabaseRef.current = supabase;

    // Subscribe to user-specific channel
    const userChannelName = `user-${user.id}`;
    const userChannel = supabase
      .channel(userChannelName)
      .on('broadcast', { event: '*' }, (payload) => {
        if (!mountedRef.current) return;
        const event = payload.event;
        log(`Event received: "${event}"`, payload.payload);
        const handlers = userEventHandlersRef.current.get(event);
        if (handlers && handlers.size > 0) {
          handlers.forEach((handler) => handler(payload.payload));
        } else {
          log(`No handlers registered for event "${event}". Registered events:`, [...userEventHandlersRef.current.keys()]);
        }
      })
      .subscribe((status) => {
        log(`User channel "${userChannelName}" status: ${status}`);
        if (mountedRef.current) {
          setIsConnected(status === 'SUBSCRIBED');
        }
      });
    channelsRef.current.set(userChannelName, userChannel);

    // Subscribe to role-based channel
    if (user.role) {
      const roleChannelName = `role-${user.role}`;
      const roleChannel = supabase
        .channel(roleChannelName)
        .on('broadcast', { event: '*' }, (payload) => {
          if (!mountedRef.current) return;
          const event = payload.event;
          log(`Role event received: "${event}"`, payload.payload);
          const handlers = userEventHandlersRef.current.get(event);
          if (handlers && handlers.size > 0) {
            handlers.forEach((handler) => handler(payload.payload));
          }
        })
        .subscribe((status) => {
          log(`Role channel "${roleChannelName}" status: ${status}`);
        });
      channelsRef.current.set(roleChannelName, roleChannel);
    }

    // Presence channel for online tracking
    const presenceChannel = supabase
      .channel('online-presence')
      .on('presence', { event: 'sync' }, () => {
        if (!mountedRef.current) return;
        const state = presenceChannel.presenceState();
        const ids: string[] = [];
        for (const key of Object.keys(state)) {
          const presences = state[key] as any[];
          for (const p of presences) {
            if (p.user_id) ids.push(p.user_id);
          }
        }
        setOnlineUsers(ids);
      })
      .subscribe(async (status) => {
        log(`Presence channel status: ${status}`);
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user_id: user.id,
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          });
        }
      });
    channelsRef.current.set('online-presence', presenceChannel);
  }, []);

  const cleanupRealtime = useCallback(() => {
    if (supabaseRef.current) {
      log('Cleaning up channels...');
      channelsRef.current.forEach((channel) => {
        supabaseRef.current?.removeChannel(channel);
      });
      channelsRef.current.clear();
      supabaseRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    initRealtime();
    return () => {
      mountedRef.current = false;
      cleanupRealtime();
    };
  }, [initRealtime, cleanupRealtime]);

  useEffect(() => {
    const handleUserUpdated = () => {
      log('User updated, reconnecting...');
      cleanupRealtime();
      initRealtime();
    };
    window.addEventListener('user-updated', handleUserUpdated);
    return () => window.removeEventListener('user-updated', handleUserUpdated);
  }, [initRealtime, cleanupRealtime]);

  const subscribeToUserEvent = useCallback((event: string, handler: EventHandler) => {
    if (!userEventHandlersRef.current.has(event)) {
      userEventHandlersRef.current.set(event, new Set());
    }
    userEventHandlersRef.current.get(event)!.add(handler);
    log(`Handler registered for "${event}" (total: ${userEventHandlersRef.current.get(event)!.size})`);
  }, []);

  const unsubscribeFromUserEvent = useCallback((event: string, handler: EventHandler) => {
    const handlers = userEventHandlersRef.current.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        userEventHandlersRef.current.delete(event);
      }
    }
  }, []);

  const subscribeToChannel = useCallback((channelName: string): RealtimeChannel | null => {
    if (!supabaseRef.current) return null;
    const existing = channelsRef.current.get(channelName);
    if (existing) return existing;

    const channel = supabaseRef.current.channel(channelName);
    channelsRef.current.set(channelName, channel);
    return channel;
  }, []);

  const unsubscribeFromChannel = useCallback((channelName: string) => {
    const channel = channelsRef.current.get(channelName);
    if (channel && supabaseRef.current) {
      supabaseRef.current.removeChannel(channel);
      channelsRef.current.delete(channelName);
    }
  }, []);

  const broadcastToChannel = useCallback((channelName: string, event: string, payload: any) => {
    const channel = channelsRef.current.get(channelName);
    if (channel) {
      channel.send({ type: 'broadcast', event, payload });
    }
  }, []);

  return (
    <RealtimeContext.Provider
      value={{
        isConnected,
        onlineUsers,
        subscribeToUserEvent,
        unsubscribeFromUserEvent,
        subscribeToChannel,
        unsubscribeFromChannel,
        broadcastToChannel,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export function usePusher() {
  return useContext(RealtimeContext);
}

/** Backward-compatible alias */
export function useSocket() {
  const { isConnected, onlineUsers } = useContext(RealtimeContext);
  return { socket: null, isConnected, onlineUsers };
}
