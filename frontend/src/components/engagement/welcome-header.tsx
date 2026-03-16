'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Home,
  TrendingUp,
  FileText,
  Newspaper,
  MessageSquare,
  Bell,
  ArrowUpRight,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn, formatCurrency } from '@/lib/utils';
import { api } from '@/lib/api';
import { NairaSign } from '@/components/icons/naira-sign';
import { getUser } from '@/lib/auth-storage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PortfolioStats {
  totalProperties: number;
  totalPropertyValue: number;
  avgAppreciationPercentage: number;
  pendingOffers: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WelcomeHeader() {
  const router = useRouter();
  const [stats, setStats] = useState<PortfolioStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const user = getUser();
    if (user) setUserName(user.firstName || '');
  }, []);

  useEffect(() => {
    api
      .get('/clients/dashboard?period=monthly')
      .then((res: any) => {
        const s = (res?.data ?? res)?.stats;
        if (s) {
          setStats({
            totalProperties: s.totalProperties ?? 0,
            totalPropertyValue: s.totalPropertyValue ?? 0,
            avgAppreciationPercentage: s.avgAppreciationPercentage ?? 0,
            pendingOffers: s.pendingOffers ?? 0,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const metricCards = [
    {
      label: 'Properties',
      value: loading ? '—' : String(stats?.totalProperties ?? 0),
      icon: Home,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    },
    {
      label: 'Portfolio Value',
      value: loading ? '—' : formatCurrency(stats?.totalPropertyValue ?? 0),
      icon: NairaSign,
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
    },
    {
      label: 'Appreciation',
      value: loading ? '—' : `+${(stats?.avgAppreciationPercentage ?? 0).toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    },
    {
      label: 'Pending Offers',
      value: loading ? '—' : String(stats?.pendingOffers ?? 0),
      icon: FileText,
      color: 'text-blue-600',
      bg: 'bg-blue-50 dark:bg-blue-950/30',
    },
  ];

  const quickActions = [
    { label: 'Feed', icon: Newspaper, href: '/dashboard/client/feed' },
    { label: 'Properties', icon: Home, href: '/dashboard/client/properties' },
    { label: 'Messages', icon: MessageSquare, href: '/dashboard/client/chat' },
    { label: 'Notifications', icon: Bell, href: '/dashboard/client/notifications' },
  ];

  return (
    <Card className="border-0 shadow-sm bg-gradient-to-br from-[#0b5c46] to-[#0e7a5e] text-white overflow-hidden">
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-start gap-5">
          {/* Greeting + quick actions */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white/70 mb-0.5">{getGreeting()}</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-white truncate">
              {userName || 'Welcome back'}
            </h1>
            <p className="text-sm text-white/60 mt-1 mb-4">
              Here's your business overview for today
            </p>

            {/* Quick actions */}
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action) => (
                <Button
                  key={action.label}
                  size="sm"
                  variant="ghost"
                  className="bg-white/10 hover:bg-white/20 text-white border-0 gap-1.5 h-8 text-xs font-medium"
                  onClick={() => router.push(action.href)}
                >
                  <action.icon className="w-3.5 h-3.5" />
                  {action.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-2 lg:w-auto xl:w-[560px] shrink-0">
            {metricCards.map((m) => (
              <div
                key={m.label}
                className="bg-white/10 backdrop-blur-sm rounded-xl p-3 flex flex-col gap-1.5"
              >
                <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', m.bg)}>
                  <m.icon className={cn('w-3.5 h-3.5', m.color)} />
                </div>
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white/50" />
                ) : (
                  <p className="text-base font-bold text-white leading-tight">{m.value}</p>
                )}
                <p className="text-[11px] text-white/60 leading-tight">{m.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Portfolio value CTA row */}
        {!loading && (stats?.totalPropertyValue ?? 0) > 0 && (
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
            <p className="text-sm text-white/60">
              Your portfolio appreciated{' '}
              <span className="text-white font-semibold">
                +{(stats?.avgAppreciationPercentage ?? 0).toFixed(1)}%
              </span>{' '}
              from purchase price
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="bg-white/10 hover:bg-white/20 text-white gap-1 text-xs h-7"
              onClick={() => router.push('/dashboard/client/properties')}
            >
              View Details
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
