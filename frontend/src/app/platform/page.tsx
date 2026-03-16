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
  LayoutDashboard,
  Lock,
} from 'lucide-react';
import { usePlatformBranding, getPlatformName } from '@/hooks/use-platform-branding';
import { NairaSign } from '@/components/icons/naira-sign';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').trim();

const PLANS = [
  {
    name: 'Starter',
    price: '₦49,999',
    period: '/month',
    description: 'Perfect for small real estate agencies just getting started.',
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

// Left icon rail items (scroll-to anchors)
const RAIL_ITEMS = [
  { icon: LayoutDashboard, label: 'Home', href: '#hero' },
  { icon: Zap, label: 'Features', href: '#features' },
  { icon: NairaSign, label: 'Pricing', href: '#pricing' },
  { icon: Mail, label: 'Contact', href: '#contact' },
  { icon: Lock, label: 'Login', href: '/auth/login' },
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
    await new Promise(r => setTimeout(r, 1000));
    setSubmitted(true);
    setSubmitting(false);
  };

  return (
    <div
      className="min-h-dvh relative overflow-x-hidden"
      style={{ background: 'linear-gradient(135deg, #020c1b 0%, #0d2137 40%, #0a3d55 70%, #073b4c 100%)' }}
    >
      {/* Ambient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #00d4ff 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div className="absolute top-1/3 right-0 w-[500px] h-[500px] rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #0096c7 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div className="absolute bottom-0 left-1/3 w-[600px] h-[400px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #48cae4 0%, transparent 70%)', filter: 'blur(100px)' }} />
      </div>

      {/* Left icon rail (desktop only) */}
      <div className="fixed left-4 top-1/2 -translate-y-1/2 z-50 hidden lg:flex flex-col gap-3">
        <div className="glass-panel rounded-2xl p-2 flex flex-col gap-1">
          {RAIL_ITEMS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              title={item.label}
              className="w-10 h-10 flex items-center justify-center rounded-xl transition-all hover:bg-white/10 text-white/50 hover:text-white group relative"
            >
              <item.icon className="w-5 h-5" />
              <span className="absolute left-12 bg-black/70 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
                {item.label}
              </span>
            </a>
          ))}
        </div>
      </div>

      {/* Top nav */}
      <nav className="relative z-30 glass-panel border-b border-white/10 sticky top-0">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {branding.logo ? (
              <img src={branding.logo} alt={platformName} className="w-9 h-9 rounded-xl object-contain bg-white/10" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
                <Crown className="w-5 h-5 text-cyan-300" />
              </div>
            )}
            <span className="text-base font-bold text-white">{platformName}</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="#pricing" className="text-sm text-white/60 hover:text-white transition-colors hidden sm:block">Pricing</a>
            <a href="#features" className="text-sm text-white/60 hover:text-white transition-colors hidden sm:block">Features</a>
            <a href="#contact" className="text-sm text-white/60 hover:text-white transition-colors hidden sm:block">Contact</a>
            <Link
              href="/auth/login"
              className="px-5 py-2 rounded-full text-sm font-semibold bg-cyan-400/20 hover:bg-cyan-400/30 text-cyan-300 border border-cyan-400/30 transition-all backdrop-blur-sm"
            >
              Admin Login
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section id="hero" className="relative z-10 max-w-7xl mx-auto px-6 lg:px-20 py-28 lg:py-36">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 glass-panel rounded-full px-4 py-2 text-xs font-semibold text-cyan-300 mb-8 border border-cyan-400/20">
            <Zap className="w-3.5 h-3.5" />
            All-in-one Real Estate Management
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white leading-[1.1] mb-6">
            {cmsData.heroTitle || (
              <>
                Manage Your<br />
                <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(90deg, #67e8f9, #38bdf8)' }}>
                  Real Estate
                </span>
                <br />Like a Pro
              </>
            )}
          </h1>
          <p className="text-lg text-white/60 leading-relaxed mb-10 max-w-lg">
            {cmsData.heroSubtitle || `${platformName} gives your agency a complete management suite — from property listings and HR to commissions, analytics, and client CRM.`}
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="#contact"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full font-bold text-sm text-white transition-all hover:opacity-90 hover:shadow-lg"
              style={{ background: 'linear-gradient(90deg, #0096c7, #00b4d8)' }}
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="#features"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full font-bold text-sm text-white/80 glass-panel border border-white/20 hover:bg-white/15 transition-all"
            >
              Explore Features
            </a>
          </div>
        </div>

        {/* Floating hero card */}
        <div className="hidden lg:block absolute right-16 top-1/2 -translate-y-1/2">
          <div className="glass-panel-strong rounded-3xl p-6 w-72 shadow-2xl">
            <p className="text-2xl font-bold text-white mb-1">Welcome back</p>
            <p className="text-sm text-white/50 mb-6">Your platform at a glance</p>
            {[
              { label: 'Companies', val: '24', color: '#67e8f9' },
              { label: 'Active Users', val: '1,240', color: '#34d399' },
              { label: 'Revenue', val: '₦4.8B', color: '#fb923c' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-2.5 border-b border-white/10 last:border-0">
                <span className="text-sm text-white/60">{item.label}</span>
                <span className="text-sm font-bold" style={{ color: item.color }}>{item.val}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="relative z-10 border-y border-white/10">
        <div className="glass-panel">
          <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '500+', label: 'Properties Managed' },
              { value: '50+', label: 'Real Estate Teams' },
              { value: '₦10B+', label: 'Sales Processed' },
              { value: '99.9%', label: 'Uptime Guarantee' },
            ].map(s => (
              <div key={s.label}>
                <p className="text-3xl font-extrabold text-cyan-300">{s.value}</p>
                <p className="text-sm text-white/50 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 py-28">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Everything Your Agency Needs</h2>
          <p className="text-white/50 max-w-xl mx-auto">One platform that replaces 10 different tools your team would otherwise use separately.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map(f => (
            <div key={f.title} className="glass-panel rounded-2xl p-5 hover:bg-white/12 transition-all group border border-white/10 hover:border-white/20">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 border border-cyan-400/25 bg-cyan-400/10">
                <f.icon className="w-5 h-5 text-cyan-300" />
              </div>
              <h3 className="font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative z-10 border-y border-white/10">
        <div className="glass-panel">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 py-28">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Simple, Transparent Pricing</h2>
              <p className="text-white/50 max-w-xl mx-auto">Choose the plan that fits your agency size. Upgrade or downgrade anytime.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {PLANS.map(plan => (
                <div
                  key={plan.name}
                  className={`relative rounded-2xl flex flex-col p-7 transition-all ${
                    plan.popular
                      ? 'glass-panel-strong border border-cyan-400/40 scale-105 shadow-2xl'
                      : 'glass-panel border border-white/15'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span
                        className="text-xs font-bold px-4 py-1 rounded-full flex items-center gap-1 text-white"
                        style={{ background: 'linear-gradient(90deg, #0096c7, #00b4d8)' }}
                      >
                        <Star className="w-3 h-3" /> Most Popular
                      </span>
                    </div>
                  )}
                  <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center mb-5">
                    <Crown className="w-5 h-5 text-cyan-300" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                  <p className="text-white/50 text-sm mb-5">{plan.description}</p>
                  <div className="flex items-end gap-1 mb-6">
                    <span className="text-4xl font-extrabold text-white">{plan.price}</span>
                    <span className="text-white/40 text-sm mb-1">{plan.period}</span>
                  </div>
                  <ul className="space-y-2.5 mb-8 flex-1">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-white/70">
                        <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <a
                    href="#contact"
                    className={`block text-center py-2.5 px-6 rounded-full font-semibold text-sm transition-all ${
                      plan.popular
                        ? 'text-white hover:opacity-90'
                        : 'bg-white/10 hover:bg-white/15 text-white border border-white/20'
                    }`}
                    style={plan.popular ? { background: 'linear-gradient(90deg, #0096c7, #00b4d8)' } : {}}
                  >
                    {plan.price === 'Custom' ? 'Contact Us' : 'Get Started'}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 py-28">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Ready to Get Started?</h2>
            <p className="text-white/50">Fill in the form and our team will reach out to onboard your agency.</p>
          </div>

          {submitted ? (
            <div className="glass-panel-strong rounded-2xl p-10 text-center border border-cyan-400/30">
              <Check className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Thanks! We&apos;ll be in touch.</h3>
              <p className="text-white/50">Our team will contact you within 24 hours to set up your account.</p>
            </div>
          ) : (
            <form onSubmit={handleContact} className="glass-panel-strong rounded-2xl p-8 space-y-5 border border-white/15">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {[
                  { label: 'Your Name *', key: 'name', type: 'text', placeholder: 'John Doe', required: true },
                  { label: 'Company Name *', key: 'company', type: 'text', placeholder: 'Acme Realty Ltd', required: true },
                  { label: 'Email Address *', key: 'email', type: 'email', placeholder: 'you@company.com', required: true },
                  { label: 'Phone Number', key: 'phone', type: 'text', placeholder: '+234 800 000 0000', required: false },
                ].map(field => (
                  <div key={field.key}>
                    <label className="text-sm text-white/60 block mb-1.5">{field.label}</label>
                    <input
                      required={field.required}
                      type={field.type}
                      value={(contactForm as any)[field.key]}
                      onChange={e => setContactForm(p => ({ ...p, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none placeholder:text-white/30 border border-white/15 focus:border-cyan-400/50 transition-colors"
                      style={{ background: 'rgba(255,255,255,0.07)' }}
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className="text-sm text-white/60 block mb-1.5">Interested Plan</label>
                <select
                  value={contactForm.plan}
                  onChange={e => setContactForm(p => ({ ...p, plan: e.target.value }))}
                  className="w-full rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none border border-white/15 focus:border-cyan-400/50 transition-colors"
                  style={{ background: 'rgba(255,255,255,0.07)' }}
                >
                  <option value="Starter" style={{ background: '#0d2137' }}>Starter</option>
                  <option value="Professional" style={{ background: '#0d2137' }}>Professional</option>
                  <option value="Enterprise" style={{ background: '#0d2137' }}>Enterprise</option>
                  <option value="Not sure" style={{ background: '#0d2137' }}>Not sure yet</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-white/60 block mb-1.5">Message</label>
                <textarea
                  rows={4}
                  value={contactForm.message}
                  onChange={e => setContactForm(p => ({ ...p, message: e.target.value }))}
                  placeholder="Tell us about your agency and what you need..."
                  className="w-full rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none resize-none placeholder:text-white/30 border border-white/15 focus:border-cyan-400/50 transition-colors"
                  style={{ background: 'rgba(255,255,255,0.07)' }}
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-full font-bold text-sm text-white transition-all hover:opacity-90 disabled:opacity-60"
                style={{ background: 'linear-gradient(90deg, #0096c7, #00b4d8)' }}
              >
                {submitting ? 'Sending...' : 'Send Message & Get Onboarded'}
              </button>
            </form>
          )}

          {(cmsData.contactEmail || cmsData.contactPhone) && (
            <div className="mt-8 flex flex-col sm:flex-row gap-6 justify-center text-sm text-white/50">
              {cmsData.contactEmail && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-cyan-400" />
                  <a href={`mailto:${cmsData.contactEmail}`} className="hover:text-white transition-colors">{cmsData.contactEmail}</a>
                </div>
              )}
              {cmsData.contactPhone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-cyan-400" />
                  <a href={`tel:${cmsData.contactPhone}`} className="hover:text-white transition-colors">{cmsData.contactPhone}</a>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10">
        <div className="glass-panel">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-white/40">{platformName} — Real Estate Management System</span>
            </div>
            <div className="flex items-center gap-5 text-sm text-white/40">
              <Link href="/auth/login" className="hover:text-white transition-colors">Admin Login</Link>
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
              <a href="#contact" className="hover:text-white transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
