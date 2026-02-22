'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';

export default function HrLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell role="hr">
      {children}
    </DashboardShell>
  );
}
