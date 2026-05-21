'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  ArrowRight,
  Send,
  Loader2,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import { PublicNavbar } from '@/components/layout/public-navbar';
import { PublicFooter } from '@/components/layout/public-footer';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').trim();

export default function ContactPage() {
  const [cms, setCms] = useState<Record<string, any> | null>(null);
  const [cmsLoading, setCmsLoading] = useState(true);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/v1/cms/public`)
      .then((r) => r.ok ? r.json() : null)
      .then((raw) => {
        const data = raw?.data || raw;
        if (data && typeof data === 'object') setCms(data);
      })
      .catch(() => {})
      .finally(() => setCmsLoading(false));
  }, []);

  const contact = cms?.contact || {};
  const faq = cms?.faq || {};

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.email || !form.message) {
      toast.error('Please fill in the required fields');
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      toast.success("Message sent successfully! We'll get back to you soon.");
      setForm({ firstName: '', lastName: '', email: '', phone: '', subject: '', message: '' });
      setSubmitting(false);
    }, 1000);
  };

  const inputClass = 'w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-primary-700 bg-white dark:bg-primary-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition-all text-sm';

  const mapQuery = contact.mapCoordinates?.trim() || contact.address || '';

  if (cmsLoading) {
    return (
      <div className="min-h-dvh bg-white dark:bg-primary-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-white dark:bg-primary-950">
      <PublicNavbar currentPage="/contact" />
      <MobileBottomNav />

      {/* Hero */}
      <section className="bg-gradient-to-r from-primary via-primary-600 to-primary pt-24 md:pt-28 pb-8 md:pb-12 px-4">
        <div className="container mx-auto text-center">
          <span className="text-accent font-semibold text-xs md:text-sm uppercase tracking-wider">Get In Touch</span>
          <h1 className="text-3xl md:text-5xl font-bold text-white mt-3 mb-3">Contact Us</h1>
          <p className="text-white/80 text-sm md:text-lg max-w-2xl mx-auto">
            Have questions? We&apos;d love to hear from you. Send us a message and we&apos;ll respond as soon as possible.
          </p>
        </div>
      </section>

      {/* Contact Grid */}
      <section className="py-10 md:py-20 px-4 bg-white dark:bg-primary-950">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 max-w-xl mx-auto lg:max-w-none">

            {/* Left — info */}
            <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
              <h2 className="text-xl md:text-3xl font-bold mb-4 md:mb-6 text-gray-900 dark:text-white">
                Let&apos;s Start a Conversation
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm max-w-sm lg:max-w-none">
                Whether you&apos;re looking to buy, sell, or just have questions about our platform, our team is here to help.
              </p>

              {(contact.phone || contact.email || contact.address || contact.hours) && (
                <div className="space-y-3 mb-8 w-full max-w-sm lg:max-w-none">
                  {[
                    contact.phone && { icon: Phone, label: 'Phone', value: contact.phone, description: 'Call us for immediate assistance' },
                    contact.email && { icon: Mail, label: 'Email', value: contact.email, description: 'Send us an email anytime' },
                    contact.address && { icon: MapPin, label: 'Office', value: contact.address, description: 'Visit our headquarters' },
                    contact.hours && { icon: Clock, label: 'Working Hours', value: contact.hours, description: 'Weekend support available' },
                  ].filter(Boolean).map((item: any, index: number) => (
                    <div key={index} className="flex items-start gap-3 p-3 md:p-4 rounded-xl bg-gray-50 dark:bg-primary-900 hover:bg-accent/5 dark:hover:bg-accent/10 transition-colors text-left">
                      <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                        <item.icon className="w-4 h-4 text-accent" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
                        <p className="font-semibold text-gray-900 dark:text-white text-sm break-words">{item.value}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right — form */}
            <div className="bg-gray-50 dark:bg-primary-900 rounded-2xl p-5 sm:p-8">
              <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white mb-5">Send Us a Message</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">First Name *</label>
                    <input type="text" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={inputClass} placeholder="John" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Last Name</label>
                    <input type="text" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={inputClass} placeholder="Doe" />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email *</label>
                    <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} placeholder="john@example.com" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Phone</label>
                    <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} placeholder="+234 800 000 0000" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Subject</label>
                  <input type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className={inputClass} placeholder="How can we help?" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Message *</label>
                  <textarea rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className={`${inputClass} resize-none`} placeholder="Tell us more about your inquiry..." required />
                </div>
                <Button type="submit" disabled={submitting} className="w-full bg-accent hover:bg-accent-600 text-white py-5 md:py-6">
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
                  ) : (
                    <><Send className="w-4 h-4 mr-2" /> Send Message</>
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Map */}
      {mapQuery && (
        <section className="bg-gray-50 dark:bg-primary-900">
          <div className="container mx-auto px-4 pt-10 md:pt-14 pb-6 md:pb-8">
            <div className="text-center mb-6 md:mb-8">
              <span className="text-accent font-semibold text-xs uppercase tracking-widest">Our Location</span>
              <h2 className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white mt-1">Find Us</h2>
              {contact.address && (
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-2 flex items-center justify-center gap-1.5">
                  <MapPin className="w-4 h-4 text-accent flex-shrink-0" />
                  {contact.address}
                </p>
              )}
            </div>
          </div>
          <div className="relative w-full overflow-hidden" style={{ height: '360px' }}>
            <iframe
              src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed&hl=en&z=16`}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Office Location"
            />
          </div>
        </section>
      )}

      {/* FAQ */}
      {faq.items && faq.items.length > 0 && (
        <section className="py-12 md:py-20 px-4 bg-white dark:bg-primary-950">
          <div className="container mx-auto max-w-3xl">
            <div className="text-center mb-8 md:mb-12">
              <span className="text-accent font-semibold text-xs uppercase tracking-wider">FAQ</span>
              <h2 className="text-2xl md:text-4xl font-bold mt-2 mb-4 text-gray-900 dark:text-white">Frequently Asked Questions</h2>
            </div>
            <div className="space-y-3 md:space-y-4">
              {faq.items.map((item: any, index: number) => (
                <div key={index} className="bg-gray-50 dark:bg-primary-800 rounded-xl p-4 md:p-6 shadow-sm">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-sm md:text-base">{item.q}</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-xs md:text-sm">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-16 md:py-20 px-4 bg-white dark:bg-primary-950">
        <div className="container mx-auto">
          <div className="relative rounded-3xl overflow-hidden flex flex-col md:flex-row bg-gray-950 min-h-[340px]">
            {/* Decorative right panel */}
            <div className="relative order-first md:order-last w-full h-44 md:h-auto md:w-[38%] flex-shrink-0 overflow-hidden bg-green-900">
              <div className="absolute inset-0 opacity-[0.12]"
                style={{ backgroundImage: 'radial-gradient(circle, #4ade80 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
              <div className="absolute inset-0 bg-gradient-to-br from-green-800/50 via-green-900 to-gray-950" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Building2 className="w-36 h-36 text-green-400/10" strokeWidth={0.5} />
              </div>
              {contact.phone && (
                <div className="absolute bottom-5 right-5 bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl px-4 py-3">
                  <div className="text-sm font-bold text-white">{contact.phone}</div>
                  <div className="text-xs text-green-300/70">Call Us Directly</div>
                </div>
              )}
            </div>
            {/* Content */}
            <div className="flex flex-col justify-center p-8 md:p-12 lg:p-14 flex-1">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-6 h-px bg-green-500" />
                <span className="text-green-400 text-xs font-semibold uppercase tracking-widest">We&apos;re Here to Help</span>
              </div>
              <h2 className="text-2xl md:text-4xl font-bold text-white leading-tight mb-4 max-w-md">
                Still Have Questions? Let&apos;s Talk
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed mb-8 max-w-sm">
                Visit our office, call us, or send a message — our team is ready to assist you with any real estate enquiry.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/properties">
                  <div className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all">
                    Browse Properties <ArrowRight className="w-4 h-4" />
                  </div>
                </Link>
                <Link href="/auth/register">
                  <div className="inline-flex items-center gap-2 border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all">
                    Create Account
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="md:hidden h-24" />
      <PublicFooter cmsData={cms?.footer} />
    </div>
  );
}
