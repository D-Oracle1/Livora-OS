'use client';

import { useState } from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { cn } from '@/lib/utils';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen neuo-base">
      <Sidebar
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
      />
      <div className={cn('transition-all duration-300 ease-in-out', collapsed ? 'md:ml-20' : 'md:ml-64')}>
        <Header onMenuClick={() => setMobileOpen(!mobileOpen)} />
        <main className="p-3 md:p-6">{children}</main>
      </div>
    </div>
  );
}
