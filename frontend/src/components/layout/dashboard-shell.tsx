'use client';

import { useState } from 'react';
import { Sidebar, SidebarProps } from './sidebar';
import { Header } from './header';
import { cn } from '@/lib/utils';

interface DashboardShellProps {
  role: SidebarProps['role'];
  children: React.ReactNode;
  /** Role-specific modals/overlays (e.g. CelebrationModal, SaleApprovalModal) */
  extras?: React.ReactNode;
}

/**
 * Shared dashboard layout shell.
 * Manages mobile-menu open state AND sidebar collapsed state so the main
 * content area can expand/contract in sync with the sidebar.
 */
export function DashboardShell({ role, children, extras }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const isSuperAdmin = role === 'super-admin';

  return (
    <div className={cn('min-h-screen', isSuperAdmin ? 'neuo-base' : 'bg-gray-50 dark:bg-gray-950')}>
      <Sidebar
        role={role}
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
      />

      {/* Main content shifts right based on sidebar width */}
      <div
        className={cn(
          'transition-all duration-300 ease-in-out',
          collapsed ? 'md:ml-20' : 'md:ml-64',
        )}
      >
        <Header onMenuClick={() => setMobileOpen(!mobileOpen)} />
        {extras}
        <main className="p-3 md:p-6">{children}</main>
      </div>
    </div>
  );
}
