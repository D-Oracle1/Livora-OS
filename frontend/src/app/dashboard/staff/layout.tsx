'use client';

import dynamic from 'next/dynamic';
import { DashboardShell } from '@/components/layout/dashboard-shell';

const CelebrationModal = dynamic(
  () => import('@/components/celebration-modal').then((m) => ({ default: m.CelebrationModal })),
  { ssr: false },
);

const RaffleCodeModal = dynamic(
  () => import('@/components/raffle-code-modal').then((m) => ({ default: m.RaffleCodeModal })),
  { ssr: false },
);

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell role="staff" extras={<><CelebrationModal /><RaffleCodeModal /></>}>
      {children}
    </DashboardShell>
  );
}
