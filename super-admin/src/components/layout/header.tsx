'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Bell,
  Sun,
  Moon,
  Menu,
  User,
  Settings,
  LogOut,
  ChevronDown,
  Home,
  Award,
  AlertCircle,
  MessageSquare,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNotifications } from '@/contexts/notification-context';
import { cn } from '@/lib/utils';
import { getImageUrl } from '@/lib/api';
import { NairaSign } from '@/components/icons/naira-sign';
import { getUser, clearAuth } from '@/lib/auth-storage';
import { usePlatformBranding } from '@/hooks/use-platform-branding';

interface HeaderProps {
  onMenuClick?: () => void;
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'SALE':
      return <NairaSign className="w-3.5 h-3.5 text-emerald-600" />;
    case 'COMMISSION':
      return <NairaSign className="w-3.5 h-3.5 text-blue-600" />;
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
      return <NairaSign className="w-3.5 h-3.5 text-orange-600" />;
    case 'SYSTEM':
      return <AlertCircle className="w-3.5 h-3.5 text-red-600" />;
    default:
      return <Bell className="w-3.5 h-3.5 text-gray-500" />;
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

function getPageTitle(pathname: string): string {
  if (pathname === '/dashboard') return 'Platform Overview';
  if (pathname.startsWith('/dashboard/companies')) return 'Companies';
  if (pathname.startsWith('/dashboard/analytics')) return 'Analytics';
  if (pathname.startsWith('/dashboard/support')) return 'Support Inbox';
  if (pathname.startsWith('/dashboard/notifications')) return 'Notifications';
  if (pathname.startsWith('/dashboard/settings')) return 'Settings';
  return 'Dashboard';
}

export function Header({ onMenuClick }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const branding = usePlatformBranding();
  const accent = branding.primaryColor || '#f59e0b';

  const { notifications, unreadCount, markAsRead } = useNotifications();

  const pageTitle = getPageTitle(pathname);

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

  const userName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Super Admin';
  const userInitials = currentUser ? `${currentUser.firstName[0]}${currentUser.lastName[0]}` : 'SA';

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
    router.push('/login');
  };

  const recentNotifications = notifications.slice(0, 5);

  return (
    <header
      className={cn(
        'sticky top-0 z-[60] h-16',
        'bg-white shadow-[0_2px_10px_rgba(0,0,0,0.05)] border-b border-gray-100',
        'px-4 md:px-5 flex items-center justify-between gap-4',
        'transition-transform duration-300',
        visible ? 'translate-y-0' : '-translate-y-full',
      )}
    >
      {/* Left: mobile menu + page title */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Mobile hamburger */}
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Page title */}
        <h1 className="text-base font-semibold text-gray-800 truncate hidden md:block">{pageTitle}</h1>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="relative p-2 rounded-xl hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <Sun className="w-5 h-5 transition-all rotate-0 scale-100 dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute inset-0 m-auto w-5 h-5 transition-all rotate-90 scale-0 dark:rotate-0 dark:scale-100" />
        </button>

        {/* Notifications */}
        <div className="relative" ref={notificationRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-xl hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-1rem)] bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-sm text-gray-900">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="text-xs font-medium" style={{ color: accent }}>{unreadCount} new</span>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {recentNotifications.length === 0 ? (
                  <div className="p-6 text-center text-sm text-gray-400">
                    No notifications yet
                  </div>
                ) : (
                  recentNotifications.map((n) => (
                    <button
                      key={n.id}
                      className={cn(
                        'w-full flex items-start gap-3 px-4 py-3 text-left',
                        'hover:bg-gray-50 transition-colors',
                        'border-b border-gray-50 last:border-b-0',
                        !n.isRead && 'bg-amber-50/50',
                      )}
                      onClick={async () => {
                        if (!n.isRead) await markAsRead(n.id);
                        if (n.link) {
                          setShowNotifications(false);
                          router.push(n.link);
                        }
                      }}
                    >
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                        {getNotificationIcon(n.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm text-gray-900', !n.isRead && 'font-semibold')}>
                          {n.title}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-xs text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                      </div>
                      {!n.isRead && (
                        <div className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ backgroundColor: accent }} />
                      )}
                    </button>
                  ))
                )}
              </div>

              <div className="border-t border-gray-100 p-2">
                <Link
                  href="/dashboard/notifications"
                  onClick={() => setShowNotifications(false)}
                  className="block text-center text-xs hover:underline py-1.5 font-medium"
                  style={{ color: accent }}
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
            className="flex items-center gap-1.5 p-1 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <Avatar key={currentUser?.avatar || 'no-avatar'} className="w-8 h-8">
              {currentUser?.avatar && (
                <AvatarImage src={getImageUrl(currentUser.avatar)} alt={userName} />
              )}
              <AvatarFallback className="text-white text-xs font-semibold" style={{ backgroundColor: accent }}>
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
            <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50">
              <div className="px-4 py-2.5 border-b border-gray-100">
                <p className="font-semibold text-sm text-gray-900 truncate">{userName}</p>
                <p className="text-xs text-gray-400 mt-0.5">Super Administrator</p>
              </div>
              <Link
                href="/dashboard/settings"
                onClick={() => setShowProfileMenu(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <User className="w-4 h-4" />
                My Profile
              </Link>
              <Link
                href="/dashboard/settings"
                onClick={() => setShowProfileMenu(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <Settings className="w-4 h-4" />
                Settings
              </Link>
              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-2.5 w-full text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
