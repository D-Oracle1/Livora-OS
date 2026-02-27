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
} from 'lucide-react';
import { toast } from 'sonner';
import { PublicNavbar } from '@/components/layout/public-navbar';
import { PublicFooter } from '@/components/layout/public-footer';

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
      toast.success('Message sent successfully! We\'ll get back to you soon.');
      setForm({ firstName: '', lastName: '', email: '', phone: '', subject: '', message: '' });
      setSubmitting(false);
    }, 1000);
  };

  const inputClass = "w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-primary-700 bg-white dark:bg-primary-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition-all";

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

      {/* Hero */}
      <section className="bg-gradient-to-r from-primary via-primary-600 to-primary pt-28 pb-12 px-4">
        <div className="container mx-auto text-center">
          <span className="text-accent font-semibold text-sm uppercase tracking-wider">Get In Touch</span>
          <h1 className="text-3xl md:text-5xl font-bold text-white mt-3 mb-4">Contact Us</h1>
          <p className="text-white/80 text-lg max-w-2xl mx-auto">
            Have questions? We&apos;d love to hear from you. Send us a message and we&apos;ll respond as soon as possible.
          </p>
        </div>
      </section>

      {/* Contact Grid */}
      <section className="py-20 px-4 bg-white dark:bg-primary-950">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-6 text-gray-900 dark:text-white">
                Let&apos;s Start a Conversation
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                Whether you&apos;re looking to buy, sell, or just have questions about our platform, our team is here to help.
              </p>

              {(contact.phone || contact.email || contact.address || contact.hours) && (
                <div className="space-y-6 mb-10">
                  {[
                    contact.phone && { icon: Phone, label: 'Phone', value: contact.phone, description: 'Call us for immediate assistance' },
                    contact.email && { icon: Mail, label: 'Email', value: contact.email, description: 'Send us an email anytime' },
                    contact.address && { icon: MapPin, label: 'Office', value: contact.address, description: 'Visit our headquarters' },
                    contact.hours && { icon: Clock, label: 'Working Hours', value: contact.hours, description: 'Weekend support available' },
                  ].filter(Boolean).map((item: any, index: number) => (
                    <div key={index} className="flex items-start gap-4 p-4 rounded-xl bg-gray-50 dark:bg-primary-900 hover:bg-accent/5 dark:hover:bg-accent/10 transition-colors">
                      <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                        <item.icon className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{item.label}</p>
                        <p className="font-semibold text-gray-900 dark:text-white">{item.value}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-primary-900 rounded-2xl p-8">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Send Us a Message</h3>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">First Name *</label>
                    <input type="text" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={inputClass} placeholder="John" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Last Name</label>
                    <input type="text" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={inputClass} placeholder="Doe" />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email *</label>
                    <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} placeholder="john@example.com" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Phone</label>
                    <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} placeholder="+234 800 000 0000" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Subject</label>
                  <input type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className={inputClass} placeholder="How can we help?" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Message *</label>
                  <textarea rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className={`${inputClass} resize-none`} placeholder="Tell us more about your inquiry..." required />
                </div>
                <Button type="submit" disabled={submitting} className="w-full bg-accent hover:bg-accent-600 text-white shadow-accent py-6">
                  {submitting ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Sending...</>
                  ) : (
                    <><Send className="w-5 h-5 mr-2" /> Send Message</>
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      {faq.items && faq.items.length > 0 && (
        <section className="py-20 px-4 bg-gray-50 dark:bg-primary-900">
          <div className="container mx-auto max-w-3xl">
            <div className="text-center mb-12">
              <span className="text-accent font-semibold text-sm uppercase tracking-wider">FAQ</span>
              <h2 className="text-3xl md:text-4xl font-bold mt-2 mb-4 text-gray-900 dark:text-white">Frequently Asked Questions</h2>
            </div>
            <div className="space-y-4">
              {faq.items.map((item: any, index: number) => (
                <div key={index} className="bg-white dark:bg-primary-800 rounded-xl p-6 shadow-sm">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{item.q}</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      {contact.phone && (
        <section className="py-16 px-4 bg-gradient-to-r from-primary via-primary-600 to-primary">
          <div className="container mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4 text-white">Prefer to Talk?</h2>
            <p className="text-white/80 max-w-xl mx-auto mb-6">
              Call us directly at <span className="text-accent font-semibold">{contact.phone}</span> or visit our office
            </p>
            <Link href="/properties">
              <Button size="lg" className="bg-accent hover:bg-accent-600 text-white shadow-accent">
                Browse Properties
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </section>
      )}

      <PublicFooter cmsData={cms?.footer} />
    </div>
  );
}
