'use client';

import { useState, useEffect } from 'react';
import { Sidebar, SidebarProps } from './sidebar';
import { Header } from './header';
import { cn } from '@/lib/utils';
import { useBranding } from '@/hooks/use-branding';

interface DashboardShellProps {
  role: SidebarProps['role'];
  children: React.ReactNode;
  /** Role-specific modals/overlays (e.g. CelebrationModal, SaleApprovalModal) */
  extras?: React.ReactNode;
}

/** Convert #rrggbb → "h s% l%" for shadcn/ui CSS variables */
function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Shared dashboard layout shell.
 * Manages mobile-menu open state AND sidebar collapsed state so the main
 * content area can expand/contract in sync with the sidebar.
 */
export function DashboardShell({ role, children, extras }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const branding = useBranding();

  const isSuperAdmin = role === 'super-admin';

  // Inject tenant primary color as CSS variable (tenant dashboards only)
  useEffect(() => {
    if (isSuperAdmin || !branding.primaryColor) return;
    const hex = branding.primaryColor;
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
    const hsl = hexToHsl(hex);
    let style = document.getElementById('brand-theme') as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = 'brand-theme';
      document.head.appendChild(style);
    }
    style.textContent = `:root { --primary: ${hsl}; --ring: ${hsl}; }`;
  }, [branding.primaryColor, isSuperAdmin]);

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
