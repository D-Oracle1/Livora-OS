'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Building2,
  Users,
  TrendingUp,
  Star,
  ArrowRight,
  Target,
  Eye,
  Heart,
  Gem,
  Loader2,
  ShieldCheck,
  Handshake,
  BarChart3,
  Home,
} from 'lucide-react';
import { PublicNavbar } from '@/components/layout/public-navbar';
import { PublicFooter } from '@/components/layout/public-footer';
import { api, getImageUrl } from '@/lib/api';
import { useTenantResolution } from '@/hooks/use-tenant-resolution';

const ICON_LIST = [Building2, Target, Users, ShieldCheck, Handshake, BarChart3, Eye, Heart, Gem, TrendingUp, Star];

function resolveImg(src: string) {
  if (!src) return '';
  return src.startsWith('http') ? src : getImageUrl(src);
}

export default function AboutPage() {
  const [cms, setCms] = useState<Record<string, any> | null>(null);
  const [cmsLoading, setCmsLoading] = useState(true);
  const { tenantReady } = useTenantResolution();

  useEffect(() => {
    if (!tenantReady) return;
    api.get('/cms/public')
      .then((raw) => {
        const data = raw?.data || raw;
        if (data && typeof data === 'object') setCms(data);
      })
      .catch(() => {})
      .finally(() => setCmsLoading(false));
  }, [tenantReady]);

  const companyName  = cms?.branding?.companyName || 'Our Company';
  const about        = cms?.about        || {};
  const mission      = cms?.mission      || {};
  const coreValues   = cms?.core_values  || {};
  const stats        = cms?.stats        || {};
  const agents       = cms?.agents       || {};

  const heroImage    = resolveImg(about.image || '');
  const storyImage   = resolveImg(about.storyImage || '');

  // Content helpers
  const plainText = (html: string) => (html || '').replace(/<[^>]+>/g, '').trim();

  const aboutText  = plainText(about.content || '');
  const storyText  = plainText(about.story   || mission.missionContent || '');
  const introParagraph = aboutText || `${companyName} is dedicated to transforming the real estate experience by combining deep market expertise with genuine client care. We believe every property transaction is a milestone — and we treat it that way. Our team of experienced professionals is committed to delivering unmatched value through transparent practices, innovative technology, and a passionate dedication to excellence in every interaction with our clients.`;
  const introTitle = about.storyTitle || about.title || `${companyName} — Where Trust Meets Real Estate`;

  // Service/value items — prefer about.items, fall back to coreValues.values
  const serviceItems: any[] = (about.items?.length ? about.items : coreValues.values) || [];

  // Stats
  const statItems: any[] = stats.stats || [];

  // Team / agents
  const teamMembers: any[] = agents.agents || agents.members || [];

  if (cmsLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <PublicNavbar currentPage="/about" />

      {/* ── 1. HERO BANNER ─────────────────────────────────────────── */}
      <section className="relative pt-16 h-[300px] md:h-[360px] flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-primary/90" />
        {heroImage && (
          <Image src={heroImage} alt="About us" fill className="object-cover opacity-20" priority />
        )}
        <div className="relative z-10 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">About Us</h1>
          <div className="flex items-center justify-center gap-2 mt-4 text-sm text-white/60">
            <Link href="/" className="hover:text-white transition-colors flex items-center gap-1">
              <Home className="w-3.5 h-3.5" /> Home
            </Link>
            <span>/</span>
            <span className="text-white/90">About Us</span>
          </div>
        </div>
      </section>

      {/* ── 2. INTRO — SINGLE JUSTIFIED PARAGRAPH ──────────────────── */}
      <section className="py-20 px-4 bg-white">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight mb-6">
            {introTitle}
          </h2>
          <p className="text-gray-600 leading-relaxed text-[15px] text-justify">
            {introParagraph}
          </p>
          {storyText && storyText !== aboutText && (
            <p className="text-gray-600 leading-relaxed text-[15px] text-justify mt-4">
              {storyText}
            </p>
          )}
        </div>
      </section>

      {/* ── 3. SPLIT FULL-WIDTH IMAGES ─────────────────────────────── */}
      <section className="w-full flex flex-col md:flex-row h-[420px] md:h-[500px]">
        {/* Left — large image */}
        <div className="relative flex-1 bg-primary/20">
          {heroImage ? (
            <Image src={heroImage} alt={companyName} fill className="object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary to-primary/60" />
          )}
          <div className="absolute inset-0 bg-black/20" />
        </div>

        {/* Right — two stacked images */}
        <div className="relative flex-1 flex flex-col md:flex-row">
          <div className="relative flex-1 bg-primary/30">
            {storyImage ? (
              <Image src={storyImage} alt="Our team" fill className="object-cover" />
            ) : heroImage ? (
              <Image src={heroImage} alt="Our team" fill className="object-cover opacity-80" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-accent/30 to-primary/40" />
            )}
            <div className="absolute inset-0 bg-primary/20" />
          </div>
          <div className="relative flex-1 bg-accent/20">
            {heroImage ? (
              <Image src={heroImage} alt="Our office" fill className="object-cover opacity-70" />
            ) : (
              <div className="w-full h-full bg-gradient-to-tl from-primary/50 to-accent/20" />
            )}
            <div className="absolute inset-0 bg-primary/30" />
          </div>
        </div>
      </section>

      {/* ── 4. SOLUTIONS / SERVICES ────────────────────────────────── */}
      <section className="py-20 px-4 bg-white">
        <div className="container mx-auto">
          <div className="mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              {about.whyTitle || 'We Provide Solutions For Your Real Estate Goals'}
            </h2>
            <p className="text-gray-500 max-w-xl text-[15px]">
              {about.whySubtitle || `Our expert team at ${companyName} covers every aspect of real estate — from acquisition to management, we've got you covered.`}
            </p>
          </div>

          {serviceItems.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-x-8 gap-y-8">
              {serviceItems.slice(0, 6).map((item: any, i: number) => {
                const Icon = ICON_LIST[i % ICON_LIST.length];
                const label = item.title || item.text || item;
                const desc  = item.description || '';
                return (
                  <div key={i} className="flex items-start gap-4 group">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent transition-colors">
                      <Icon className="w-5 h-5 text-accent group-hover:text-white transition-colors" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-accent/60">{String(i + 1).padStart(2, '0')}</span>
                        <h3 className="font-semibold text-gray-900 text-sm">{label}</h3>
                      </div>
                      {desc && <p className="text-gray-500 text-[13px] leading-relaxed">{desc}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Default 6-item grid when no CMS data */
            <div className="grid md:grid-cols-3 gap-x-8 gap-y-8">
              {[
                { title: 'Quality Properties',   desc: 'Carefully vetted properties that meet the highest standards of quality and value.' },
                { title: 'Client Satisfaction',  desc: 'Your satisfaction is our priority — we go the extra mile every single time.' },
                { title: 'Planning & Strategy',  desc: 'Smart investment strategies tailored to your financial goals and timeline.' },
                { title: 'Expert Advisory',      desc: 'Deep market knowledge from a dedicated team with years of industry experience.' },
                { title: 'Transparent Process',  desc: 'Clear communication and full transparency throughout every transaction.' },
                { title: 'After-Sale Support',   desc: 'Our relationship doesn\'t end at closing — we support you long after the deal.' },
              ].map((item, i) => {
                const Icon = ICON_LIST[i % ICON_LIST.length];
                return (
                  <div key={i} className="flex items-start gap-4 group">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent transition-colors">
                      <Icon className="w-5 h-5 text-accent group-hover:text-white transition-colors" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-accent/60">{String(i + 1).padStart(2, '0')}</span>
                        <h3 className="font-semibold text-gray-900 text-sm">{item.title}</h3>
                      </div>
                      <p className="text-gray-500 text-[13px] leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── 5. RECOGNITION / MISSION BANNER ───────────────────────── */}
      <section className="relative py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-primary/95" />
        {heroImage && (
          <Image src={heroImage} alt="background" fill className="object-cover opacity-10 mix-blend-luminosity" />
        )}
        <div className="container mx-auto relative z-10">
          {/* Mission & Vision cards */}
          {(mission.missionContent || mission.visionContent) ? (
            <div className="grid md:grid-cols-2 gap-8">
              {mission.missionContent && (
                <div className="bg-white/10 border border-white/20 rounded-2xl p-8 text-center">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-accent/20 flex items-center justify-center">
                    <Target className="w-7 h-7 text-accent" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{mission.missionTitle || 'Our Mission'}</h3>
                  <p className="text-white/70 text-sm leading-relaxed">{plainText(mission.missionContent)}</p>
                </div>
              )}
              {mission.visionContent && (
                <div className="bg-white/10 border border-white/20 rounded-2xl p-8 text-center">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-accent/20 flex items-center justify-center">
                    <Eye className="w-7 h-7 text-accent" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{mission.visionTitle || 'Our Vision'}</h3>
                  <p className="text-white/70 text-sm leading-relaxed">{plainText(mission.visionContent)}</p>
                </div>
              )}
            </div>
          ) : (
            /* Default recognition badges */
            <div className="flex flex-wrap justify-center gap-10">
              {[
                { year: '2024', title: 'Best Real Estate Agency' },
                { year: '2023', title: 'Top Rated Service'       },
                { year: '2022', title: 'Excellence Award'        },
                { year: '2021', title: 'Client Choice Award'     },
                { year: '2020', title: 'Market Leader'           },
              ].map((badge) => (
                <div key={badge.year} className="flex flex-col items-center gap-2 text-center min-w-[110px]">
                  <div className="w-20 h-20 rounded-full border-2 border-accent/60 flex flex-col items-center justify-center bg-white/10">
                    <span className="text-accent font-bold text-lg leading-none">{badge.year}</span>
                    <Star className="w-4 h-4 text-accent/80 mt-1" fill="currentColor" />
                  </div>
                  <p className="text-white/80 text-xs font-medium leading-snug">{badge.title}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── 6. STATS COUNTER ───────────────────────────────────────── */}
      {statItems.length > 0 && (
        <section className="py-16 px-4 bg-gray-50 border-y border-gray-100">
          <div className="container mx-auto">
            <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-200">
              {statItems.slice(0, 3).map((stat: any, i: number) => (
                <div key={i} className="flex items-center gap-6 px-8 py-6">
                  <div>
                    <div className="text-4xl md:text-5xl font-bold text-primary leading-none">{stat.value}</div>
                    <div className="text-sm font-semibold text-gray-700 mt-1">{stat.label}</div>
                  </div>
                  <p className="text-gray-500 text-sm leading-relaxed hidden sm:block flex-1">
                    {stat.description || `${companyName} is proud of this achievement.`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 7. TEAM MEMBERS ────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-white">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-[300px_1fr] gap-12 items-start">
            {/* Left — heading + CTA */}
            <div className="lg:pt-8">
              <span className="text-accent font-semibold text-sm uppercase tracking-wider">Our People</span>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mt-2 mb-4 leading-tight">
                Meet Our Expert Team
              </h2>
              <p className="text-gray-500 text-[15px] leading-relaxed mb-8">
                {agents.subtitle || `Behind every successful transaction is a dedicated ${companyName} professional who genuinely cares about your outcome.`}
              </p>
              <Link href="/contact">
                <Button className="bg-accent hover:bg-accent-600 text-white px-6">
                  Contact Us <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>

            {/* Right — agent cards */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {teamMembers.length > 0
                ? teamMembers.slice(0, 3).map((member: any, i: number) => {
                    const photo = resolveImg(member.photo || member.avatar || '');
                    const name  = member.name  || `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Team Member';
                    const role  = member.role  || member.title || 'Property Consultant';
                    return (
                      <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow group border border-gray-100">
                        <div className="relative h-56 bg-gray-100">
                          {photo ? (
                            <Image src={photo} alt={name} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                              <Users className="w-16 h-16 text-primary/20" />
                            </div>
                          )}
                        </div>
                        <div className="p-4 text-center">
                          <h3 className="font-semibold text-gray-900">{name}</h3>
                          <p className="text-sm text-accent mt-0.5">{role}</p>
                        </div>
                      </div>
                    );
                  })
                : /* Default 3 placeholder cards */
                  ['Property Consultant', 'Senior Agent', 'Investment Advisor'].map((role, i) => (
                    <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-md border border-gray-100">
                      <div className="h-56 bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                        <Users className="w-16 h-16 text-primary/20" />
                      </div>
                      <div className="p-4 text-center">
                        <h3 className="font-semibold text-gray-900">{companyName} Expert</h3>
                        <p className="text-sm text-accent mt-0.5">{role}</p>
                      </div>
                    </div>
                  ))
              }
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. CTA ─────────────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-gradient-to-r from-primary via-primary to-primary/90">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Ready to Find Your Perfect Property?</h2>
          <p className="text-white/70 text-lg max-w-xl mx-auto mb-8">
            Join hundreds of satisfied clients who trust {companyName} for their real estate journey.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/properties">
              <Button size="lg" className="bg-accent hover:bg-accent-600 text-white px-8 py-6 text-base">
                Browse Properties <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="text-white border-white/40 hover:bg-white/10 px-8 py-6 text-base">
                Contact Us
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter cmsData={cms?.footer} />
    </div>
  );
}
