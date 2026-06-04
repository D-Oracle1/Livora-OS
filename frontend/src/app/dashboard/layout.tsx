'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, getUser } from '@/lib/auth-storage';
import { Loader2 } from 'lucide-react';
import { AuthenticatedProviders } from '../authenticated-providers';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const token = getToken();
    const user = getUser();

    if (!token || !user) {
      router.replace('/auth/login');
      return;
    }

    // Verify user is accessing the correct role dashboard
    const role = user.role?.toLowerCase();
    const path = window.location.pathname;

    const rolePrefixes: Record<string, string[]> = {
      super_admin: ['/dashboard/super-admin', '/dashboard/admin'],
      admin: ['/dashboard/admin'],
      general_overseer: ['/dashboard/general-overseer'],
      branch_manager: ['/dashboard/branch-manager', '/dashboard/admin'],
      hr: ['/dashboard/hr'],
      realtor: ['/dashboard/realtor'],
      staff: ['/dashboard/staff'],
      client: ['/dashboard/client'],
    };

    const allowed = rolePrefixes[role || ''] || ['/dashboard/client'];
    const isAllowed = allowed.some((prefix) => path.startsWith(prefix));

    if (!isAllowed) {
      router.replace(allowed[0]);
      return;
    }

    setChecked(true);
  }, [router]);

  if (!checked) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return <AuthenticatedProviders>{children}</AuthenticatedProviders>;
}
