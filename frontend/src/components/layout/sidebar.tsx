'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Building2,
  LayoutDashboard,
  Users,
  Home,
  DollarSign,
  Award,
  MessageSquare,
  Bell,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronDown,
  BarChart3,
  FileText,
  Calculator,
  Crown,
  Briefcase,
  X,
  Clock,
  CalendarDays,
  CheckSquare,
  UserCog,
  Building,
  ClipboardList,
  Wallet,
  Star,
  Hash,
  FolderOpen,
  FileEdit,
  ImageIcon,
  Mail,
  Headphones,
  Share2,
  Newspaper,
  Bookmark,
  Shield,
  BookOpen,
  Receipt,
  Tag,
  TrendingUp,
  Scale,
  Waves,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getImageUrl, api } from '@/lib/api';
import { getUser, clearAuth } from '@/lib/auth-storage';
import { useBranding, getShortName } from '@/hooks/use-branding';
import { usePlatformBranding, getPlatformName } from '@/hooks/use-platform-branding';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SidebarProps {
  role: 'admin' | 'realtor' | 'client' | 'staff' | 'super-admin' | 'general-overseer' | 'hr';
  isOpen?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onCollapsedChange?: (v: boolean) => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: any;
  /** Module key used to filter based on department allowedModules. Omit for always-visible items (Dashboard, Settings). */
  moduleKey?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

// ---------------------------------------------------------------------------
// Flat navigation (realtor, client, staff, super-admin)
// ---------------------------------------------------------------------------

const navigationConfig: Record<string, NavItem[]> = {
  'super-admin': [
    { name: 'Dashboard', href: '/dashboard/super-admin', icon: LayoutDashboard },
    { name: 'Companies', href: '/dashboard/super-admin/companies', icon: Building },
    { name: 'Analytics', href: '/dashboard/super-admin/analytics', icon: BarChart3 },
    { name: 'Support Inbox', href: '/dashboard/super-admin/support', icon: Headphones },
    { name: 'Notifications', href: '/dashboard/super-admin/notifications', icon: Bell },
  ],
  realtor: [
    { name: 'Dashboard', href: '/dashboard/realtor', icon: LayoutDashboard },
    { name: 'My Sales', href: '/dashboard/realtor/sales', icon: DollarSign },
    { name: 'Properties', href: '/dashboard/realtor/properties', icon: Home },
    { name: 'Clients', href: '/dashboard/realtor/clients', icon: Users },
    { name: 'Commission', href: '/dashboard/realtor/commission', icon: Calculator },
    { name: 'Loyalty', href: '/dashboard/realtor/loyalty', icon: Award },
    { name: 'My Referrals', href: '/dashboard/realtor/referrals', icon: Share2 },
    { name: 'Feed', href: '/dashboard/realtor/feed', icon: Newspaper },
    { name: 'Chat', href: '/dashboard/realtor/chat', icon: MessageSquare },
    { name: 'Notifications', href: '/dashboard/realtor/notifications', icon: Bell },
  ],
  client: [
    { name: 'Dashboard', href: '/dashboard/client', icon: LayoutDashboard },
    { name: 'My Properties', href: '/dashboard/client/properties', icon: Home },
    { name: 'Offers', href: '/dashboard/client/offers', icon: DollarSign },
    { name: 'Documents', href: '/dashboard/client/documents', icon: FileText },
    { name: 'My Referrals', href: '/dashboard/client/referrals', icon: Share2 },
    { name: 'Feed', href: '/dashboard/client/feed', icon: Newspaper },
    { name: 'Saved Posts', href: '/dashboard/client/saved', icon: Bookmark },
    { name: 'Chat', href: '/dashboard/client/chat', icon: MessageSquare },
    { name: 'Notifications', href: '/dashboard/client/notifications', icon: Bell },
  ],
  hr: [
    { name: 'Dashboard', href: '/dashboard/hr', icon: LayoutDashboard },
    { name: 'Attendance', href: '/dashboard/hr/attendance', icon: Clock, moduleKey: 'attendance' },
    { name: 'Leave Management', href: '/dashboard/hr/leave', icon: CalendarDays, moduleKey: 'leave' },
    { name: 'Performance Reviews', href: '/dashboard/hr/performance', icon: Star, moduleKey: 'performance' },
    { name: 'Staff Payroll', href: '/dashboard/hr/payroll', icon: Wallet, moduleKey: 'staff_payroll' },
    { name: 'Realtor Payroll', href: '/dashboard/hr/realtor-payroll', icon: Wallet, moduleKey: 'realtor_payroll' },
    { name: 'Policies & Penalties', href: '/dashboard/hr/policies', icon: ClipboardList, moduleKey: 'policies' },
    { name: 'Salary Config', href: '/dashboard/hr/salary-config', icon: Settings, moduleKey: 'salary_config' },
    { name: 'Task Management', href: '/dashboard/hr/tasks', icon: CheckSquare, moduleKey: 'tasks' },
    { name: 'Notifications', href: '/dashboard/hr/notifications', icon: Bell, moduleKey: 'notifications' },
  ],
  staff: [
    { name: 'Dashboard', href: '/dashboard/staff', icon: LayoutDashboard },
    { name: 'Sales', href: '/dashboard/staff/sales', icon: DollarSign, moduleKey: 'sales' },
    { name: 'My Tasks', href: '/dashboard/staff/tasks', icon: CheckSquare, moduleKey: 'tasks' },
    { name: 'Attendance', href: '/dashboard/staff/attendance', icon: Clock, moduleKey: 'attendance' },
    { name: 'Leave', href: '/dashboard/staff/leave', icon: CalendarDays, moduleKey: 'leave' },
    { name: 'Team', href: '/dashboard/staff/team', icon: Users, moduleKey: 'team' },
    { name: 'Channels', href: '/dashboard/staff/channels', icon: Hash, moduleKey: 'channels' },
    { name: 'Files', href: '/dashboard/staff/files', icon: FolderOpen, moduleKey: 'files' },
    { name: 'Reviews', href: '/dashboard/staff/reviews', icon: Star, moduleKey: 'performance' },
    { name: 'Payslips', href: '/dashboard/staff/payslips', icon: Wallet, moduleKey: 'staff_payroll' },
    { name: 'My Referrals', href: '/dashboard/staff/referrals', icon: Share2, moduleKey: 'referrals' },
    { name: 'Feed', href: '/dashboard/staff/feed', icon: Newspaper, moduleKey: 'engagement' },
    { name: 'Chat', href: '/dashboard/staff/chat', icon: MessageSquare, moduleKey: 'chat' },
    { name: 'Notifications', href: '/dashboard/staff/notifications', icon: Bell, moduleKey: 'notifications' },
  ],
};

// ---------------------------------------------------------------------------
// Grouped (sectioned) navigation — admin & general-overseer only
// ---------------------------------------------------------------------------

const groupedNavigationConfig: Record<string, NavSection[]> = {
  admin: [
    {
      label: 'Overview',
      items: [
        { name: 'Dashboard', href: '/dashboard/admin', icon: LayoutDashboard },
        { name: 'Analytics', href: '/dashboard/admin/analytics', icon: BarChart3, moduleKey: 'analytics' },
      ],
    },
    {
      label: 'People',
      items: [
        { name: 'All Users', href: '/dashboard/admin/users', icon: Users },
        { name: 'Realtors', href: '/dashboard/admin/realtors', icon: Users, moduleKey: 'realtors' },
        { name: 'Clients', href: '/dashboard/admin/clients', icon: Briefcase, moduleKey: 'clients' },
        { name: 'Staff', href: '/dashboard/admin/staff', icon: UserCog, moduleKey: 'staff' },
        { name: 'Departments', href: '/dashboard/admin/departments', icon: Building, moduleKey: 'departments' },
      ],
    },
    {
      label: 'Sales & Finance',
      items: [
        { name: 'Properties', href: '/dashboard/admin/properties', icon: Home, moduleKey: 'properties' },
        { name: 'Sales', href: '/dashboard/admin/sales', icon: DollarSign, moduleKey: 'sales' },
        { name: 'Commission', href: '/dashboard/admin/commission', icon: Calculator, moduleKey: 'commission' },
        { name: 'Tax Reports', href: '/dashboard/admin/tax', icon: FileText, moduleKey: 'tax' },
        { name: 'Rankings', href: '/dashboard/admin/rankings', icon: Crown, moduleKey: 'rankings' },
      ],
    },
    {
      label: 'Accounting',
      items: [
        { name: 'Overview', href: '/dashboard/admin/accounting', icon: BookOpen, moduleKey: 'accounting' },
        { name: 'Expenses', href: '/dashboard/admin/accounting/expenses', icon: Receipt, moduleKey: 'expenses' },
        { name: 'Categories', href: '/dashboard/admin/accounting/categories', icon: Tag, moduleKey: 'expense_categories' },
        { name: 'Profit & Loss', href: '/dashboard/admin/accounting/profit-loss', icon: TrendingUp, moduleKey: 'accounting' },
        { name: 'Balance Sheet', href: '/dashboard/admin/accounting/balance-sheet', icon: Scale, moduleKey: 'accounting' },
        { name: 'Cash Flow', href: '/dashboard/admin/accounting/cash-flow', icon: Waves, moduleKey: 'accounting' },
        { name: 'Reports', href: '/dashboard/admin/accounting/reports', icon: BarChart3, moduleKey: 'accounting' },
      ],
    },
    {
      label: 'HR',
      items: [
        { name: 'HR Hub', href: '/dashboard/admin/hr', icon: ClipboardList, moduleKey: 'hr_hub' },
        { name: 'Roles & Permissions', href: '/dashboard/admin/roles', icon: Shield, moduleKey: 'roles' },
      ],
    },
    {
      label: 'Content & Comms',
      items: [
        { name: 'CMS', href: '/dashboard/admin/cms', icon: FileEdit, moduleKey: 'cms' },
        { name: 'Gallery', href: '/dashboard/admin/gallery', icon: ImageIcon, moduleKey: 'gallery' },
        { name: 'Channels', href: '/dashboard/admin/channels', icon: Hash, moduleKey: 'channels' },
        { name: 'Chat', href: '/dashboard/admin/chat', icon: MessageSquare, moduleKey: 'chat' },
        { name: 'Support Chats', href: '/dashboard/admin/support', icon: Headphones, moduleKey: 'support' },
        { name: 'Engagement', href: '/dashboard/admin/engagement', icon: Newspaper, moduleKey: 'engagement' },
        { name: 'Newsletter', href: '/dashboard/admin/newsletter', icon: Mail, moduleKey: 'newsletter' },
      ],
    },
    {
      label: 'System',
      items: [
        { name: 'Audit Logs', href: '/dashboard/admin/audit', icon: FileText, moduleKey: 'audit' },
        { name: 'Referral Tracking', href: '/dashboard/admin/referrals', icon: Share2, moduleKey: 'referrals' },
        { name: 'Notifications', href: '/dashboard/admin/notifications', icon: Bell, moduleKey: 'notifications' },
      ],
    },
  ],
  'general-overseer': [
    {
      label: 'Overview',
      items: [
        { name: 'Dashboard', href: '/dashboard/general-overseer', icon: LayoutDashboard },
        { name: 'Analytics', href: '/dashboard/general-overseer/analytics', icon: BarChart3 },
      ],
    },
    {
      label: 'People',
      items: [
        { name: 'Users', href: '/dashboard/general-overseer/users', icon: Users },
        { name: 'Realtors', href: '/dashboard/general-overseer/realtors', icon: Users },
        { name: 'Clients', href: '/dashboard/general-overseer/clients', icon: Briefcase },
        { name: 'Staff', href: '/dashboard/general-overseer/staff', icon: UserCog },
      ],
    },
    {
      label: 'Properties',
      items: [
        { name: 'Properties', href: '/dashboard/general-overseer/properties', icon: Home },
      ],
    },
    {
      label: 'HR & Leave',
      items: [
        { name: 'HR', href: '/dashboard/general-overseer/hr', icon: ClipboardList },
        { name: 'Leave Approvals', href: '/dashboard/general-overseer/leave', icon: CalendarDays },
      ],
    },
    {
      label: 'System',
      items: [
        { name: 'Audit Logs', href: '/dashboard/general-overseer/audit', icon: FileText },
        { name: 'Chat', href: '/dashboard/general-overseer/chat', icon: MessageSquare },
        { name: 'Notifications', href: '/dashboard/general-overseer/notifications', icon: Bell },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Sidebar({
  role,
  isOpen = false,
  onClose,
  collapsed = false,
  onCollapsedChange,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isGrouped = role === 'admin' || role === 'general-overseer';
  const groupedNav = isGrouped ? groupedNavigationConfig[role] : null;
  const navigation = !isGrouped ? (navigationConfig[role] ?? []) : [];
  const tenantBranding = useBranding();
  const platformBranding = usePlatformBranding();
  const branding = role === 'super-admin' ? {} : tenantBranding;
  // Dynamic accent color for super-admin — driven by saved platform branding
  const saColor = role === 'super-admin' ? (platformBranding.primaryColor || '#f59e0b') : '#f59e0b';

  const [currentUser, setCurrentUser] = useState<{
    firstName: string;
    lastName: string;
    role: string;
    avatar?: string;
  } | null>(null);

  // Department-level module restrictions (null = not loaded yet, [] = no restriction)
  const [allowedModules, setAllowedModules] = useState<string[] | null>(null);

  // All sections open by default
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    if (!isGrouped || !groupedNavigationConfig[role]) return {};
    return Object.fromEntries(groupedNavigationConfig[role].map((s) => [s.label, true]));
  });

  useEffect(() => {
    const load = () => setCurrentUser(getUser());
    load();
    window.addEventListener('user-updated', load);
    return () => window.removeEventListener('user-updated', load);
  }, [pathname]);

  // Fetch department's allowedModules for roles that can have department restrictions
  useEffect(() => {
    if (role !== 'staff' && role !== 'hr' && role !== 'admin') {
      setAllowedModules([]);
      return;
    }
    api.get<any>('/staff/my-profile').then((data) => {
      setAllowedModules(data?.department?.allowedModules ?? []);
    }).catch(() => {
      setAllowedModules([]); // On error, show all items
    });
  }, [role]);

  // Close mobile sidebar on route change
  useEffect(() => {
    if (onClose) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Auto-expand the section that contains the current active route
  useEffect(() => {
    if (!isGrouped || !groupedNav) return;
    for (const section of groupedNav) {
      const hasActive = section.items.some((item) =>
        item.href === `/dashboard/${role}`
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + '/'),
      );
      if (hasActive) {
        setOpenSections((prev) => ({ ...prev, [section.label]: true }));
      }
    }
  }, [pathname, isGrouped, groupedNav, role]);

  const toggleSection = (label: string) =>
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }));

  const checkActive = (href: string) =>
    href === `/dashboard/${role}`
      ? pathname === href
      : pathname === href || pathname.startsWith(href + '/');

  // Filter a nav item based on department's allowedModules.
  // Items without a moduleKey (Dashboard, Settings) are always shown.
  // If allowedModules is empty or null, no restriction applies.
  const isModuleAllowed = (item: NavItem) => {
    if (!item.moduleKey) return true;
    if (!allowedModules || allowedModules.length === 0) return true;
    return allowedModules.includes(item.moduleKey);
  };

  const userName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'User';
  const userInitials = currentUser
    ? `${currentUser.firstName[0]}${currentUser.lastName[0]}`
    : 'U';
  const roleLabel =
    role === 'super-admin'
      ? 'Super Admin'
      : role.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-screen flex flex-col',
          'transition-all duration-300 ease-in-out',
          role === 'super-admin'
            ? 'border-r border-black/[0.06]'
            : 'bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800',
          role === 'super-admin' && 'shadow-[2px_0_12px_rgba(0,0,0,0.06)]',
          'hidden md:flex',
          collapsed ? 'md:w-20' : 'md:w-64',
          isOpen && '!flex w-72',
        )}
      >
        {/* ── Logo row ── */}
        <div
          className={cn(
            'h-16 flex items-center shrink-0 px-4',
            role === 'super-admin'
              ? 'border-b border-black/[0.06]'
              : 'border-b border-gray-100 dark:border-gray-800',
            collapsed ? 'justify-center' : 'justify-between',
          )}
        >
          <Link
            href={role === 'super-admin' ? '/dashboard/super-admin' : '/'}
            className="flex items-center gap-2.5 min-w-0"
          >
            {role === 'super-admin' ? (
              platformBranding.logo ? (
                <img
                  src={platformBranding.logo}
                  alt={getPlatformName(platformBranding)}
                  className="w-9 h-9 rounded-xl object-contain shrink-0 bg-gray-100"
                />
              ) : (
                <div
                  style={{ backgroundColor: `${saColor}26`, borderColor: `${saColor}4d` }}
                  className="w-9 h-9 rounded-xl border flex items-center justify-center shrink-0"
                >
                  <Crown className="w-5 h-5" style={{ color: saColor }} />
                </div>
              )
            ) : branding.logo ? (
              <img
                src={getImageUrl(branding.logo)}
                alt={branding.companyName || 'Logo'}
                className="w-9 h-9 rounded-xl object-contain shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-white" />
              </div>
            )}
            {!collapsed && (
              <div>
                <span
                  className={cn(
                    'text-base font-bold truncate block',
                    role === 'super-admin' ? 'text-gray-900' : 'text-gray-900 dark:text-white',
                  )}
                >
                  {role === 'super-admin'
                    ? getPlatformName(platformBranding)
                    : getShortName(branding)}
                </span>
                {role === 'super-admin' && (
                  <span className="text-[10px] font-medium tracking-wide uppercase" style={{ color: saColor }}>
                    Super Admin
                  </span>
                )}
              </div>
            )}
          </Link>

          {/* Mobile close */}
          <button
            onClick={onClose}
            className={cn(
              'md:hidden p-1.5 rounded-lg transition-colors',
              'text-gray-400 hover:bg-gray-100 hover:text-gray-600',
            )}
          >
            <X className="w-5 h-5" />
          </button>

          {/* Desktop collapse toggle */}
          {!collapsed && (
            <button
              onClick={() => onCollapsedChange?.(!collapsed)}
              className={cn(
                'hidden md:flex p-1.5 rounded-lg transition-colors',
                'text-gray-400 hover:bg-gray-100 hover:text-gray-600',
              )}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ── User profile ── */}
        <div
          className={cn(
            'py-4 shrink-0',
            role === 'super-admin'
              ? 'border-b border-black/[0.06]'
              : 'border-b border-gray-100 dark:border-gray-800',
            collapsed ? 'flex justify-center px-2' : 'px-4 flex items-center gap-3',
          )}
        >
          <Avatar
            className="w-10 h-10 shrink-0 ring-2"
            style={{ '--tw-ring-color': role === 'super-admin' ? `${saColor}4d` : undefined } as React.CSSProperties}
          >
            {currentUser?.avatar && (
              <AvatarImage src={getImageUrl(currentUser.avatar)} alt={userName} />
            )}
            <AvatarFallback
              className="text-white text-sm font-semibold"
              style={{ backgroundColor: role === 'super-admin' ? saColor : undefined }}
            >
              {userInitials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'text-sm font-semibold truncate',
                  'text-gray-900 dark:text-white',
                )}
              >
                {userName}
              </p>
              <p
                className={cn(
                  'text-xs',
                  'text-gray-500 dark:text-gray-400',
                )}
              >
                {roleLabel}
              </p>
            </div>
          )}
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 scrollbar-thin">
          {isGrouped && groupedNav ? (
            /* Grouped accordion for admin / general-overseer */
            <div>
              {groupedNav.map((section, idx) => {
                const isOpen = openSections[section.label] ?? true;
                const hasActiveItem = section.items.some((item) => checkActive(item.href));

                return (
                  <div key={section.label} className={idx > 0 ? 'mt-1' : ''}>
                    {/* Section header — hidden in icon-rail (collapsed) mode */}
                    {!collapsed && (
                      <button
                        onClick={() => toggleSection(section.label)}
                        className={cn(
                          'w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors mb-0.5',
                          hasActiveItem
                            ? 'text-primary'
                            : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300',
                        )}
                      >
                        <span>{section.label}</span>
                        <ChevronDown
                          className={cn(
                            'w-3 h-3 transition-transform duration-200',
                            !isOpen && '-rotate-90',
                          )}
                        />
                      </button>
                    )}

                    {/* Items — always shown when in icon-rail mode */}
                    {(collapsed || isOpen) && (
                      <ul className="space-y-0.5">
                        {section.items.filter(isModuleAllowed).map((item) => {
                          const active = checkActive(item.href);
                          return (
                            <li key={item.name}>
                              <Link
                                href={item.href}
                                title={collapsed ? item.name : undefined}
                                className={cn(
                                  'relative flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-150',
                                  collapsed ? 'justify-center px-2 py-3' : 'px-3 py-2.5',
                                  active
                                    ? 'bg-primary/10 text-primary dark:bg-primary/15'
                                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white',
                                )}
                              >
                                {active && !collapsed && (
                                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-primary" />
                                )}
                                <item.icon
                                  className={cn(
                                    'w-5 h-5 shrink-0',
                                    active ? 'text-primary' : '',
                                  )}
                                />
                                {!collapsed && <span>{item.name}</span>}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {/* Thin divider between sections (not after the last) */}
                    {!collapsed && idx < groupedNav.length - 1 && (
                      <div className="mt-2 mb-1.5 mx-2 h-px bg-gray-100 dark:bg-gray-800" />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Flat nav for realtor / client / staff / super-admin */
            <ul className="space-y-0.5">
              {navigation.filter(isModuleAllowed).map((item) => {
                const active = checkActive(item.href);
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.name : undefined}
                      className={cn(
                        'relative flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-150',
                        collapsed ? 'justify-center px-2 py-3' : 'px-3 py-2.5',
                        role === 'super-admin'
                          ? active
                            ? ''
                            : 'text-gray-500 hover:bg-black/[0.04] hover:text-gray-800'
                          : active
                            ? 'bg-primary/10 text-primary dark:bg-primary/15'
                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white',
                      )}
                      style={role === 'super-admin' && active
                        ? { backgroundColor: `${saColor}26`, color: saColor }
                        : {}}
                    >
                      {active && !collapsed && (
                        <span
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full"
                          style={role === 'super-admin'
                            ? { backgroundColor: saColor }
                            : { backgroundColor: 'hsl(var(--primary))' }}
                        />
                      )}
                      <item.icon
                        className="w-5 h-5 shrink-0"
                        style={active && role === 'super-admin' ? { color: saColor } : {}}
                      />
                      {!collapsed && <span>{item.name}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>

        {/* ── Bottom: expand + Settings + Logout ── */}
        <div
          className={cn(
            'px-2 py-3 space-y-0.5 shrink-0 border-t',
            'border-gray-100 dark:border-gray-800',
          )}
        >
          {collapsed && (
            <button
              onClick={() => onCollapsedChange?.(false)}
              title="Expand sidebar"
              className={cn(
                'w-full flex justify-center px-2 py-2.5 rounded-xl transition-colors',
                'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600',
              )}
            >
              <ChevronLeft className="w-5 h-5 rotate-180" />
            </button>
          )}

          <Link
            href={`/dashboard/${role}/settings`}
            title={collapsed ? 'Settings' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-xl text-sm font-medium transition-all',
              'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white',
              collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
            )}
          >
            <Settings className="w-5 h-5 shrink-0" />
            {!collapsed && <span>Settings</span>}
          </Link>

          <button
            onClick={() => {
              clearAuth();
              router.push('/auth/login');
            }}
            title={collapsed ? 'Logout' : undefined}
            className={cn(
              'w-full flex items-center gap-3 rounded-xl text-sm font-medium transition-all',
              'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20',
              collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
            )}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
