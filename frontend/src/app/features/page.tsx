'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Building2, Users, TrendingUp, Shield, BarChart3, MessageSquare, Award, Zap,
  Search, ArrowRight, Home, Heart, Calendar, Eye, Calculator, UserCheck,
  LineChart, HeartHandshake, UsersRound, FileText, Settings, Lock, CheckCircle2, Leaf,
} from 'lucide-react';
import { PublicNavbar } from '@/components/layout/public-navbar';
import { PublicFooter } from '@/components/layout/public-footer';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { getImageUrl } from '@/lib/api';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').trim();

const ICON_MAP: Record<string, any> = {
  Users, Building2, TrendingUp, Award, BarChart3, MessageSquare, Shield, Zap, Search, Home,
  Heart, Calendar, Eye, Calculator, UserCheck, LineChart, HeartHandshake, UsersRound,
  FileText, Settings, Lock,
};

export default function FeaturesPage() {
  const [cms, setCms] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/v1/cms/public`)
      .then((r) => r.ok ? r.json() : null)
      .then((raw) => {
        const data = raw?.data || raw;
        if (data && typeof data === 'object') setCms(data);
      })
      .catch(() => {});
  }, []);

  const features = cms?.features || {};
  const platformFeatures = cms?.platform_features || {};
  const userFeatures = cms?.user_features || {};
  const companyName = cms?.branding?.companyName || 'Easyland';

  return (
    <div className="min-h-dvh bg-[#d4e6c3] dark:bg-gray-950">
      <PublicNavbar currentPage="/features" />
      <MobileBottomNav />

      {/* ── HERO ── */}
      <section className="relative bg-green-800 pt-32 pb-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-900 via-green-800 to-green-700 opacity-90" />
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, #ffffff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="relative container mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/15 border border-white/25 text-white px-4 py-1.5 rounded-full text-xs font-semibold mb-5">
            <Leaf className="w-3.5 h-3.5 text-green-300" />
            Platform Features
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-white mt-2 mb-4 leading-tight">
            Powerful Features for<br className="hidden md:block" /> Modern Real Estate
          </h1>
          <p className="text-white/75 text-base max-w-2xl mx-auto">
            Comprehensive tools designed for property seekers, realtors, and administrators
          </p>
        </div>
      </section>

      {/* ── CORE FEATURES ── */}
      {features.features && features.features.length > 0 && (
        <section className="py-20 px-4 bg-white dark:bg-gray-900">
          <div className="container mx-auto">
            <div className="text-center mb-14">
              <span className="text-green-700 font-semibold text-xs uppercase tracking-widest">Core Features</span>
              <h2 className="text-3xl md:text-4xl font-bold mt-2 mb-3 text-gray-900 dark:text-white">
                {features.title || `Why Choose ${companyName}?`}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto text-sm leading-relaxed">
                Powerful features designed for modern real estate professionals and property seekers
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.features.map((feature: any, index: number) => (
                <div key={index} className="group bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm border border-green-100 dark:border-gray-700 hover:shadow-md transition-all duration-300">
                  {feature.image ? (
                    <div className="relative h-48 overflow-hidden">
                      <Image
                        src={feature.image.startsWith('http') ? feature.image : getImageUrl(feature.image)}
                        alt={feature.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    </div>
                  ) : (
                    <div className="h-48 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30 flex items-center justify-center">
                      <Building2 className="w-14 h-14 text-green-400" />
                    </div>
                  )}
                  <div className="p-5">
                    <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-white group-hover:text-green-700 transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                      {(feature.description || '').replace(/<[^>]+>/g, '').trim()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── PLATFORM FEATURES ── */}
      {platformFeatures.features && platformFeatures.features.length > 0 && (
        <section className="py-20 px-4 bg-green-800 dark:bg-green-950">
          <div className="container mx-auto">
            <div className="text-center mb-14">
              <span className="text-green-300 text-xs font-semibold uppercase tracking-widest">Platform</span>
              <h2 className="text-3xl md:text-4xl font-bold mt-2 mb-3 text-white">
                Everything You Need to Succeed
              </h2>
              <p className="text-white/70 text-sm max-w-xl mx-auto">
                Comprehensive tools for managing your real estate business
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
              {platformFeatures.features.map((feature: any, index: number) => {
                const FeatureIcon = ICON_MAP[feature.icon] || Zap;
                return (
                  <div key={index} className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-5 hover:bg-white/15 transition-all group">
                    <div className="w-10 h-10 rounded-xl bg-green-600/40 flex items-center justify-center mb-4 group-hover:bg-green-500 transition-all">
                      <FeatureIcon className="w-5 h-5 text-green-200 group-hover:text-white transition-colors" />
                    </div>
                    <h3 className="font-semibold text-white text-sm mb-1.5">{feature.title}</h3>
                    <p className="text-green-200/60 text-xs leading-relaxed">{feature.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── FOR EVERY USER ── */}
      {(userFeatures.seekers || userFeatures.realtors || userFeatures.admins) && (
        <section className="py-20 px-4 bg-[#d4e6c3] dark:bg-gray-950">
          <div className="container mx-auto">
            <div className="text-center mb-14">
              <span className="text-green-700 font-semibold text-xs uppercase tracking-widest">For Everyone</span>
              <h2 className="text-3xl md:text-4xl font-bold mt-2 mb-3 text-gray-900 dark:text-white">
                Built for Every User
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xl mx-auto">
                Whether you&apos;re searching for a property, selling one, or managing the platform
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {userFeatures.seekers && (
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-7 shadow-sm border border-green-100 dark:border-gray-800">
                  <div className="w-12 h-12 rounded-2xl bg-green-50 dark:bg-green-900/40 flex items-center justify-center mb-5">
                    <Home className="w-6 h-6 text-green-700" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">For Property Seekers</h3>
                  <div className="space-y-3">
                    {userFeatures.seekers.map((item: any, i: number) => {
                      const ItemIcon = ICON_MAP[item.icon] || CheckCircle2;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
                            <ItemIcon className="w-3 h-3 text-green-700" />
                          </div>
                          <span className="text-gray-600 dark:text-gray-400 text-sm">{item.text}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {userFeatures.realtors && (
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-7 shadow-sm border border-green-100 dark:border-gray-800">
                  <div className="w-12 h-12 rounded-2xl bg-green-50 dark:bg-green-900/40 flex items-center justify-center mb-5">
                    <UserCheck className="w-6 h-6 text-green-700" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">For Realtors</h3>
                  <div className="space-y-3">
                    {userFeatures.realtors.map((item: any, i: number) => {
                      const ItemIcon = ICON_MAP[item.icon] || CheckCircle2;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
                            <ItemIcon className="w-3 h-3 text-green-700" />
                          </div>
                          <span className="text-gray-600 dark:text-gray-400 text-sm">{item.text}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {userFeatures.admins && (
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-7 shadow-sm border border-green-100 dark:border-gray-800">
                  <div className="w-12 h-12 rounded-2xl bg-green-50 dark:bg-green-900/40 flex items-center justify-center mb-5">
                    <Settings className="w-6 h-6 text-green-700" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">For Administrators</h3>
                  <div className="space-y-3">
                    {userFeatures.admins.map((item: any, i: number) => {
                      const ItemIcon = ICON_MAP[item.icon] || CheckCircle2;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
                            <ItemIcon className="w-3 h-3 text-green-700" />
                          </div>
                          <span className="text-gray-600 dark:text-gray-400 text-sm">{item.text}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA ── */}
      <section className="py-16 md:py-20 px-4 bg-[#d4e6c3] dark:bg-gray-900">
        <div className="container mx-auto">
          <div className="relative rounded-3xl overflow-hidden flex flex-col md:flex-row bg-gray-950 min-h-[340px]">
            {/* Decorative right panel */}
            <div className="relative order-first md:order-last w-full h-44 md:h-auto md:w-[38%] flex-shrink-0 overflow-hidden bg-green-900">
              <div className="absolute inset-0 opacity-[0.12]"
                style={{ backgroundImage: 'radial-gradient(circle, #4ade80 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
              <div className="absolute inset-0 bg-gradient-to-br from-green-800/50 via-green-900 to-gray-950" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Zap className="w-36 h-36 text-green-400/10" strokeWidth={0.5} />
              </div>
              <div className="absolute bottom-5 right-5 bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl px-4 py-3">
                <div className="text-xl font-bold text-white">Free</div>
                <div className="text-xs text-green-300/70">To Get Started</div>
              </div>
            </div>
            {/* Content */}
            <div className="flex flex-col justify-center p-8 md:p-12 lg:p-14 flex-1">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-6 h-px bg-green-500" />
                <span className="text-green-400 text-xs font-semibold uppercase tracking-widest">Platform Access</span>
              </div>
              <h2 className="text-2xl md:text-4xl font-bold text-white leading-tight mb-4 max-w-md">
                Ready to Experience These Features?
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed mb-8 max-w-sm">
                Join thousands of users already leveraging our platform to find and manage premium properties with ease.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/auth/register">
                  <div className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all">
                    Get Started Free <ArrowRight className="w-4 h-4" />
                  </div>
                </Link>
                <Link href="/properties">
                  <div className="inline-flex items-center gap-2 border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all">
                    Browse Properties
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
