'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Building2, Zap, Camera, Users, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const NAV_ITEMS = [
  { href: '/',           label: 'Home',       icon: Home      },
  { href: '/properties', label: 'Properties', icon: Building2 },
  { href: '/features',   label: 'Features',   icon: Zap       },
  { href: '/gallery',    label: 'Gallery',    icon: Camera    },
  { href: '/about',      label: 'About',      icon: Users     },
  { href: '/contact',    label: 'Contact',    icon: Phone     },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <div
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
      style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
    >
      <nav className="pointer-events-auto flex items-center gap-0.5 bg-white/85 dark:bg-gray-900/85 backdrop-blur-2xl border border-white/60 dark:border-gray-700/60 shadow-2xl shadow-black/20 rounded-[28px] px-2 py-1.5">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link key={item.label} href={item.href}>
              <motion.div
                whileTap={{ scale: 0.88 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="relative flex flex-col items-center justify-center gap-0.5 w-12 h-12 rounded-[18px] cursor-pointer select-none"
              >
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      layoutId="bottom-nav-active"
                      className="absolute inset-0 bg-green-700 rounded-[18px]"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                    />
                  )}
                </AnimatePresence>

                <Icon
                  className={`w-4 h-4 relative z-10 transition-colors duration-200 ${
                    isActive ? 'text-white' : 'text-gray-400 dark:text-gray-500'
                  }`}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
                <span
                  className={`text-[9px] font-medium relative z-10 transition-colors duration-200 leading-none ${
                    isActive ? 'text-white' : 'text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {item.label}
                </span>
              </motion.div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
