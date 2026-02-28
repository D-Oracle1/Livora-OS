'use client';

import Link from 'next/link';
import { Building2, ArrowRight, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const description = (typeof cmsData?.description === 'string' ? cmsData.description : null) || `${companyName} — your trusted partner in real estate.`;
  const quickLinks: { label: string; href: string }[] = Array.isArray(cmsData?.quickLinks) ? cmsData.quickLinks.map((l: any) => ({
    label: typeof l.label === 'string' ? l.label : l.label?.name || '',
    href: l.href || '#',
  })) : [
    { label: 'Home', href: '/' },
    { label: 'Properties', href: '/properties' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ];
  // Normalise: services can be string[] or {name:string}[]
  const services: string[] = (cmsData?.services || []).map((s: any) =>
    typeof s === 'string' ? s : (s?.name || s?.label || '')
  ).filter(Boolean);

  return (
    <footer className="py-12 px-4 bg-primary dark:bg-primary-950 border-t border-primary-600">
      <div className="container mx-auto">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              {logoUrl ? (
                <img src={logoUrl} alt={companyName} className="w-10 h-10 rounded-lg object-contain" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
              )}
              <span className="text-xl font-bold text-white">{companyName}</span>
            </div>
            {description && <p className="text-white/70 text-sm">{description}</p>}
          </div>
          {quickLinks.length > 0 && (
            <div>
              <h4 className="font-semibold text-white mb-4">Quick Links</h4>
              <ul className="space-y-2">
                {quickLinks.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-white/70 hover:text-accent transition-colors text-sm">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {services.length > 0 && (
            <div>
              <h4 className="font-semibold text-white mb-4">Services</h4>
              <ul className="space-y-2">
                {services.map((service, i) => (
                  <li key={i}>
                    <Link href="#" className="text-white/70 hover:text-accent transition-colors text-sm">
                      {service}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <h4 className="font-semibold text-white mb-4">Newsletter</h4>
            <p className="text-white/70 text-sm mb-4">Subscribe to get updates on new properties and offers.</p>
            <form
              onSubmit={(e) => { e.preventDefault(); handleSubscribe(); }}
              className="flex gap-2"
            >
              <input
                type="email"
                placeholder="Your email"
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                disabled={subscribing}
                className="flex-1 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/50 text-sm focus:ring-2 focus:ring-accent focus:border-transparent outline-none disabled:opacity-50"
              />
              <Button type="submit" disabled={subscribing} className="bg-accent hover:bg-accent-600 text-white">
                {subscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : subscribed ? <Check className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </Button>
            </form>
          </div>
        </div>
        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-white/70">
            &copy; {new Date().getFullYear()} {companyName}. All rights reserved.
          </p>
          <div className="flex gap-6">
            {['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map((link) => (
              <Link key={link} href="#" className="text-white/70 hover:text-accent transition-colors text-sm">
                {link}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
