'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Building, BarChart3, Headphones, Bell,
  Settings, LogOut, ChevronLeft, Crown, X,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getImageUrl } from '@/lib/api';
import { getUser, clearAuth } from '@/lib/auth-storage';
import { usePlatformBranding, getPlatformName } from '@/hooks/use-platform-branding';

const NAV_ITEMS = [
  { name: 'Dashboard',     href: '/dashboard',               icon: LayoutDashboard },
  { name: 'Companies',     href: '/dashboard/companies',     icon: Building },
  { name: 'Analytics',     href: '/dashboard/analytics',     icon: BarChart3 },
  { name: 'Support Inbox', href: '/dashboard/support',       icon: Headphones },
  { name: 'Notifications', href: '/dashboard/notifications', icon: Bell },
];

/** Returns true when a hex color is "dark" (luminance < 50) */
function isHexDark(hex: string): boolean {
  const c = hex.replace('#', '');
  if (c.length !== 6) return false;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
}

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onCollapsedChange?: (v: boolean) => void;
}

export function Sidebar({ isOpen = false, onClose, collapsed = false, onCollapsedChange }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const branding = usePlatformBranding();
  const accent = branding.primaryColor || '#f59e0b';
  const sidebarBg = branding.sidebarColor || '#fafaf9';
  const dark = isHexDark(sidebarBg);

  // If a manual text color is set use it; otherwise auto-derive from background lightness
  const manualText = branding.sidebarTextColor;
  const autoPrimary   = dark ? '#f9fafb' : '#111827';
  const autoSecondary = dark ? '#d1d5db' : '#6b7280';
  const textPrimary   = manualText || autoPrimary;
  const textSecondary = manualText
    ? `${manualText}99`   // 60% opacity of the chosen color
    : autoSecondary;
  const divider = dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)';
  const hoverBg = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';

  const [currentUser, setCurrentUser] = useState<{ firstName: string; lastName: string; avatar?: string } | null>(null);

  useEffect(() => {
    const load = () => setCurrentUser(getUser());
    load();
    window.addEventListener('user-updated', load);
    return () => window.removeEventListener('user-updated', load);
  }, [pathname]);

  useEffect(() => {
    if (onClose) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const checkActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  const userName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Super Admin';
  const initials  = currentUser ? `${currentUser.firstName[0]}${currentUser.lastName[0]}` : 'SA';

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-screen flex flex-col shadow-[2px_0_12px_rgba(0,0,0,0.08)]',
          'transition-all duration-300 ease-in-out',
          // Mobile: always rendered but slid off-screen when closed; desktop: always visible
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          // Width: mobile always 72 (280px); desktop obeys collapsed
          'w-72 md:w-64',
          collapsed && 'md:w-20',
        )}
        style={{ backgroundColor: sidebarBg, borderRight: `1px solid ${divider}` }}
      >
        {/* Logo */}
        <div
          className={cn('h-16 flex items-center shrink-0 px-4', collapsed ? 'justify-center' : 'justify-between')}
          style={{ borderBottom: `1px solid ${divider}` }}
        >
          <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
            {branding.logo ? (
              <img
                src={branding.logo.startsWith('http') ? branding.logo : getImageUrl(branding.logo)}
                alt={getPlatformName(branding)}
                className="w-9 h-9 rounded-xl object-contain shrink-0 bg-white/10"
              />
            ) : (
              <div
                className="w-9 h-9 rounded-xl border flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${accent}26`, borderColor: `${accent}4d` }}
              >
                <Crown className="w-5 h-5" style={{ color: accent }} />
              </div>
            )}
            {!collapsed && (
              <div className="min-w-0">
                <span className="text-base font-bold truncate block" style={{ color: textPrimary }}>
                  {getPlatformName(branding)}
                </span>
                <span className="text-[10px] font-medium tracking-wide uppercase" style={{ color: accent }}>
                  Super Admin
                </span>
              </div>
            )}
          </Link>

          <button onClick={onClose} className="md:hidden p-1.5 rounded-lg transition-colors" style={{ color: textSecondary }}>
            <X className="w-5 h-5" />
          </button>
          {!collapsed && (
            <button
              onClick={() => onCollapsedChange?.(!collapsed)}
              className="hidden md:flex p-1.5 rounded-lg transition-colors"
              style={{ color: textSecondary }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* User profile */}
        <div
          className={cn('py-4 shrink-0', collapsed ? 'flex justify-center px-2' : 'px-4 flex items-center gap-3')}
          style={{ borderBottom: `1px solid ${divider}` }}
        >
          <Avatar className="w-10 h-10 shrink-0 ring-2" style={{ '--tw-ring-color': `${accent}4d` } as React.CSSProperties}>
            {currentUser?.avatar && <AvatarImage src={getImageUrl(currentUser.avatar)} alt={userName} />}
            <AvatarFallback className="text-white text-sm font-semibold" style={{ backgroundColor: accent }}>
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate" style={{ color: textPrimary }}>{userName}</p>
              <p className="text-xs" style={{ color: textSecondary }}>Super Admin</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          <ul className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const active = checkActive(item.href);
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    title={collapsed ? item.name : undefined}
                    className={cn(
                      'relative flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-150',
                      collapsed ? 'justify-center px-2 py-3' : 'px-3 py-2.5',
                    )}
                    style={
                      active
                        ? { backgroundColor: `${accent}26`, color: accent }
                        : { color: textSecondary }
                    }
                    onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = hoverBg; }}
                    onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    {active && !collapsed && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full"
                        style={{ backgroundColor: accent }}
                      />
                    )}
                    <item.icon className="w-5 h-5 shrink-0" style={active ? { color: accent } : {}} />
                    {!collapsed && <span>{item.name}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom */}
        <div className="px-2 py-3 space-y-0.5 shrink-0" style={{ borderTop: `1px solid ${divider}` }}>
          {collapsed && (
            <button
              onClick={() => onCollapsedChange?.(false)}
              title="Expand"
              className="w-full flex justify-center px-2 py-2.5 rounded-xl transition-colors"
              style={{ color: textSecondary }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = hoverBg; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              <ChevronLeft className="w-5 h-5 rotate-180" />
            </button>
          )}
          <Link
            href="/dashboard/settings"
            title={collapsed ? 'Settings' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-xl text-sm font-medium transition-all',
              collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
            )}
            style={{ color: textSecondary }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = hoverBg; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <Settings className="w-5 h-5 shrink-0" />
            {!collapsed && <span>Settings</span>}
          </Link>
          <button
            onClick={() => { clearAuth(); router.push('/login'); }}
            title={collapsed ? 'Logout' : undefined}
            className={cn(
              'w-full flex items-center gap-3 rounded-xl text-sm font-medium text-red-500 transition-all',
              collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
            )}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = dark ? 'rgba(239,68,68,0.15)' : 'rgb(254,242,242)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
