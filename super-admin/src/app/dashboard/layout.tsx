'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, getUser } from '@/lib/auth-storage';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { PusherProvider } from '@/contexts/pusher-context';
import { NotificationProvider } from '@/contexts/notification-context';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    const user = getUser();
    if (!token || !user) {
      router.replace('/login');
      return;
    }
    const role = (user as any).role?.toLowerCase();
    if (!(user as any).isSuperAdmin && role !== 'super_admin') {
      router.replace('/login');
    }
  }, [router]);

  return (
    <PusherProvider>
      <NotificationProvider>
        <DashboardShell>{children}</DashboardShell>
      </NotificationProvider>
    </PusherProvider>
  );
}
