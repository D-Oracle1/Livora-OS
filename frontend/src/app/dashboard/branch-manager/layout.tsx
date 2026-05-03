'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';

export default function BranchManagerLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell role="branch-manager">{children}</DashboardShell>;
}
