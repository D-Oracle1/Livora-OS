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
  CheckCircle2,
  Target,
  Eye,
  Heart,
  Gem,
  Loader2,
} from 'lucide-react';
import { PublicNavbar } from '@/components/layout/public-navbar';
import { PublicFooter } from '@/components/layout/public-footer';
import { getImageUrl } from '@/lib/api';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').trim();

const ICON_MAP: Record<string, any> = {
  Eye, Target, Heart, Gem, Star, Building2, Users, TrendingUp, Shield: Eye,
};

export default function AboutPage() {
  const [cms, setCms] = useState<Record<string, any> | null>(null);
  const [cmsLoading, setCmsLoading] = useState(true);

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

  const companyName = cms?.branding?.companyName || 'Our Company';
  const about = cms?.about || {};
  const mission = cms?.mission || {};
  const coreValues = cms?.core_values || {};
  const stats = cms?.stats || {};

  const heroImage = about.image
    ? (about.image.startsWith('http') ? about.image : getImageUrl(about.image))
    : '';

  if (cmsLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-primary-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-primary-950">
      <PublicNavbar currentPage="/about" />

      {/* Hero — always visible with primary gradient background */}
      <section className="relative pt-16 min-h-[70vh] flex items-center bg-primary overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-800 to-accent/30" />
        {heroImage && (
          <div className="absolute inset-0">
            <Image
              src={heroImage}
              alt="About us"
              fill
              className="object-cover opacity-25"
              priority
            />
          </div>
        )}
        <div className="container mx-auto px-4 relative z-10 py-20">
          <div className="max-w-2xl">
            <span className="text-accent font-semibold text-sm uppercase tracking-wider">{about.subtitle || 'About Us'}</span>
            <h1 className="text-4xl md:text-5xl font-bold text-white mt-3 mb-6 leading-tight">{about.title || `About ${companyName}`}</h1>
            {(() => {
              const raw = about.content || '';
              const plain = raw.replace(/<[^>]+>/g, '').trim();
              const text = plain || 'Your trusted partner in real estate. We are dedicated to helping you find the perfect property and providing exceptional service every step of the way.';
              const excerpt = text.length > 220 ? text.slice(0, 220) + '…' : text;
              return <p className="text-lg text-white/80 max-w-xl leading-relaxed">{excerpt}</p>;
            })()}
          </div>
        </div>
      </section>

      {/* Our Story */}
      {about.story && (
        <section className="py-20 px-4 bg-white dark:bg-primary-950">
          <div className="container mx-auto">
            <div className={`grid gap-12 items-center ${about.storyImage ? 'lg:grid-cols-2' : ''}`}>
              <div>
                <span className="text-accent font-semibold text-sm uppercase tracking-wider">Our Story</span>
                <h2 className="text-3xl md:text-4xl font-bold mt-2 mb-6 text-gray-900 dark:text-white leading-tight">
                  {about.storyTitle || 'Building Trust in Real Estate Since Day One'}
                </h2>
                {(() => {
                  const plain = about.story.replace(/<[^>]+>/g, '').trim();
                  return <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-base">{plain}</p>;
                })()}
              </div>
              {about.storyImage && (
                <div className="relative mt-8 lg:mt-0">
                  <div className="relative h-[400px] rounded-2xl overflow-hidden">
                    <Image
                      src={about.storyImage.startsWith('http') ? about.storyImage : getImageUrl(about.storyImage)}
                      alt="Our story"
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Mission & Vision */}
      {(mission.missionContent || mission.visionContent) && (
        <section className="py-20 px-4 bg-primary dark:bg-primary-900">
          <div className="container mx-auto">
            <div className="grid md:grid-cols-2 gap-12">
              {mission.missionContent && (
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8">
                  <h3 className="text-2xl font-bold text-white mb-4">{mission.missionTitle || 'Our Mission'}</h3>
                  <div className="text-white/80 prose prose-invert" dangerouslySetInnerHTML={{ __html: mission.missionContent }} />
                </div>
              )}
              {mission.visionContent && (
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8">
                  <h3 className="text-2xl font-bold text-white mb-4">{mission.visionTitle || 'Our Vision'}</h3>
                  <div className="text-white/80 prose prose-invert" dangerouslySetInnerHTML={{ __html: mission.visionContent }} />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Stats */}
      {stats.stats && stats.stats.length > 0 && (
        <section className="py-20 px-4 bg-gray-50 dark:bg-primary-900">
          <div className="container mx-auto">
            <div className="bg-white dark:bg-primary-800 rounded-3xl p-8 md:p-12 shadow-xl">
              <div className="grid md:grid-cols-4 gap-8 text-center">
                {stats.stats.map((stat: any, index: number) => {
                  const StatIcon = [Building2, TrendingUp, Users, Star][index % 4];
                  return (
                    <div key={index} className="group">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-accent/10 flex items-center justify-center group-hover:bg-accent group-hover:scale-110 transition-all">
                        <StatIcon className="w-8 h-8 text-accent group-hover:text-white transition-colors" />
                      </div>
                      <div className="text-3xl md:text-4xl font-bold text-primary dark:text-white mb-2">{stat.value}</div>
                      <div className="text-gray-600 dark:text-gray-400">{stat.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Why Choose Us */}
      {about.items && about.items.length > 0 && (
        <section className="py-20 px-4 bg-white dark:bg-primary-950">
          <div className="container mx-auto">
            <div className={`grid gap-12 items-center ${about.whyChooseImage ? 'lg:grid-cols-2' : ''}`}>
              <div className={about.whyChooseImage ? 'order-2 lg:order-1' : ''}>
                <span className="text-accent font-semibold text-sm uppercase tracking-wider">Why Choose Us</span>
                <h2 className="text-3xl md:text-4xl font-bold mt-2 mb-6 text-gray-900 dark:text-white leading-tight">What Sets Us Apart</h2>
                <div className="space-y-4 mb-8">
                  {about.items.map((item: any, index: number) => (
                    <div key={index} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300 leading-relaxed">{item.text || item}</span>
                    </div>
                  ))}
                </div>
                <Link href="/properties">
                  <Button size="lg" className="bg-accent hover:bg-accent-600 text-white shadow-accent">
                    Explore Properties
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              </div>
              {about.whyChooseImage && (
                <div className="order-1 lg:order-2 relative h-[400px] rounded-2xl overflow-hidden">
                  <Image
                    src={about.whyChooseImage.startsWith('http') ? about.whyChooseImage : getImageUrl(about.whyChooseImage)}
                    alt="Why choose us"
                    fill
                    className="object-cover"
                  />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Core Values */}
      {coreValues.values && coreValues.values.length > 0 && (
        <section className="py-20 px-4 bg-gray-50 dark:bg-primary-900">
          <div className="container mx-auto">
            <div className="text-center mb-16">
              <span className="text-accent font-semibold text-sm uppercase tracking-wider">Our Values</span>
              <h2 className="text-3xl md:text-4xl font-bold mt-2 mb-4 text-gray-900 dark:text-white">What We Stand For</h2>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {coreValues.values.map((value: any, index: number) => {
                const ValueIcon = ICON_MAP[value.icon] || [Eye, Target, Heart, Gem][index % 4];
                return (
                  <div key={index} className="bg-white dark:bg-primary-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 group text-center">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-accent/10 flex items-center justify-center mb-6 group-hover:bg-accent group-hover:scale-110 transition-all">
                      <ValueIcon className="w-8 h-8 text-accent group-hover:text-white transition-colors" />
                    </div>
                    <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">{value.title}</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">{value.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-20 px-4 bg-gradient-to-r from-primary via-primary-600 to-primary">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Join Our Success Story</h2>
          <p className="text-lg text-white/80 max-w-2xl mx-auto mb-8">
            Whether you&apos;re buying, selling, or managing properties, we are your trusted partner
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/register">
              <Button size="lg" className="bg-accent hover:bg-accent-600 text-white shadow-accent text-lg px-8">
                Get Started
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="text-white border-white/40 hover:bg-white/10 text-lg px-8">
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
