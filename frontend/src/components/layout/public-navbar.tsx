'use client';

import Link from 'next/link';
import { Building2, Search, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { getImageUrl } from '@/lib/api';
import { useBranding, getCompanyName } from '@/hooks/use-branding';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/properties', label: 'Properties' },
  { href: '/features', label: 'Features' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/about', label: 'About Us' },
  { href: '/contact', label: 'Contact' },
];

interface PublicNavbarProps {
  currentPage?: string;
}

export function PublicNavbar({ currentPage }: PublicNavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const branding = useBranding();

  const companyName = getCompanyName(branding);
  const logoUrl = branding.logo
    ? branding.logo.startsWith('http') ? branding.logo : getImageUrl(branding.logo)
    : '';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled ? 'py-2' : 'py-4',
      )}
    >
      <div className={cn(
        'mx-auto transition-all duration-300',
        scrolled ? 'max-w-6xl px-4' : 'max-w-7xl px-6',
      )}>
        <div className={cn(
          'flex items-center justify-between transition-all duration-300',
          scrolled
            ? 'bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl shadow-lg shadow-black/[0.06] rounded-2xl px-5 h-14 border border-gray-100 dark:border-gray-800'
            : 'bg-transparent px-0 h-16',
        )}>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={companyName}
                className={cn(
                  'w-8 h-8 rounded-lg object-contain transition-all duration-300',
                  scrolled ? 'brightness-0 dark:brightness-0 dark:invert' : '',
                )}
              />
            ) : (
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                scrolled ? 'bg-green-700' : 'bg-white/20 backdrop-blur-sm border border-white/30',
              )}>
                <Building2 className="w-4 h-4 text-white" />
              </div>
            )}
            <span className={cn(
              'text-base font-bold tracking-tight transition-colors',
              scrolled ? 'text-green-700 dark:text-green-400' : 'text-white',
            )}>
              {companyName}
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className={cn(
            'hidden md:flex items-center gap-1 rounded-xl px-2 py-1 transition-all duration-300',
            scrolled ? 'bg-gray-50 dark:bg-gray-900' : 'bg-white/10 backdrop-blur-sm border border-white/20',
          )}>
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'relative px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                  currentPage === link.href
                    ? scrolled
                      ? 'text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/30'
                      : 'text-white bg-white/20'
                    : scrolled
                      ? 'text-gray-600 dark:text-gray-400 hover:text-green-700 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-gray-800'
                      : 'text-white/80 hover:text-white hover:bg-white/15',
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Mobile: search icon only */}
            <Link
              href="/properties"
              className={cn(
                'flex items-center justify-center w-9 h-9 rounded-xl transition-all md:w-8 md:h-8',
                scrolled
                  ? 'text-gray-500 hover:text-green-700 hover:bg-green-50 dark:text-gray-400 dark:hover:bg-gray-800'
                  : 'text-white/80 hover:text-white hover:bg-white/15',
              )}
            >
              <Search className="w-4 h-4" />
            </Link>

            {/* Desktop only */}
            <Link
              href="/auth/login"
              className={cn(
                'hidden md:block text-sm font-medium px-3 py-1.5 rounded-xl transition-all',
                scrolled
                  ? 'text-gray-600 dark:text-gray-400 hover:text-green-700 hover:bg-green-50 dark:hover:bg-gray-800'
                  : 'text-white/85 hover:text-white hover:bg-white/15',
              )}
            >
              Log in
            </Link>

            <Link href="/auth/register" className="hidden md:block">
              <div className={cn(
                'flex items-center gap-1.5 pl-4 pr-3 py-2 rounded-xl text-sm font-semibold transition-all',
                scrolled
                  ? 'bg-green-700 hover:bg-green-600 text-white shadow-sm shadow-green-900/20'
                  : 'bg-white text-green-800 hover:bg-green-50',
              )}>
                Get Started
                <ChevronRight className="w-3.5 h-3.5 opacity-70" />
              </div>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
