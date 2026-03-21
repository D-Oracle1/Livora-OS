'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { PusherProvider } from '@/contexts/pusher-context';
import { NotificationProvider } from '@/contexts/notification-context';
import { ChatProvider } from '@/contexts/chat-context';
import { CallProvider } from '@/contexts/call-context';
import { requestNotificationPermission } from '@/lib/push-notifications';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth-storage';

const IncomingCallModal = dynamic(
  () => import('@/components/call/incoming-call-modal').then((m) => m.IncomingCallModal),
  { ssr: false },
);
const ActiveCallScreen = dynamic(
  () => import('@/components/call/active-call-screen').then((m) => m.ActiveCallScreen),
  { ssr: false },
);
const CalloutAlertModal = dynamic(
  () => import('@/components/callout/callout-alert-modal').then((m) => m.CalloutAlertModal),
  { ssr: false },
);

function PushNotificationSetup() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Request push notification permission after a short delay
    const timer = setTimeout(() => {
      requestNotificationPermission();
    }, 3000);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return null;
}

/**
 * Pings the backend every 4 minutes to prevent Vercel serverless cold starts.
 * Vercel functions go cold after ~5 min idle; a lightweight /health ping keeps
 * the instance warm so users don't experience a 2–5 s stall on their next request.
 */
function KeepAlive() {
  useEffect(() => {
    const token = getToken();
    if (!token || token === 'demo-token') return;

    const ping = () => api.get('/health').catch(() => {});
    // First ping after 60 s (let the app settle), then every 4 min
    const first = setTimeout(ping, 60_000);
    const interval = setInterval(ping, 4 * 60 * 1000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, []);

  return null;
}

export function AuthenticatedProviders({ children }: { children: React.ReactNode }) {
  return (
    <PusherProvider>
      <NotificationProvider>
        <ChatProvider>
          <CallProvider>
            {children}
            <IncomingCallModal />
            <ActiveCallScreen />
            <CalloutAlertModal />
            <PushNotificationSetup />
            <KeepAlive />
          </CallProvider>
        </ChatProvider>
      </NotificationProvider>
    </PusherProvider>
  );
}
