'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Building2,
  Check,
  Crown,
  Shield,
  Users,
  Home,
  BarChart3,
  MessageSquare,
  Headphones,
  Globe,
  Zap,
  Star,
  ArrowRight,
  Phone,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlatformBranding, getPlatformName } from '@/hooks/use-platform-branding';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').trim();

const PLANS = [
  {
    name: 'Starter',
    price: '₦49,999',
    period: '/month',
    description: 'Perfect for small real estate agencies just getting started.',
    color: 'from-slate-600 to-slate-700',
    borderColor: 'border-slate-600/40',
    popular: false,
    features: [
      'Up to 10 users',
      '50 property listings',
      'Basic CRM & client management',
      'Commission tracking',
      'Email support',
      'Mobile-friendly dashboard',
    ],
  },
  {
    name: 'Professional',
    price: '₦149,999',
    period: '/month',
    description: 'For growing agencies that need advanced tools and automation.',
    color: 'from-amber-500 to-amber-600',
    borderColor: 'border-amber-500/60',
    popular: true,
    features: [
      'Up to 50 users',
      'Unlimited property listings',
      'Full HR & payroll module',
      'Advanced analytics & reports',
      'Tax management',
      'Team channels & chat',
      'Loyalty & referral programs',
      'Priority support',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large firms with complex workflows and custom requirements.',
    color: 'from-violet-600 to-violet-700',
    borderColor: 'border-violet-500/40',
    popular: false,
    features: [
      'Unlimited users',
      'Unlimited everything',
      'Custom integrations',
      'Dedicated account manager',
      'White-label option',
      'SLA guarantee',
      'On-site training',
      '24/7 phone support',
    ],
  },
];

const FEATURES = [
  { icon: Home, title: 'Property Management', desc: 'List, track, and sell properties with powerful filters, image galleries, and virtual tours.' },
  { icon: Users, title: 'Team & HR', desc: 'Manage realtors, staff, attendance, leave, payroll, and performance reviews in one place.' },
  { icon: BarChart3, title: 'Analytics & Reports', desc: 'Real-time dashboards, sales analytics, tax reports, and commission breakdowns.' },
  { icon: MessageSquare, title: 'Built-in Chat', desc: 'Internal messaging, team channels, and client communication — no third-party tools needed.' },
  { icon: Shield, title: 'Commission & Tax', desc: 'Automate commission calculations, generate tax reports, and track royalty programs.' },
  { icon: Globe, title: 'Public Website', desc: 'A fully branded public-facing website for your company with property listings and contact pages.' },
  { icon: Zap, title: 'CMS & Branding', desc: 'Customize your company website content, hero section, about page, and branding colors.' },
  { icon: Headphones, title: 'Platform Support', desc: 'Direct support channel between your team and RMS platform administrators.' },
];

export default function PlatformPage() {
  const branding = usePlatformBranding();
  const [cmsData, setCmsData] = useState<any>({});
  const [contactForm, setContactForm] = useState({ name: '', company: '', email: '', phone: '', message: '', plan: 'Professional' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/master/platform-settings/public`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setCmsData(d?.data || d); })
      .catch(() => {});
  }, []);

  const platformName = getPlatformName(branding);

  const handleContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    // Simulate sending — in production this would call an API
    await new Promise(r => setTimeout(r, 1000));
    setSubmitted(true);
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Nav */}
      <nav className="border-b border-slate-800/60 sticky top-0 z-50 bg-slate-950/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {branding.logo ? (
              <img src={branding.logo} alt={platformName} className="w-9 h-9 rounded-lg object-contain" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center">
                <Crown className="w-5 h-5 text-amber-400" />
              </div>
            )}
            <span className="text-lg font-bold text-white">{platformName}</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="#pricing" className="text-sm text-slate-400 hover:text-white transition-colors hidden sm:block">Pricing</a>
            <a href="#features" className="text-sm text-slate-400 hover:text-white transition-colors hidden sm:block">Features</a>
            <a href="#contact" className="text-sm text-slate-400 hover:text-white transition-colors hidden sm:block">Contact</a>
            <Link href="/auth/login">
              <Button size="sm" className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold">
                Admin Login
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-full px-4 py-1.5 text-sm text-amber-400 font-medium mb-6">
          <Zap className="w-3.5 h-3.5" />
          All-in-one Real Estate Management
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold text-white mb-6 leading-tight">
          {cmsData.heroTitle || `Manage Your Real Estate\nBusiness Like a Pro`}
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10">
          {cmsData.heroSubtitle || `${platformName} gives your agency a complete management suite — from property listings and HR to commissions, analytics, and client CRM.`}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a href="#contact">
            <Button size="lg" className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-base px-8">
              Get Started <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </a>
          <a href="#features">
            <Button size="lg" variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800 text-base px-8">
              Explore Features
            </Button>
          </a>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-slate-800/60 bg-slate-900/40">
        <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: '500+', label: 'Properties Managed' },
            { value: '50+', label: 'Real Estate Teams' },
            { value: '₦10B+', label: 'Sales Processed' },
            { value: '99.9%', label: 'Uptime Guarantee' },
          ].map(s => (
            <div key={s.label}>
              <p className="text-3xl font-bold text-amber-400">{s.value}</p>
              <p className="text-sm text-slate-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-white mb-3">Everything Your Agency Needs</h2>
          <p className="text-slate-400 max-w-xl mx-auto">One platform that replaces 10 different tools your team would otherwise use separately.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map(f => (
            <div key={f.title} className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-5 hover:border-amber-500/30 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-slate-900/40 border-y border-slate-800/60">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-white mb-3">Simple, Transparent Pricing</h2>
            <p className="text-slate-400 max-w-xl mx-auto">Choose the plan that fits your agency size. Upgrade or downgrade anytime.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PLANS.map(plan => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border ${plan.borderColor} bg-slate-900/80 p-7 flex flex-col ${plan.popular ? 'ring-2 ring-amber-500/50 scale-105' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="bg-amber-500 text-slate-900 text-xs font-bold px-4 py-1 rounded-full flex items-center gap-1">
                      <Star className="w-3 h-3" /> Most Popular
                    </span>
                  </div>
                )}
                <div className={`inline-flex w-10 h-10 rounded-xl bg-gradient-to-br ${plan.color} items-center justify-center mb-5`}>
                  <Crown className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                <p className="text-slate-400 text-sm mb-4">{plan.description}</p>
                <div className="flex items-end gap-1 mb-6">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  <span className="text-slate-400 text-sm mb-1">{plan.period}</span>
                </div>
                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                      <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <a href="#contact">
                  <Button
                    className={`w-full font-semibold ${plan.popular ? 'bg-amber-500 hover:bg-amber-400 text-slate-900' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
                  >
                    {plan.price === 'Custom' ? 'Contact Us' : 'Get Started'}
                  </Button>
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact / Get Started */}
      <section id="contact" className="max-w-7xl mx-auto px-6 py-24">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-3">Ready to Get Started?</h2>
            <p className="text-slate-400">Fill in the form and our team will reach out to onboard your agency.</p>
          </div>

          {submitted ? (
            <div className="bg-green-900/20 border border-green-700/40 rounded-2xl p-10 text-center">
              <Check className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Thanks! We&apos;ll be in touch.</h3>
              <p className="text-slate-400">Our team will contact you within 24 hours to set up your account.</p>
            </div>
          ) : (
            <form onSubmit={handleContact} className="bg-slate-900/60 border border-slate-700/40 rounded-2xl p-8 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="text-sm text-slate-400 block mb-1.5">Your Name *</label>
                  <input
                    required
                    value={contactForm.name}
                    onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1.5">Company Name *</label>
                  <input
                    required
                    value={contactForm.company}
                    onChange={e => setContactForm(p => ({ ...p, company: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500"
                    placeholder="Acme Realty Ltd"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1.5">Email Address *</label>
                  <input
                    required
                    type="email"
                    value={contactForm.email}
                    onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500"
                    placeholder="you@company.com"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1.5">Phone Number</label>
                  <input
                    value={contactForm.phone}
                    onChange={e => setContactForm(p => ({ ...p, phone: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500"
                    placeholder="+234 800 000 0000"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1.5">Interested Plan</label>
                <select
                  value={contactForm.plan}
                  onChange={e => setContactForm(p => ({ ...p, plan: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500"
                >
                  <option value="Starter">Starter</option>
                  <option value="Professional">Professional</option>
                  <option value="Enterprise">Enterprise</option>
                  <option value="Not sure">Not sure yet</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1.5">Message</label>
                <textarea
                  rows={4}
                  value={contactForm.message}
                  onChange={e => setContactForm(p => ({ ...p, message: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 resize-none"
                  placeholder="Tell us about your agency and what you need..."
                />
              </div>
              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-3"
              >
                {submitting ? 'Sending...' : 'Send Message & Get Onboarded'}
              </Button>
            </form>
          )}

          {/* Contact info */}
          <div className="mt-8 flex flex-col sm:flex-row gap-6 justify-center text-sm text-slate-400">
            {cmsData.contactEmail && (
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-400" />
                <a href={`mailto:${cmsData.contactEmail}`} className="hover:text-white transition-colors">{cmsData.contactEmail}</a>
              </div>
            )}
            {cmsData.contactPhone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-amber-400" />
                <a href={`tel:${cmsData.contactPhone}`} className="hover:text-white transition-colors">{cmsData.contactPhone}</a>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-slate-400">{platformName} — Real Estate Management System</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <Link href="/auth/login" className="hover:text-slate-300 transition-colors">Admin Login</Link>
            <a href="#pricing" className="hover:text-slate-300 transition-colors">Pricing</a>
            <a href="#contact" className="hover:text-slate-300 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
