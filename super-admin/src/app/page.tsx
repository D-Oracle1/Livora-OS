'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, getUser } from '@/lib/auth-storage';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    const user = getUser();
    if (token && user) {
      const role = (user as any).role?.toLowerCase();
      if ((user as any).isSuperAdmin || role === 'super_admin') {
        router.replace('/dashboard');
        return;
      }
    }
    router.replace('/login');
  }, [router]);

  return null;
}
