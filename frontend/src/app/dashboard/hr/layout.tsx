'use client';

import dynamic from 'next/dynamic';
import { DashboardShell } from '@/components/layout/dashboard-shell';

const RaffleCodeModal = dynamic(
  () => import('@/components/raffle-code-modal').then((m) => ({ default: m.RaffleCodeModal })),
  { ssr: false },
);

export default function HrLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell role="hr" extras={<RaffleCodeModal />}>
      {children}
    </DashboardShell>
  );
}
