'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth-storage';
import { toast } from 'sonner';
import { usePusher } from './pusher-context';
import { playNotificationSound, playCalloutSound, playCalloutResponseSound } from '@/lib/notification-sounds';

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  isRead: boolean;
  data: any;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface SaleApprovalData {
  saleId: string;
  propertyTitle?: string;
  salePrice?: number;
  realtorName?: string;
  clientName?: string;
  paymentPlan?: string;
}

export interface CalloutData {
  calloutId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  callerPosition?: string;
  callerDepartment?: string;
  message?: string;
  timestamp: string;
}

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  isConnected: boolean;
  isLoading: boolean;
  pendingSaleApproval: SaleApprovalData | null;
  showApprovalModal: boolean;
  pendingCallout: CalloutData | null;
  showCalloutModal: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  dismissApprovalModal: () => void;
  dismissCalloutModal: () => void;
  respondToCallout: (calloutId: string, response: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { isConnected, subscribeToUserEvent, unsubscribeFromUserEvent } = usePusher();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingSaleApproval, setPendingSaleApproval] = useState<SaleApprovalData | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [pendingCallout, setPendingCallout] = useState<CalloutData | null>(null);
  const [showCalloutModal, setShowCalloutModal] = useState(false);
  const mountedRef = useRef(true);

  const isDemo = () => getToken() === 'demo-token';

  // Clear PWA badge
  const clearBadge = useCallback(() => {
    try {
      if ('clearAppBadge' in navigator) {
        (navigator as any).clearAppBadge();
      }
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_BADGE' });
      }
    } catch {
      // Badge API not supported
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    const token = getToken();
    if (!token || isDemo()) return;

    setIsLoading(true);
    try {
      const res = await api.get<{ data: Notification[]; meta: { unreadCount: number } }>('/notifications?limit=50');
      if (mountedRef.current) {
        setNotifications(res.data || []);
        setUnreadCount(res.meta?.unreadCount ?? 0);
      }
    } catch {
      // API not available - silently fail
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    const token = getToken();
    if (!token || isDemo()) {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
      return;
    }

    try {
      await api.post(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      toast.error('Failed to mark notification as read');
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    const token = getToken();
    if (!token || isDemo()) {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
      setUnreadCount(0);
      clearBadge();
      return;
    }

    try {
      await api.post('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
      setUnreadCount(0);
      clearBadge();
    } catch {
      toast.error('Failed to mark all as read');
    }
  }, [clearBadge]);

  const deleteNotification = useCallback(async (id: string) => {
    const token = getToken();
    const notification = notifications.find((n) => n.id === id);

    if (!token || isDemo()) {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (notification && !notification.isRead) setUnreadCount((prev) => Math.max(0, prev - 1));
      return;
    }

    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (notification && !notification.isRead) setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      toast.error('Failed to delete notification');
    }
  }, [notifications]);

  const dismissApprovalModal = useCallback(() => {
    setShowApprovalModal(false);
    setPendingSaleApproval(null);
  }, []);

  const dismissCalloutModal = useCallback(() => {
    setShowCalloutModal(false);
    setPendingCallout(null);
  }, []);

  const respondToCallout = useCallback(async (calloutId: string, response: string) => {
    try {
      await api.post(`/notifications/callout/${calloutId}/respond`, { response });
      setShowCalloutModal(false);
      setPendingCallout(null);
      toast.success('Response sent');
    } catch {
      toast.error('Failed to send response');
    }
  }, []);

  // Fetch notifications on mount and clear badge
  useEffect(() => {
    mountedRef.current = true;
    fetchNotifications();
    clearBadge();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchNotifications, clearBadge]);

  // Clear badge when app regains focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        clearBadge();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', clearBadge);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', clearBadge);
    };
  }, [clearBadge]);

  // Listen for realtime events on the user's channel
  useEffect(() => {
    const handleNewNotification = (notification: Notification) => {
      if (!mountedRef.current) return;
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);

      // Trigger sale approval modal for admin
      if (notification.type === 'SALE' && notification.priority === 'HIGH' && notification.data?.saleId) {
        setPendingSaleApproval({
          saleId: notification.data.saleId,
          propertyTitle: notification.data.propertyTitle,
          salePrice: notification.data.salePrice,
          realtorName: notification.data.realtorName,
          clientName: notification.data.clientName,
          paymentPlan: notification.data.paymentPlan,
        });
        setShowApprovalModal(true);
      }

      playNotificationSound();
      toast(notification.title, { description: notification.message });
    };

    const handleCallout = (data: CalloutData) => {
      if (!mountedRef.current) return;
      setPendingCallout(data);
      setShowCalloutModal(true);
      playCalloutSound();
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 200]);
      }
    };

    const handleCalloutResponse = (data: { responderName: string; response: string }) => {
      if (!mountedRef.current) return;
      playCalloutResponseSound();
      toast.success(`${data.responderName}: ${data.response}`, {
        duration: 10000,
        description: 'Callout response received',
      });
    };

    subscribeToUserEvent('notification:new', handleNewNotification);
    subscribeToUserEvent('callout:receive', handleCallout);
    subscribeToUserEvent('callout:response', handleCalloutResponse);

    return () => {
      unsubscribeFromUserEvent('notification:new', handleNewNotification);
      unsubscribeFromUserEvent('callout:receive', handleCallout);
      unsubscribeFromUserEvent('callout:response', handleCalloutResponse);
    };
  }, [subscribeToUserEvent, unsubscribeFromUserEvent]);

  // Re-fetch when user changes
  useEffect(() => {
    const handleUserUpdated = () => fetchNotifications();
    window.addEventListener('user-updated', handleUserUpdated);
    return () => window.removeEventListener('user-updated', handleUserUpdated);
  }, [fetchNotifications]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isConnected,
        isLoading,
        pendingSaleApproval,
        showApprovalModal,
        pendingCallout,
        showCalloutModal,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        dismissApprovalModal,
        dismissCalloutModal,
        respondToCallout,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return ctx;
}
