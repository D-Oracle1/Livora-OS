'use client';

import Link from 'next/link';
import { Building2, ArrowRight, Loader2, Check, Leaf, MapPin, Phone, Mail } from 'lucide-react';
import { useState } from 'react';
import { getImageUrl } from '@/lib/api';
import { toast } from 'sonner';
import { useBranding, getCompanyName } from '@/hooks/use-branding';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').trim();

interface FooterData {
  description?: string;
  quickLinks?: { label: string; href: string }[];
  services?: string[];
}

export function PublicFooter({ cmsData }: { cmsData?: FooterData }) {
  const branding = useBranding();
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [subscribing, setSubscribing] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = async () => {
    if (!newsletterEmail || !newsletterEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    setSubscribing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/newsletter/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newsletterEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Subscription failed');
      toast.success(data.message || 'Subscribed successfully!');
      setNewsletterEmail('');
      setSubscribed(true);
      setTimeout(() => setSubscribed(false), 3000);
    } catch (err: any) {
      toast.error(err.message || 'Failed to subscribe. Please try again.');
    } finally {
      setSubscribing(false);
    }
  };

  const companyName = getCompanyName(branding);
  const logoUrl = branding.logo ? (branding.logo.startsWith('http') ? branding.logo : getImageUrl(branding.logo)) : '';
  const description = (typeof cmsData?.description === 'string' ? cmsData.description : null) || `${companyName} — your trusted partner in eco-friendly real estate.`;
  const quickLinks: { label: string; href: string }[] = Array.isArray(cmsData?.quickLinks)
    ? cmsData.quickLinks.map((l: any) => ({ label: typeof l.label === 'string' ? l.label : l.label?.name || '', href: l.href || '#' }))
    : [
        { label: 'Home', href: '/' },
        { label: 'Properties', href: '/properties' },
        { label: 'Features', href: '/features' },
        { label: 'About Us', href: '/about' },
        { label: 'Contact', href: '/contact' },
      ];
  const services: string[] = (cmsData?.services || [])
    .map((s: any) => typeof s === 'string' ? s : (s?.name || s?.label || ''))
    .filter(Boolean);

  return (
    <footer className="bg-green-900 dark:bg-green-950">
      {/* Main footer content */}
      <div className="container mx-auto px-4 py-14">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Brand column */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-5">
              {logoUrl ? (
                <img src={logoUrl} alt={companyName} className="w-10 h-10 rounded-xl object-contain" />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-green-700 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
              )}
              <span className="text-xl font-bold text-white">{companyName}</span>
            </Link>
            <p className="text-white/80 text-sm leading-relaxed mb-6">{description}</p>
            <div className="flex items-center gap-2 text-white/70 text-xs">
              <Leaf className="w-3.5 h-3.5 text-green-300" />
              <span>Eco-Friendly Real Estate</span>
            </div>
          </div>

          {/* Quick links */}
          {quickLinks.length > 0 && (
            <div>
              <h4 className="font-semibold text-white mb-5 text-sm uppercase tracking-wider">Quick Links</h4>
              <ul className="space-y-3">
                {quickLinks.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-white/75 hover:text-white transition-colors text-sm flex items-center gap-2 group">
                      <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 -ml-1 transition-all" />
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Services */}
          {services.length > 0 && (
            <div>
              <h4 className="font-semibold text-white mb-5 text-sm uppercase tracking-wider">Services</h4>
              <ul className="space-y-3">
                {services.map((service, i) => (
                  <li key={i}>
                    <Link href="#" className="text-white/75 hover:text-white transition-colors text-sm flex items-center gap-2 group">
                      <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 -ml-1 transition-all" />
                      {service}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Newsletter */}
          <div>
            <h4 className="font-semibold text-white mb-5 text-sm uppercase tracking-wider">Newsletter</h4>
            <p className="text-white/80 text-sm mb-5 leading-relaxed">
              Subscribe to get updates on new eco-friendly properties and exclusive offers.
            </p>
            <form onSubmit={(e) => { e.preventDefault(); handleSubscribe(); }} className="flex gap-2">
              <input
                type="email"
                placeholder="Your email address"
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                disabled={subscribing}
                className="flex-1 px-4 py-2.5 rounded-full bg-white/10 border border-white/15 text-white placeholder:text-green-300/50 text-sm focus:ring-2 focus:ring-green-400 focus:border-transparent outline-none disabled:opacity-50 min-w-0"
              />
              <button
                type="submit"
                disabled={subscribing}
                className="flex-shrink-0 w-10 h-10 rounded-full bg-green-600 hover:bg-green-500 flex items-center justify-center transition-all disabled:opacity-60"
              >
                {subscribing ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : subscribed ? (
                  <Check className="w-4 h-4 text-white" />
                ) : (
                  <ArrowRight className="w-4 h-4 text-white" />
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="container mx-auto px-4 py-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-white/60">
            &copy; {new Date().getFullYear()} {companyName}. All rights reserved.
          </p>
          <div className="flex flex-wrap justify-center gap-5">
            {['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map((link) => (
              <Link key={link} href="#" className="text-white/60 hover:text-white transition-colors text-xs">
                {link}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
