'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Bell,
  Search,
  Sun,
  Moon,
  Menu,
  X,
  User,
  Settings,
  LogOut,
  ChevronDown,
  DollarSign,
  Home,
  Award,
  AlertCircle,
  MessageSquare,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNotifications } from '@/contexts/notification-context';
import { CalloutButton } from '@/components/callout/callout-button';
import { cn } from '@/lib/utils';
import { getImageUrl } from '@/lib/api';
import { getUser, clearAuth } from '@/lib/auth-storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HeaderProps {
  onMenuClick?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'SALE':
      return <DollarSign className="w-3.5 h-3.5 text-emerald-600" />;
    case 'COMMISSION':
      return <DollarSign className="w-3.5 h-3.5 text-primary" />;
    case 'PROPERTY':
    case 'LISTING':
    case 'PRICE_CHANGE':
      return <Home className="w-3.5 h-3.5 text-purple-600" />;
    case 'RANKING':
    case 'LOYALTY':
      return <Award className="w-3.5 h-3.5 text-yellow-600" />;
    case 'CHAT':
      return <MessageSquare className="w-3.5 h-3.5 text-blue-600" />;
    case 'OFFER':
      return <DollarSign className="w-3.5 h-3.5 text-orange-600" />;
    case 'SYSTEM':
      return <AlertCircle className="w-3.5 h-3.5 text-red-600" />;
    default:
      return <Bell className="w-3.5 h-3.5 text-muted-foreground" />;
  }
};

function timeAgo(dateStr: string) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

// Role-specific action button configs
const ACTION_CONFIG: Record<
  string,
  { label: string; href: string } | null
> = {
  admin: { label: 'New Post', href: '/dashboard/admin/engagement' },
  realtor: { label: 'New Sale', href: '/dashboard/realtor/sales' },
  client: { label: 'View Feed', href: '/dashboard/client/feed' },
  staff: { label: 'New Task', href: '/dashboard/staff/tasks' },
  'super-admin': null,
  'general-overseer': null,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Header({ onMenuClick }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [showSearch, setShowSearch] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  const { notifications, unreadCount, markAsRead } = useNotifications();

  // Determine current role from pathname
  const role = pathname.includes('/dashboard/admin') || pathname.includes('/dashboard/super-admin')
    ? pathname.includes('/dashboard/super-admin') ? 'super-admin' : 'admin'
    : pathname.includes('/dashboard/general-overseer')
    ? 'general-overseer'
    : pathname.includes('/dashboard/realtor')
    ? 'realtor'
    : pathname.includes('/dashboard/staff')
    ? 'staff'
    : 'client';

  const getChatPath = () => {
    if (role === 'general-overseer') return '/dashboard/general-overseer';
    return `/dashboard/${role}/chat`;
  };

  const actionConfig = ACTION_CONFIG[role];

  // Current user
  const [currentUser, setCurrentUser] = useState<{
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    avatar?: string;
  } | null>(null);

  useEffect(() => {
    const load = () => setCurrentUser(getUser());
    load();
    window.addEventListener('user-updated', load);
    return () => window.removeEventListener('user-updated', load);
  }, [pathname]);

  const userName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'User';
  const userInitials = currentUser ? `${currentUser.firstName[0]}${currentUser.lastName[0]}` : 'U';

  // Auto-hide on scroll
  const handleScroll = useCallback(() => {
    const y = window.scrollY;
    if (y < 10) {
      setVisible(true);
    } else if (y > lastScrollY.current && y > 60) {
      setVisible(false);
      setShowProfileMenu(false);
      setShowNotifications(false);
    } else if (y < lastScrollY.current) {
      setVisible(true);
    }
    lastScrollY.current = y;
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    clearAuth();
    router.push('/auth/login');
  };

  const isOnChatPage = pathname.includes('/chat');
  const recentNotifications = notifications.slice(0, 5);

  const isSuperAdmin = role === 'super-admin';

  return (
    <header
      className={cn(
        'sticky top-0 z-[60] h-16',
        isSuperAdmin
          ? 'bg-white shadow-[0_2px_10px_rgba(0,0,0,0.05)] border-b border-gray-100'
          : 'bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800',
        'px-4 md:px-5 flex items-center justify-between gap-4',
        'transition-transform duration-300',
        visible ? 'translate-y-0' : '-translate-y-full',
      )}
    >
      {/* ── Left: mobile menu + search ── */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Mobile hamburger */}
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Desktop pill search */}
        <div className="hidden md:flex relative max-w-xs w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search..."
            className={cn(
              'w-full h-9 pl-10 pr-4 text-sm rounded-full',
              'bg-gray-100 dark:bg-gray-800',
              'border border-transparent focus:border-primary/30 focus:bg-white dark:focus:bg-gray-800',
              'text-gray-900 dark:text-gray-100 placeholder:text-gray-400',
              'outline-none transition-all',
            )}
          />
        </div>
      </div>

      {/* ── Right: actions ── */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Gradient action button (desktop) */}
        {actionConfig && (
          <Link
            href={actionConfig.href}
            className={cn(
              'hidden sm:flex items-center gap-1.5 h-8 px-3.5 rounded-full text-xs font-semibold text-white',
              'bg-gradient-to-r from-primary to-emerald-500',
              'hover:opacity-90 transition-opacity shadow-sm',
            )}
          >
            <Plus className="w-3.5 h-3.5" />
            {actionConfig.label}
          </Link>
        )}

        {/* Mobile search toggle */}
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="md:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
        >
          {showSearch ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
        </button>

        {/* Chat */}
        {!isOnChatPage && (
          <button
            onClick={() => router.push(getChatPath())}
            title="Chat"
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <MessageSquare className="w-5 h-5" />
          </button>
        )}

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="relative p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          <Sun className="w-5 h-5 transition-all rotate-0 scale-100 dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute inset-0 m-auto w-5 h-5 transition-all rotate-90 scale-0 dark:rotate-0 dark:scale-100" />
        </button>

        {/* Callout button (admin/staff only) */}
        {(role === 'admin' || role === 'staff') && <CalloutButton />}

        {/* Notifications */}
        <div className="relative" ref={notificationRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-1rem)] bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <h3 className="font-semibold text-sm text-gray-900 dark:text-white">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="text-xs font-medium text-primary">{unreadCount} new</span>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {recentNotifications.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No notifications yet
                  </div>
                ) : (
                  recentNotifications.map((n) => (
                    <button
                      key={n.id}
                      className={cn(
                        'w-full flex items-start gap-3 px-4 py-3 text-left',
                        'hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors',
                        'border-b border-gray-50 dark:border-gray-800 last:border-b-0',
                        !n.isRead && 'bg-primary/5',
                      )}
                      onClick={async () => {
                        if (!n.isRead) await markAsRead(n.id);
                        if (n.link) {
                          setShowNotifications(false);
                          router.push(n.link);
                        }
                      }}
                    >
                      <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 mt-0.5">
                        {getNotificationIcon(n.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm text-gray-900 dark:text-white', !n.isRead && 'font-semibold')}>
                          {n.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">{timeAgo(n.createdAt)}</p>
                      </div>
                      {!n.isRead && (
                        <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>

              <div className="border-t border-gray-100 dark:border-gray-800 p-2">
                <Link
                  href={`/dashboard/${role}/notifications`}
                  onClick={() => setShowNotifications(false)}
                  className="block text-center text-xs text-primary hover:underline py-1.5 font-medium"
                >
                  View all notifications
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User avatar + dropdown */}
        <div className="relative" ref={profileMenuRef}>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-1.5 p-1 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Avatar key={currentUser?.avatar || 'no-avatar'} className="w-8 h-8">
              {currentUser?.avatar && (
                <AvatarImage src={getImageUrl(currentUser.avatar)} alt={userName} />
              )}
              <AvatarFallback className="bg-primary text-white text-xs font-semibold">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <ChevronDown
              className={cn(
                'w-3.5 h-3.5 hidden md:block text-gray-400 transition-transform',
                showProfileMenu && 'rotate-180',
              )}
            />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 py-2 z-50">
              <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
                <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{userName}</p>
                <p className="text-xs text-muted-foreground capitalize mt-0.5">
                  {currentUser?.role?.toLowerCase().replace(/_/g, ' ')}
                </p>
              </div>
              <Link
                href={`/dashboard/${role}/settings`}
                onClick={() => setShowProfileMenu(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <User className="w-4 h-4" />
                My Profile
              </Link>
              <Link
                href={`/dashboard/${role}/settings`}
                onClick={() => setShowProfileMenu(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <Settings className="w-4 h-4" />
                Settings
              </Link>
              <div className="border-t border-gray-100 dark:border-gray-800 my-1" />
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-2.5 w-full text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile search bar (drops below header) */}
      {showSearch && (
        <div className="absolute top-16 left-0 right-0 p-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 md:hidden z-20">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search..."
              autoFocus
              className="w-full h-9 pl-10 pr-4 text-sm rounded-full bg-gray-100 dark:bg-gray-800 border border-transparent focus:border-primary/30 focus:bg-white dark:focus:bg-gray-800 outline-none"
            />
          </div>
        </div>
      )}
    </header>
  );
}
