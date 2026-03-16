'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Bell, Check, CheckCheck, Home, Award,
  AlertCircle, MessageSquare, Trash2, Loader2,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { useNotifications } from '@/contexts/notification-context';
import { NairaSign } from '@/components/icons/naira-sign';
import { usePlatformBranding } from '@/hooks/use-platform-branding';

const getIcon = (type: string) => {
  switch (type) {
    case 'SALE':       return <NairaSign className="w-5 h-5 text-emerald-600" />;
    case 'COMMISSION': return <NairaSign className="w-5 h-5 text-blue-600" />;
    case 'PROPERTY': case 'LISTING': case 'PRICE_CHANGE':
      return <Home className="w-5 h-5 text-purple-600" />;
    case 'RANKING': case 'LOYALTY':
      return <Award className="w-5 h-5 text-yellow-600" />;
    case 'CHAT':   return <MessageSquare className="w-5 h-5 text-blue-600" />;
    case 'OFFER':  return <NairaSign className="w-5 h-5 text-orange-600" />;
    case 'SYSTEM': return <AlertCircle className="w-5 h-5 text-red-600" />;
    default:       return <Bell className="w-5 h-5 text-gray-500" />;
  }
};

const getBgColor = (type: string) => {
  switch (type) {
    case 'SALE':       return 'bg-emerald-100';
    case 'COMMISSION': return 'bg-blue-100';
    case 'PROPERTY': case 'LISTING': case 'PRICE_CHANGE': return 'bg-purple-100';
    case 'RANKING': case 'LOYALTY': return 'bg-yellow-100';
    case 'CHAT':   return 'bg-blue-100';
    case 'OFFER':  return 'bg-orange-100';
    case 'SYSTEM': return 'bg-red-100';
    default:       return 'bg-gray-100';
  }
};

export default function NotificationsPage() {
  const { notifications, unreadCount, isLoading, fetchNotifications, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const branding = usePlatformBranding();
  const accent = branding.primaryColor || '#3b82f6';

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  return (
    <div className="space-y-5 p-3 sm:p-6">
      {/* Header card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="neuo-card p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${accent}18` }}
              >
                <Bell className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: accent }} />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-800">Notifications</h1>
                <p className="text-sm text-gray-500">
                  {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <button
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="neuo-btn flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 disabled:opacity-40 self-start sm:self-auto"
            >
              <CheckCheck className="w-4 h-4" />
              Mark All Read
            </button>
          </div>
        </div>
      </motion.div>

      {/* Notifications list */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="neuo-card overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">All Notifications</h2>
          </div>
          <div className="p-3 sm:p-4">
            {isLoading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-400">Loading...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map((notification, index) => (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 + index * 0.04 }}
                    className={cn(
                      'flex gap-3 p-3 sm:p-4 rounded-xl transition-colors',
                      notification.isRead ? 'bg-gray-50' : 'bg-white border-l-4 shadow-sm',
                    )}
                    style={!notification.isRead ? { borderLeftColor: accent } : {}}
                  >
                    {/* Icon */}
                    <div className={cn('w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5', getBgColor(notification.type))}>
                      {getIcon(notification.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <p className={cn('text-sm text-gray-800', !notification.isRead && 'font-semibold')}>
                          {notification.title}
                        </p>
                        {!notification.isRead && (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white shrink-0"
                            style={{ backgroundColor: accent }}
                          >
                            New
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{notification.message}</p>
                      <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                        <p className="text-xs text-gray-400">{formatDate(notification.createdAt)}</p>
                        {/* Actions inline under text for mobile */}
                        <div className="flex items-center gap-1">
                          {!notification.isRead && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                              title="Mark as read"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Read</span>
                            </button>
                          )}
                          <button
                            onClick={() => deleteNotification(notification.id)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
