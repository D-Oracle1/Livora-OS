'use client';

import Link from 'next/link';
import { Building2, Menu, X, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { getImageUrl } from '@/lib/api';
import { useBranding, getCompanyName } from '@/hooks/use-branding';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About Us' },
  { href: '/properties', label: 'Property List' },
  { href: '/contact', label: 'Contact Us' },
];

const PAGES_LINKS = [
  { href: '/features', label: 'Features' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/platform', label: 'Platform' },
  { href: '/auth/login', label: 'Login' },
  { href: '/auth/register', label: 'Register' },
];

interface PublicNavbarProps {
  currentPage?: string;
}

export function PublicNavbar({ currentPage }: PublicNavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pagesOpen, setPagesOpen] = useState(false);
  const pagesRef = useRef<HTMLDivElement>(null);
  const branding = useBranding();

  const companyName = getCompanyName(branding);
  const logoUrl = branding.logo ? (branding.logo.startsWith('http') ? branding.logo : getImageUrl(branding.logo)) : '';

  // Close pages dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pagesRef.current && !pagesRef.current.contains(e.target as Node)) {
        setPagesOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <nav className="fixed top-0 w-full z-50 bg-white shadow-sm">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt={companyName} className="h-9 w-auto object-contain" />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
          )}
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-7">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'text-sm transition-colors',
                currentPage === link.href
                  ? 'font-bold text-gray-900'
                  : 'font-medium text-gray-500 hover:text-gray-900',
              )}
            >
              {link.label}
            </Link>
          ))}

          {/* Pages dropdown */}
          <div ref={pagesRef} className="relative">
            <button
              onClick={() => setPagesOpen(v => !v)}
              className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              Pages
              <ChevronDown className={cn('w-4 h-4 transition-transform', pagesOpen && 'rotate-180')} />
            </button>
            {pagesOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 min-w-[160px] z-50">
                {PAGES_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setPagesOpen(false)}
                    className="block px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CTA button */}
        <div className="hidden md:flex items-center">
          <Link href="/properties">
            <button className="bg-primary hover:bg-primary-800 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
              Explore Properties
            </button>
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 space-y-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'block py-2.5 text-sm transition-colors',
                currentPage === link.href
                  ? 'font-bold text-gray-900'
                  : 'font-medium text-gray-500 hover:text-gray-900',
              )}
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          {PAGES_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block py-2.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-3">
            <Link href="/properties" onClick={() => setMobileOpen(false)}>
              <button className="w-full bg-primary hover:bg-primary-800 text-white text-sm font-semibold py-3 rounded-lg transition-colors">
                Explore Properties
              </button>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
