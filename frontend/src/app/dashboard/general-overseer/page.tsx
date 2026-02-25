'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  Users2,
  Home,
  UserCog,
  CalendarDays,
  BarChart3,
  Shield,
  Loader2,
  LayoutDashboard,
  Briefcase,
  ClipboardList,
  MessageSquare,
  Bell,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth-storage';

interface ConsoleCard {
  label: string;
  href: string;
  icon: React.ElementType;
  desc: string;
  iconBg: string;
  iconColor: string;
}

interface ConsoleSection {
  title: string;
  cards: ConsoleCard[];
}

const consoleSections: ConsoleSection[] = [
  {
    title: 'Overview',
    cards: [
      {
        label: 'Dashboard',
        href: '/dashboard/general-overseer',
        icon: LayoutDashboard,
        desc: 'Platform summary and key metrics',
        iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
        iconColor: 'text-emerald-700 dark:text-emerald-400',
      },
      {
        label: 'Analytics',
        href: '/dashboard/general-overseer/analytics',
        icon: BarChart3,
        desc: 'Platform-wide analytics and reports',
        iconBg: 'bg-blue-100 dark:bg-blue-900/40',
        iconColor: 'text-blue-700 dark:text-blue-400',
      },
    ],
  },
  {
    title: 'People',
    cards: [
      {
        label: 'Users',
        href: '/dashboard/general-overseer/users',
        icon: Users,
        desc: 'Manage all platform users and roles',
        iconBg: 'bg-violet-100 dark:bg-violet-900/40',
        iconColor: 'text-violet-700 dark:text-violet-400',
      },
      {
        label: 'Realtors',
        href: '/dashboard/general-overseer/realtors',
        icon: Users2,
        desc: 'View and oversee all realtors',
        iconBg: 'bg-sky-100 dark:bg-sky-900/40',
        iconColor: 'text-sky-700 dark:text-sky-400',
      },
      {
        label: 'Clients',
        href: '/dashboard/general-overseer/clients',
        icon: Briefcase,
        desc: 'Browse and manage client accounts',
        iconBg: 'bg-orange-100 dark:bg-orange-900/40',
        iconColor: 'text-orange-700 dark:text-orange-400',
      },
      {
        label: 'Staff',
        href: '/dashboard/general-overseer/staff',
        icon: UserCog,
        desc: 'View and manage staff members',
        iconBg: 'bg-teal-100 dark:bg-teal-900/40',
        iconColor: 'text-teal-700 dark:text-teal-400',
      },
    ],
  },
  {
    title: 'Properties',
    cards: [
      {
        label: 'Properties',
        href: '/dashboard/general-overseer/properties',
        icon: Home,
        desc: 'Browse all listed properties platform-wide',
        iconBg: 'bg-lime-100 dark:bg-lime-900/40',
        iconColor: 'text-lime-700 dark:text-lime-400',
      },
    ],
  },
  {
    title: 'HR & Leave',
    cards: [
      {
        label: 'HR',
        href: '/dashboard/general-overseer/hr',
        icon: ClipboardList,
        desc: 'Human resources records and management',
        iconBg: 'bg-pink-100 dark:bg-pink-900/40',
        iconColor: 'text-pink-700 dark:text-pink-400',
      },
      {
        label: 'Leave Approvals',
        href: '/dashboard/general-overseer/leave',
        icon: CalendarDays,
        desc: 'Review and approve leave requests',
        iconBg: 'bg-amber-100 dark:bg-amber-900/40',
        iconColor: 'text-amber-700 dark:text-amber-400',
      },
    ],
  },
  {
    title: 'System',
    cards: [
      {
        label: 'Audit Logs',
        href: '/dashboard/general-overseer/audit',
        icon: Shield,
        desc: 'Track system activity and security events',
        iconBg: 'bg-red-100 dark:bg-red-900/40',
        iconColor: 'text-red-700 dark:text-red-400',
      },
      {
        label: 'Chat',
        href: '/dashboard/general-overseer/chat',
        icon: MessageSquare,
        desc: 'Platform messaging and communications',
        iconBg: 'bg-cyan-100 dark:bg-cyan-900/40',
        iconColor: 'text-cyan-700 dark:text-cyan-400',
      },
      {
        label: 'Notifications',
        href: '/dashboard/general-overseer/notifications',
        icon: Bell,
        desc: 'Manage and broadcast platform notifications',
        iconBg: 'bg-indigo-100 dark:bg-indigo-900/40',
        iconColor: 'text-indigo-700 dark:text-indigo-400',
      },
    ],
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function GeneralOverseerDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const user = getUser();
    if (user) setUserName(`${user.firstName} ${user.lastName}`);
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res: any = await api.get('/users/stats');
        setStats(res?.data || res);
      } catch {
        setStats(null);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const statCards = [
    { title: 'Total Users', value: stats?.totalUsers ?? 0, icon: Users, gradient: 'from-[#0b5c46] to-[#0e7a5e]' },
    { title: 'Active Users', value: stats?.activeUsers ?? 0, icon: Shield, gradient: 'from-[#fca639] to-[#fdb95c]' },
    { title: 'Realtors', value: stats?.realtors ?? 0, icon: Home, gradient: 'from-[#0b5c46] to-[#14956e]' },
    { title: 'Clients', value: stats?.clients ?? 0, icon: Users, gradient: 'from-[#fca639] to-[#e8953a]' },
    { title: 'Admins', value: stats?.admins ?? 0, icon: UserCog, gradient: 'from-[#0b5c46] to-[#0e7a5e]' },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome back{userName ? `, ${userName}` : ''}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          MD &mdash; Full platform oversight and control
        </p>
      </motion.div>

      {/* Stat Cards */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {statCards.map((card) => (
          <motion.div key={card.title} variants={itemVariants}>
            <Card className={`bg-gradient-to-br ${card.gradient} text-white border-0 shadow-md`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <card.icon className="w-5 h-5 text-white/80" />
                </div>
                <div className="text-2xl font-bold">{card.value}</div>
                <div className="text-xs text-white/70 mt-0.5">{card.title}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Operations Console */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Operations Console</h2>
          <p className="text-sm text-muted-foreground">
            Navigate and manage every area of the platform from one place
          </p>
        </div>

        <div className="space-y-7">
          {consoleSections.map((section, sIdx) => (
            <div key={section.title}>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                {section.title}
              </h3>
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                {section.cards.map((card) => (
                  <motion.div
                    key={card.label}
                    variants={itemVariants}
                    custom={sIdx}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Link href={card.href} className="block h-full group">
                      <Card className="h-full border border-border/60 shadow-sm hover:shadow-md transition-shadow duration-200 bg-white dark:bg-card">
                        <CardContent className="p-4 flex items-start gap-4">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${card.iconBg}`}
                          >
                            <card.icon className={`w-5 h-5 ${card.iconColor}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                                {card.label}
                              </p>
                              <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                              {card.desc}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
