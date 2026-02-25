'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Building2,
  Users,
  TrendingUp,
  Shield,
  BarChart3,
  MessageSquare,
  Award,
  Zap,
  Search,
  Home,
  ChevronLeft,
  ChevronRight,
  Star,
  ArrowRight,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  Clock,
  LandPlot,
  Loader2,
} from 'lucide-react';
import { PublicNavbar } from '@/components/layout/public-navbar';
import { PublicFooter } from '@/components/layout/public-footer';
import { getImageUrl } from '@/lib/api';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').trim();

const ICON_MAP: Record<string, any> = {
  Users, Building2, TrendingUp, Award, BarChart3, MessageSquare, Shield, Zap, Star, Search,
};

function getTypeIcon(type: string) {
  switch (type) {
    case 'LAND': return LandPlot;
    case 'COMMERCIAL': case 'INDUSTRIAL': return Building2;
    default: return Home;
  }
}

export default function HomePage() {
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [cms, setCms] = useState<Record<string, any> | null>(null);
  const [cmsLoading, setCmsLoading] = useState(true);

  // Fetch CMS content
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

  const companyName = cms?.branding?.companyName || 'Real Estate Management';
  const hero = cms?.hero || {};
  const agents = cms?.agents || {};
  const features = cms?.features || {};
  const platformFeatures = cms?.platform_features || {};
  const about = cms?.about || {};
  const stats = cms?.stats || {};
  const cta = cms?.cta || {};
  const contact = cms?.contact || {};

  // Fallback hero content when CMS hero is not populated
  const heroTitle = hero.title || `Find Your Perfect Property`;
  const heroTitleAccent = hero.titleAccent || `with ${companyName}`;
  const heroSubtitle = hero.subtitle || 'Discover premium properties, connect with top realtors, and make your real estate dreams a reality.';

  const fetchProperties = useCallback(async (currentPage = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(currentPage));
      params.append('limit', '12');

      const res = await fetch(`${API_BASE_URL}/api/v1/properties/listed?${params.toString()}`);
      if (res.ok) {
        const raw = await res.json();
        const items = Array.isArray(raw) ? raw : (raw?.data || []);
        const meta = raw?.meta;
        setProperties(items);
        setTotalPages(meta?.totalPages || 1);
        setTotalCount(meta?.total ?? items.length);
      }
    } catch {
      setProperties([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProperties(1);
  }, [fetchProperties]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchProperties(newPage);
    document.getElementById('properties')?.scrollIntoView({ behavior: 'smooth' });
  };

  const heroImage = hero.backgroundImage
    ? (hero.backgroundImage.startsWith('http') ? hero.backgroundImage : getImageUrl(hero.backgroundImage))
    : '';
  const heroSideImage = hero.heroImage
    ? (hero.heroImage.startsWith('http') ? hero.heroImage : getImageUrl(hero.heroImage))
    : '';

  if (cmsLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-primary-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-primary-950">
      <PublicNavbar currentPage="/" />

      {/* Hero Section */}
      <Link href="/auth/register" className="block">
        <section className="relative min-h-[90vh] flex items-center cursor-pointer group">
          <div className="absolute inset-0">
            {heroImage ? (
              <Image
                src={heroImage}
                alt="Hero background"
                fill
                className="object-cover"
                priority
              />
            ) : (
              <div className="w-full h-full bg-primary" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/85 to-primary/60" />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/60 to-transparent" />
          </div>

          <div className="container mx-auto px-4 relative z-10 pt-20">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              {/* Left: Text Content */}
              <div>
                {hero.badgeText && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/20 border border-accent/40 text-accent text-sm font-medium mb-6">
                    <Star className="w-4 h-4 fill-accent" />
                    <span>{hero.badgeText}</span>
                  </div>
                )}

                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-white leading-tight">
                  {heroTitle}
                  <br />
                  <span className="text-accent">{heroTitleAccent}</span>
                </h1>
                <p className="text-lg text-white/80 mb-10 max-w-xl">
                  {heroSubtitle}
                </p>

                <div className="inline-flex items-center gap-3 bg-accent hover:bg-accent-600 text-white px-8 py-4 rounded-2xl text-lg font-semibold shadow-2xl transition-all group-hover:scale-105">
                  Get Started
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </div>

                {/* Stats */}
                {hero.stats && hero.stats.length > 0 && (
                  <div className="flex flex-wrap gap-8 md:gap-12 mt-12">
                    {hero.stats.map((stat: any, i: number) => (
                      <div key={i} className="flex items-center gap-8 md:gap-12">
                        {i > 0 && <div className="w-px h-12 bg-white/30 hidden md:block -ml-8 md:-ml-12" />}
                        <div>
                          <div className="text-3xl md:text-4xl font-bold text-white">{stat.value}</div>
                          <div className="text-white/70 text-sm">{stat.label}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Hero Image */}
              {heroSideImage && (
                <div className="hidden lg:flex justify-center items-center">
                  <div className="relative w-full max-w-lg aspect-square">
                    <Image
                      src={heroSideImage}
                      alt="Hero"
                      fill
                      className="object-contain drop-shadow-2xl"
                      priority
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </Link>

      {/* Browse Properties Section */}
      <section id="properties" className="py-20 px-4 bg-white dark:bg-primary-950">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12">
            <div>
              <span className="text-accent font-semibold text-sm uppercase tracking-wider">Browse</span>
              <h2 className="text-3xl md:text-4xl font-bold mt-2 text-gray-900 dark:text-white">
                Available Properties
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                {totalCount > 0 ? `${totalCount} properties found` : 'Explore our curated selection of premium properties'}
              </p>
            </div>
            <Link href="/properties" className="text-accent hover:text-accent-600 font-medium flex items-center gap-2 group">
              View All Properties
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
              <span className="ml-3 text-gray-500">Loading properties...</span>
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-20">
              <Building2 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">No Properties Found</h3>
              <p className="text-gray-500 dark:text-gray-400">Try adjusting your search filters or check back later.</p>
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {properties.slice(0, 6).map((property: any) => {
                  const TypeIcon = getTypeIcon(property.type);
                  return (
                    <Link key={property.id} href={`/properties/${property.id}`} className="group">
                      <div className="bg-white dark:bg-primary-900 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-primary-800">
                        <div className="relative h-52 overflow-hidden">
                          {property.images && property.images.length > 0 ? (
                            <Image
                              src={property.images[0].startsWith('http') ? property.images[0] : getImageUrl(property.images[0])}
                              alt={property.title}
                              fill
                              className="object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                              <TypeIcon className="w-16 h-16 text-primary/30" />
                            </div>
                          )}
                          <div className="absolute top-3 left-3">
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-accent text-white">
                              {property.type?.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                        <div className="p-5">
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-accent transition-colors line-clamp-1">
                            {property.title}
                          </h3>
                          <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-sm mb-3">
                            <MapPin className="w-3.5 h-3.5" />
                            <span className="line-clamp-1">{property.city}, {property.state}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-10">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => handlePageChange(page - 1)} className="border-gray-300">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                    const pageNum = start + i;
                    if (pageNum > totalPages) return null;
                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === page ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                        className={pageNum === page ? 'bg-accent hover:bg-accent-600 text-white' : 'border-gray-300'}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => handlePageChange(page + 1)} className="border-gray-300">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Featured Agents Section */}
      {agents.agents && agents.agents.length > 0 && (
        <section className="py-20 px-4 bg-gray-50 dark:bg-primary-900">
          <div className="container mx-auto">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12">
              <div>
                <span className="text-accent font-semibold text-sm uppercase tracking-wider">Our Team</span>
                <h2 className="text-3xl md:text-4xl font-bold mt-2 text-gray-900 dark:text-white">
                  Meet Our Top Realtors
                </h2>
              </div>
              <Link href="/auth/register" className="text-accent hover:text-accent-600 font-medium flex items-center gap-2 group">
                View All Agents
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {agents.agents.map((agent: any, index: number) => (
                <div key={index} className="bg-white dark:bg-primary-800 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 group">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative">
                      <Image
                        src={agent.image?.startsWith('http') ? agent.image : getImageUrl(agent.image || '')}
                        alt={agent.name}
                        width={60}
                        height={60}
                        className="rounded-full object-cover"
                      />
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary rounded-full border-2 border-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-accent transition-colors">{agent.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{agent.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-primary-700">
                    <div className="flex items-center gap-1">
                      {[...Array(Number(agent.rating) || 5)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-accent text-accent" />
                      ))}
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{agent.deals} deals</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Features Section */}
      {features.features && features.features.length > 0 && (
        <section id="features" className="py-20 px-4 bg-white dark:bg-primary-950">
          <div className="container mx-auto">
            <div className="text-center mb-16">
              <span className="text-accent font-semibold text-sm uppercase tracking-wider">Why Choose Us</span>
              <h2 className="text-3xl md:text-4xl font-bold mt-2 mb-4 text-gray-900 dark:text-white">
                Search Properties with Ease
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-4">
                Powerful features designed for modern real estate professionals and property seekers
              </p>
              <Link href="/features" className="text-accent hover:text-accent-600 font-medium inline-flex items-center gap-2 group">
                View All Features
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.features.slice(0, 3).map((feature: any, index: number) => {
                const desc: string = feature.description || '';
                const excerpt = desc.length > 120 ? desc.slice(0, 120) + '…' : desc;
                return (
                  <div key={index} className="group bg-white dark:bg-primary-900 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-primary-800">
                    {feature.image && (
                      <div className="relative h-48 overflow-hidden">
                        <Image
                          src={feature.image?.startsWith('http') ? feature.image : getImageUrl(feature.image || '')}
                          alt={feature.title}
                          fill
                          className="object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      </div>
                    )}
                    <div className="p-6">
                      <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white group-hover:text-accent transition-colors">{feature.title}</h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">{excerpt}</p>
                      <Link href="/features" className="text-accent hover:text-accent-600 font-medium flex items-center gap-2 group/link">
                        Read More
                        <ArrowRight className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Platform Features */}
      {platformFeatures.features && platformFeatures.features.length > 0 && (
        <section className="py-20 px-4 bg-primary dark:bg-primary-900">
          <div className="container mx-auto">
            <div className="text-center mb-16">
              <span className="text-accent font-semibold text-sm uppercase tracking-wider">Platform Features</span>
              <h2 className="text-3xl md:text-4xl font-bold mt-2 mb-4 text-white">Everything You Need to Succeed</h2>
              <p className="text-lg text-white/70 max-w-2xl mx-auto">Comprehensive tools for managing your real estate business</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {platformFeatures.features.map((feature: any, index: number) => {
                const FeatureIcon = ICON_MAP[feature.icon] || Zap;
                return (
                  <div key={index} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 hover:bg-white/15 transition-all duration-300 group">
                    <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center mb-4 group-hover:bg-accent group-hover:scale-110 transition-all">
                      <FeatureIcon className="w-6 h-6 text-accent group-hover:text-white transition-colors" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2 text-white">{feature.title}</h3>
                    <p className="text-white/70 text-sm">{feature.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* About Section */}
      {(about.title || about.content) && (
        <section id="about" className="py-20 px-4 bg-white dark:bg-primary-950">
          <div className="container mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Text — first on mobile, left on desktop */}
              <div className="order-1">
                <span className="text-accent font-semibold text-sm uppercase tracking-wider">{about.subtitle || 'About Us'}</span>
                {about.title && (
                  <h2 className="text-3xl md:text-4xl font-bold mt-2 mb-6 text-gray-900 dark:text-white leading-tight">{about.title}</h2>
                )}
                {(() => {
                  const raw = about.content || '';
                  const plain = raw.replace(/<[^>]+>/g, '').trim();
                  const fallback = 'Your trusted partner in real estate. We are dedicated to helping you find the perfect property and providing exceptional service every step of the way.';
                  const text = plain || fallback;
                  const excerpt = text.length > 200 ? text.slice(0, 200) + '…' : text;
                  return <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed text-base">{excerpt}</p>;
                })()}
                {about.items && about.items.length > 0 && (
                  <div className="space-y-3 mb-8">
                    {about.items.slice(0, 3).map((item: any, index: number) => (
                      <div key={index} className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0" />
                        <span className="text-gray-700 dark:text-gray-300">{item.text || item}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-4">
                  <Link href="/about">
                    <Button size="lg" className="bg-accent hover:bg-accent-600 text-white shadow-accent">
                      Learn More
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </Link>
                  <Link href="/auth/register" className="text-accent hover:text-accent-600 font-medium flex items-center gap-2 group">
                    Get Started
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
              {/* Image — second on mobile, right on desktop */}
              <div className="order-2 relative">
                <div className="relative h-[400px] sm:h-[500px] rounded-2xl overflow-hidden">
                  {about.image ? (
                    <Image
                      src={about.image?.startsWith('http') ? about.image : getImageUrl(about.image)}
                      alt="About us"
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                      <Building2 className="w-24 h-24 text-primary/20" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Stats Section */}
      {stats.stats && stats.stats.length > 0 && (
        <section className="py-20 px-4 bg-gray-50 dark:bg-primary-900">
          <div className="container mx-auto">
            <div className="bg-white dark:bg-primary-800 rounded-3xl p-8 md:p-12 shadow-xl">
              <div className="grid md:grid-cols-4 gap-8 text-center">
                {stats.stats.map((stat: any, index: number) => {
                  const StatIcon = ICON_MAP[stat.icon] || [Building2, TrendingUp, Users, Star][index % 4];
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

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-primary via-primary-600 to-primary">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">{cta.title || `Ready to Get Started with ${companyName}?`}</h2>
          <p className="text-lg text-white/80 max-w-2xl mx-auto mb-8">{cta.subtitle || 'Whether you\'re buying, selling, or managing properties, we are your trusted partner.'}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={cta.primaryButtonLink || '/auth/register'}>
              <Button size="lg" className="bg-accent hover:bg-accent-600 text-white shadow-accent text-lg px-8">
                {cta.primaryButtonText || 'Get Started'}
              </Button>
            </Link>
            <Link href={cta.secondaryButtonLink || '/contact'}>
              <Button size="lg" variant="outline" className="text-white border-white/40 hover:bg-white/10 text-lg px-8">
                {cta.secondaryButtonText || 'Contact Us'}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      {(contact.phone || contact.email || contact.address) && (
        <section id="contact" className="py-20 px-4 bg-white dark:bg-primary-950">
          <div className="container mx-auto">
            <div className="grid lg:grid-cols-2 gap-12">
              <div>
                <span className="text-accent font-semibold text-sm uppercase tracking-wider">Get In Touch</span>
                <h2 className="text-3xl md:text-4xl font-bold mt-2 mb-6 text-gray-900 dark:text-white">Contact Us</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-8">
                  Have questions? We&apos;d love to hear from you. Send us a message and we&apos;ll respond as soon as possible.
                </p>
                <div className="space-y-6">
                  {[
                    contact.phone && { icon: Phone, label: 'Phone', value: contact.phone },
                    contact.email && { icon: Mail, label: 'Email', value: contact.email },
                    contact.address && { icon: MapPin, label: 'Address', value: contact.address },
                    contact.hours && { icon: Clock, label: 'Working Hours', value: contact.hours },
                  ].filter(Boolean).map((item: any, index: number) => (
                    <div key={index} className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                        <item.icon className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{item.label}</p>
                        <p className="font-medium text-gray-900 dark:text-white">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-primary-900 rounded-2xl p-8">
                <form className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">First Name</label>
                      <input type="text" className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-primary-700 bg-white dark:bg-primary-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition-all" placeholder="John" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Last Name</label>
                      <input type="text" className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-primary-700 bg-white dark:bg-primary-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition-all" placeholder="Doe" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
                    <input type="email" className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-primary-700 bg-white dark:bg-primary-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition-all" placeholder="john@example.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Message</label>
                    <textarea rows={4} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-primary-700 bg-white dark:bg-primary-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition-all resize-none" placeholder="Your message..." />
                  </div>
                  <Button type="button" className="w-full bg-accent hover:bg-accent-600 text-white shadow-accent py-6">
                    Send Message
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </section>
      )}

      <PublicFooter cmsData={cms?.footer} />
    </div>
  );
}
