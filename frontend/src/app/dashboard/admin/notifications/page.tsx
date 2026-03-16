'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  Check,
  CheckCheck,
  Home,
  Users,
  Award,
  AlertCircle,
  Info,
  Trash2,
  MessageSquare,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, formatDate } from '@/lib/utils';
import { useNotifications } from '@/contexts/notification-context';
import { NairaSign } from '@/components/icons/naira-sign';

const getIcon = (type: string) => {
  switch (type) {
    case 'SALE': return <NairaSign className="w-5 h-5 text-green-600" />;
    case 'COMMISSION': return <NairaSign className="w-5 h-5 text-primary" />;
    case 'PROPERTY': case 'LISTING': case 'PRICE_CHANGE': return <Home className="w-5 h-5 text-purple-600" />;
    case 'RANKING': case 'LOYALTY': return <Award className="w-5 h-5 text-yellow-600" />;
    case 'CHAT': return <MessageSquare className="w-5 h-5 text-blue-600" />;
    case 'OFFER': return <NairaSign className="w-5 h-5 text-orange-600" />;
    case 'SYSTEM': return <AlertCircle className="w-5 h-5 text-red-600" />;
    default: return <Bell className="w-5 h-5" />;
  }
};

const getBgColor = (type: string) => {
  switch (type) {
    case 'SALE': return 'bg-green-100';
    case 'COMMISSION': return 'bg-primary/10';
    case 'PROPERTY': case 'LISTING': case 'PRICE_CHANGE': return 'bg-purple-100';
    case 'RANKING': case 'LOYALTY': return 'bg-yellow-100';
    case 'CHAT': return 'bg-blue-100';
    case 'OFFER': return 'bg-orange-100';
    case 'SYSTEM': return 'bg-red-100';
    default: return 'bg-gray-100';
  }
};

export default function NotificationsPage() {
  const { notifications, unreadCount, isLoading, fetchNotifications, markAsRead, markAllAsRead, deleteNotification } = useNotifications();

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Bell className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Notifications</h2>
                  <p className="text-muted-foreground">
                    You have {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={markAllAsRead} disabled={unreadCount === 0}>
                  <CheckCheck className="w-4 h-4 mr-2" />
                  Mark All Read
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Notifications List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>All Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading notifications...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No notifications yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map((notification, index) => (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + index * 0.05 }}
                    className={cn(
                      'flex items-start gap-4 p-4 rounded-lg transition-colors',
                      notification.isRead
                        ? 'bg-gray-50 dark:bg-gray-800/30'
                        : 'bg-primary/5 border-l-4 border-primary'
                    )}
                  >
                    <div className={cn('p-2 rounded-lg', getBgColor(notification.type))}>
                      {getIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{notification.title}</p>
                          <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                          <p className="text-xs text-muted-foreground mt-2">{formatDate(notification.createdAt)}</p>
                        </div>
                        {!notification.isRead && (
                          <Badge className="bg-primary shrink-0">New</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!notification.isRead && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => markAsRead(notification.id)}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteNotification(notification.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
