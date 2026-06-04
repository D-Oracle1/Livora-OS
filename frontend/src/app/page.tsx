'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
  ChevronDown,
  Star,
  ArrowRight,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  Clock,
  LandPlot,
  Loader2,
  Calendar,
  Globe,
  Leaf,
} from 'lucide-react';
import { PublicNavbar } from '@/components/layout/public-navbar';
import { PublicFooter } from '@/components/layout/public-footer';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { api, getImageUrl } from '@/lib/api';
import { useTenantResolution } from '@/hooks/use-tenant-resolution';

interface HomepageEvent {
  id: string;
  title: string;
  slug: string;
  bannerUrl: string | null;
  isFeatured: boolean;
  eventDate: string;
  locationType: 'physical' | 'online';
  locationDetails: string | null;
  maxAttendees: number | null;
  _count: { registrations: number };
}

const PLACEHOLDER_HERO_IMAGES = [
  'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1920&q=80',
  'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?auto=format&fit=crop&w=1920&q=80',
  'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1920&q=80',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1920&q=80',
];

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

// ── Lightweight sessionStorage cache (stale-while-revalidate) ──────────────
function scRead<T>(key: string, ttlMs: number): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { t, d } = JSON.parse(raw);
    return Date.now() - t < ttlMs ? (d as T) : null;
  } catch { return null; }
}
function scWrite(key: string, data: unknown) {
  try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), d: data })); } catch {}
}

const PROPERTY_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'RESIDENTIAL', label: 'Residential' },
  { value: 'APARTMENT', label: 'Apartment' },
  { value: 'COMMERCIAL', label: 'Commercial' },
  { value: 'LAND', label: 'Land' },
  { value: 'VILLA', label: 'Villa' },
];

export default function HomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('');
  const [typeOpen, setTypeOpen] = useState(false);
  const cachedProps = scRead<{ items: any[]; totalPages: number; totalCount: number }>('__hp_props__', 30_000);
  const cachedCms   = scRead<Record<string, any>>('__hp_cms__', 300_000);
  const cachedEvts  = scRead<any>('__hp_evts__', 120_000);

  const [properties, setProperties] = useState<any[]>(cachedProps?.items || []);
  const [loading, setLoading] = useState(!cachedProps);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(cachedProps?.totalPages || 1);
  const [totalCount, setTotalCount] = useState(cachedProps?.totalCount || 0);
  const [cms, setCms] = useState<Record<string, any> | null>(cachedCms);
  const [events, setEvents] = useState<{ featured: HomepageEvent[]; upcoming: HomepageEvent[]; closingSoon: HomepageEvent[] } | null>(cachedEvts);
  // Resolve tenant company ID from hostname (no-op if NEXT_PUBLIC_COMPANY_ID is set)
  const { tenantReady } = useTenantResolution();

  // Step 2: fetch CMS + events in parallel once tenant ID is known
  useEffect(() => {
    if (!tenantReady) return;
    api.get('/cms/public')
      .then((raw) => {
        const data = raw?.data || raw;
        if (data && typeof data === 'object') { setCms(data); scWrite('__hp_cms__', data); }
      })
      .catch(() => {});
    api.get<{ data: { featured: HomepageEvent[]; upcoming: HomepageEvent[]; closingSoon: HomepageEvent[] } }>('/events/homepage')
      .then((res) => {
        const d = res?.data;
        if (d && (d.featured || d.upcoming)) { setEvents(d); scWrite('__hp_evts__', d); }
      })
      .catch(() => {});
  }, [tenantReady]);

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

      const raw = await api.get(`/properties/listed?${params.toString()}`);
      const items = Array.isArray(raw) ? raw : (raw?.data || []);
      const meta = raw?.meta;
      const tp = meta?.totalPages || 1;
      const tc = meta?.total ?? items.length;
      setProperties(items);
      setTotalPages(tp);
      setTotalCount(tc);
      if (currentPage === 1) scWrite('__hp_props__', { items, totalPages: tp, totalCount: tc });
    } catch {
      setProperties([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!tenantReady) return;
    fetchProperties(1);
  }, [tenantReady, fetchProperties]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchProperties(newPage);
    document.getElementById('properties')?.scrollIntoView({ behavior: 'smooth' });
  };

  // Build carousel images list: prefer backgroundImages array, fall back to single backgroundImage
  const rawCarouselImages: string[] = Array.isArray(hero.backgroundImages) && hero.backgroundImages.length > 0
    ? hero.backgroundImages
    : hero.backgroundImage
      ? [hero.backgroundImage]
      : [];
  const carouselImages = rawCarouselImages.length > 0
    ? rawCarouselImages.map((img: string) => img.startsWith('http') ? img : getImageUrl(img))
    : PLACEHOLDER_HERO_IMAGES;

  // Right-side hero image carousel
  const rawSideImages: string[] = Array.isArray(hero.heroImages) && hero.heroImages.length > 0
    ? hero.heroImages
    : hero.heroImage
      ? [hero.heroImage]
      : [];
  const sideImages = rawSideImages.map((img: string) =>
    img.startsWith('http') ? img : getImageUrl(img)
  );

  const [carouselIndex, setCarouselIndex] = useState(0);
  const carouselTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [sideIndex, setSideIndex] = useState(0);
  const sideTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCarousel = useCallback(() => {
    if (carouselImages.length <= 1) return;
    carouselTimer.current = setInterval(() => {
      setCarouselIndex(prev => (prev + 1) % carouselImages.length);
    }, 5000);
  }, [carouselImages.length]);

  const startSideCarousel = useCallback(() => {
    if (sideImages.length <= 1) return;
    sideTimer.current = setInterval(() => {
      setSideIndex(prev => (prev + 1) % sideImages.length);
    }, 4000);
  }, [sideImages.length]);

  useEffect(() => {
    startCarousel();
    return () => { if (carouselTimer.current) clearInterval(carouselTimer.current); };
  }, [startCarousel]);

  useEffect(() => {
    startSideCarousel();
    return () => { if (sideTimer.current) clearInterval(sideTimer.current); };
  }, [startSideCarousel]);

  const goToSlide = (idx: number) => {
    setCarouselIndex(idx);
    if (carouselTimer.current) clearInterval(carouselTimer.current);
    startCarousel();
  };

  const goToSideSlide = (idx: number) => {
    setSideIndex(idx);
    if (sideTimer.current) clearInterval(sideTimer.current);
    startSideCarousel();
  };

  const displayEvents = events
    ? (events.featured.length > 0 ? events.featured : events.upcoming.slice(0, 3))
    : [];

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (searchType) params.set('type', searchType);
    router.push(`/properties${params.toString() ? `?${params}` : ''}`);
  };

  return (
    <div className="min-h-dvh bg-[#d4e6c3] dark:bg-gray-950">
      <PublicNavbar currentPage="/" />
      <MobileBottomNav />

      {/* ── HERO ── full-bleed image, left-aligned text overlay */}
      <section
        className="relative h-[100svh] md:h-[72vh] min-h-[580px] overflow-hidden cursor-pointer md:cursor-auto"
        onClick={() => { if (window.innerWidth < 768) router.push('/auth/login'); }}
      >
        {carouselImages.map((src, idx) => (
          <div key={idx} className="absolute inset-0 transition-opacity duration-1000"
            style={{ opacity: idx === carouselIndex ? 1 : 0, zIndex: idx === carouselIndex ? 1 : 0 }}>
            <Image src={src} alt={`Hero slide ${idx + 1}`} fill className="object-cover" priority={idx === 0} />
          </div>
        ))}
        {/* Strong left-side scrim so white text stays legible over any image */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" style={{ zIndex: 5 }} />
        {/* Secondary horizontal band that reaches further right */}
        <div className="absolute inset-y-0 left-0 w-2/3 bg-gradient-to-r from-black/40 to-transparent" style={{ zIndex: 5 }} />
        {/* Bottom-up vignette for the dots row */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" style={{ zIndex: 5 }} />

        {carouselImages.length > 1 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2" style={{ zIndex: 15 }} onClick={(e) => e.stopPropagation()}>
            {carouselImages.map((_, idx) => (
              <button key={idx} onClick={() => goToSlide(idx)}
                className={`w-2 h-2 rounded-full transition-all ${idx === carouselIndex ? 'bg-white scale-125' : 'bg-white/50 hover:bg-white/80'}`}
                aria-label={`Slide ${idx + 1}`}
              />
            ))}
          </div>
        )}

        <div className="absolute inset-0 flex items-end" style={{ zIndex: 10 }}>
          <div className="container mx-auto px-4 pb-28 md:pb-16 pt-24 max-h-full overflow-hidden">
            {hero.badgeText && (
              <div className="inline-flex items-center gap-2 bg-green-700 text-white px-4 py-1.5 rounded-full text-xs font-semibold mb-5 shadow">
                <Users className="w-3.5 h-3.5" />
                {hero.badgeText}
              </div>
            )}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-3 max-w-xl">
              {heroTitle}<br />{heroTitleAccent}
            </h1>
            <p className="text-white/75 text-sm mb-6 max-w-sm leading-relaxed">{heroSubtitle}</p>

            {/* ── SEARCH BAR ── */}
            <div className="max-w-2xl" onClick={() => setTypeOpen(false)}>
              {/* Desktop: handled by standalone section below hero */}
              <div className="hidden">
                {/* Location input */}
                <div className="flex items-center gap-2.5 flex-1 px-5 py-3.5 min-w-0">
                  <MapPin className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="City, area or keyword…"
                    className="w-full text-sm text-gray-700 dark:text-gray-200 bg-transparent outline-none placeholder:text-gray-400"
                  />
                </div>
                {/* Divider */}
                <div className="w-px bg-gray-100 dark:bg-gray-700 self-stretch my-3" />
                {/* Property type */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setTypeOpen(!typeOpen); }}
                    className="flex items-center gap-2 px-5 py-3.5 text-sm text-gray-600 dark:text-gray-300 hover:text-green-700 transition-colors whitespace-nowrap h-full"
                  >
                    <Building2 className="w-4 h-4 text-green-600" />
                    {PROPERTY_TYPES.find(t => t.value === searchType)?.label || 'All Types'}
                    <ChevronDown className="w-3.5 h-3.5 opacity-50" />
                  </button>
                  {typeOpen && (
                    <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 min-w-[160px] z-50 overflow-hidden">
                      {PROPERTY_TYPES.map((t) => (
                        <button
                          key={t.value}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setSearchType(t.value); setTypeOpen(false); }}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${searchType === t.value ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Search button */}
                <button
                  type="button"
                  onClick={handleSearch}
                  className="flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white px-6 py-3.5 text-sm font-semibold transition-all whitespace-nowrap"
                >
                  <Search className="w-4 h-4" />
                  Search
                </button>
              </div>

              {/* Mobile: stacked card */}
              <div className="flex flex-col sm:hidden gap-2" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2.5 bg-white dark:bg-gray-900 rounded-xl px-4 py-3 shadow-xl">
                  <MapPin className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="City, area or keyword…"
                    className="flex-1 text-sm text-gray-700 bg-transparent outline-none placeholder:text-gray-400"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setTypeOpen(!typeOpen); }}
                      className="w-full flex items-center gap-2 bg-white dark:bg-gray-900 rounded-xl px-4 py-3 shadow-xl text-sm text-gray-600 dark:text-gray-300"
                    >
                      <Building2 className="w-4 h-4 text-green-600" />
                      <span className="flex-1 text-left truncate">{PROPERTY_TYPES.find(t => t.value === searchType)?.label || 'All Types'}</span>
                      <ChevronDown className="w-3.5 h-3.5 opacity-50 flex-shrink-0" />
                    </button>
                    {typeOpen && (
                      <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 w-full z-50 overflow-hidden">
                        {PROPERTY_TYPES.map((t) => (
                          <button
                            key={t.value}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setSearchType(t.value); setTypeOpen(false); }}
                            className={`w-full text-left px-4 py-2.5 text-sm ${searchType === t.value ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleSearch}
                    className="flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white px-5 py-3 rounded-xl text-sm font-semibold transition-all shadow-xl whitespace-nowrap"
                  >
                    <Search className="w-4 h-4" />
                    Search
                  </button>
                </div>
              </div>
            </div>

            {hero.stats && hero.stats.length > 0 && (
              <div className="flex flex-wrap gap-8 mt-8">
                {hero.stats.map((stat: any, i: number) => (
                  <div key={i} className="text-white">
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <div className="text-white/55 text-xs mt-0.5">{stat.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── DESKTOP/TABLET SEARCH BAR ── inside green banner below hero */}
      <div className="hidden sm:block bg-green-800 px-4 py-7" onClick={() => setTypeOpen(false)}>
        <div className="container mx-auto max-w-3xl">
          <p className="text-green-200/70 text-xs font-medium uppercase tracking-widest text-center mb-4">Find Your Perfect Property</p>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-3">
            <div className="flex items-stretch gap-2">
              <div className="flex items-center gap-2.5 flex-1 bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 min-w-0">
                <MapPin className="w-4 h-4 text-green-600 flex-shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="City, area or keyword…"
                  className="w-full text-sm text-gray-700 dark:text-gray-200 bg-transparent outline-none placeholder:text-gray-400"
                />
              </div>
              <div className="w-px bg-gray-100 dark:bg-gray-700 self-stretch my-1" />
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setTypeOpen(!typeOpen); }}
                  className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 text-sm text-gray-600 dark:text-gray-300 hover:text-green-700 transition-colors whitespace-nowrap h-full"
                >
                  <Building2 className="w-4 h-4 text-green-600" />
                  {PROPERTY_TYPES.find(t => t.value === searchType)?.label || 'All Types'}
                  <ChevronDown className="w-3.5 h-3.5 opacity-50" />
                </button>
                {typeOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 min-w-[160px] z-50 overflow-hidden">
                    {PROPERTY_TYPES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setSearchType(t.value); setTypeOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${searchType === t.value ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handleSearch}
                className="flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all whitespace-nowrap"
              >
                <Search className="w-4 h-4" />
                Search
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── ABOUT / WELCOME ── */}
      {(about.title || about.content) && (
        <section id="about" className="py-20 px-4 bg-white dark:bg-gray-900">
          <div className="container mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left: image */}
              <div className="relative">
                <div className="relative h-[400px] rounded-2xl overflow-hidden shadow-xl">
                  {about.image ? (
                    <Image src={about.image?.startsWith('http') ? about.image : getImageUrl(about.image)} alt="About" fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-green-800 to-green-600 flex items-center justify-center">
                      <Building2 className="w-20 h-20 text-white/20" />
                    </div>
                  )}
                  <div className="absolute top-4 left-4 bg-green-700 text-white rounded-full px-4 py-1.5 flex items-center gap-2 text-xs font-semibold shadow">
                    <Home className="w-3.5 h-3.5" /> Find Homes
                  </div>
                </div>
                <div className="absolute -bottom-4 -right-4 w-14 h-14 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center shadow-md border-4 border-white dark:border-gray-900">
                  <Leaf className="w-6 h-6 text-green-700" />
                </div>
              </div>
              {/* Right: text */}
              <div>
                <span className="text-green-700 text-xs font-semibold uppercase tracking-widest">{about.subtitle || 'About Us'}</span>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mt-2 mb-5 leading-tight">
                  {about.title || `Welcome to ${companyName}?`}
                </h2>
                {(() => {
                  const raw = about.content || '';
                  const plain = raw.replace(/<[^>]+>/g, '').trim();
                  const full = plain || 'Your trusted partner in real estate. We are dedicated to helping you find the perfect property and providing exceptional service every step of the way.';
                  const excerpt = full.length > 280 ? full.slice(0, full.lastIndexOf(' ', 280)) + '…' : full;
                  return <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-6">{excerpt}</p>;
                })()}
                {about.items && about.items.length > 0 && (
                  <div className="space-y-2.5 mb-8">
                    {about.items.slice(0, 3).map((item: any, i: number) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-700" />
                        </div>
                        <span className="text-gray-700 dark:text-gray-300 text-sm">{item.text || item.title || (typeof item === 'string' ? item : '')}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-5">
                  <Link href="/about">
                    <div className="inline-flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white px-6 py-3 rounded-full text-sm font-semibold transition-all">
                      <Building2 className="w-4 h-4" /> Learn More
                    </div>
                  </Link>
                  <Link href="/auth/register" className="text-green-700 hover:text-green-600 text-sm font-medium flex items-center gap-1.5 group">
                    View All <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── FEATURES / WHY CHOOSE US ── */}
      {features.features && features.features.length > 0 && (
        <section id="features" className="py-20 px-4 bg-[#d4e6c3] dark:bg-gray-950">
          <div className="container mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-green-700 dark:text-green-400 mb-12">
              {features.title || `Why Choose ${companyName}?`}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {features.features.slice(0, 10).map((feature: any, i: number) => {
                const desc: string = feature.description || '';
                const plain = desc.replace(/<[^>]+>/g, '').trim();
                const short = plain.length > 80 ? plain.slice(0, 80) + '…' : plain;
                return (
                  <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm border border-green-100 dark:border-gray-800 hover:shadow-md transition-shadow">
                    {feature.image ? (
                      <div className="relative h-32 overflow-hidden">
                        <Image src={feature.image?.startsWith('http') ? feature.image : getImageUrl(feature.image || '')} alt={feature.title} fill className="object-cover hover:scale-105 transition-transform duration-500" />
                      </div>
                    ) : (
                      <div className="h-32 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30 flex items-center justify-center">
                        <Building2 className="w-10 h-10 text-green-400" />
                      </div>
                    )}
                    <div className="p-3">
                      <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-1.5">{feature.title}</h3>
                      <p className="text-gray-500 dark:text-gray-400 text-xs mb-3 leading-relaxed">{short}</p>
                      <Link href="/features">
                        <div className="inline-flex items-center gap-1 bg-green-700 hover:bg-green-600 text-white px-3 py-1.5 rounded-full text-xs font-semibold transition-all">
                          Learn More <ArrowRight className="w-3 h-3" />
                        </div>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-center gap-2 mt-10">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={`rounded-full transition-all ${i === 0 ? 'w-6 h-2.5 bg-green-700' : 'w-2.5 h-2.5 bg-green-200 dark:bg-green-900'}`} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── BROWSE PROPERTIES ── */}
      <section id="properties" className="py-20 px-4 bg-white dark:bg-gray-900">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12">
            <div>
              <span className="text-green-700 font-semibold text-xs uppercase tracking-wider">Browse</span>
              <h2 className="text-3xl md:text-4xl font-bold mt-1 text-gray-900 dark:text-white">Available Properties</h2>
              <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                {totalCount > 0 ? `${totalCount} properties found` : 'Explore our curated selection of premium properties'}
              </p>
            </div>
            <Link href="/properties" className="text-green-700 hover:text-green-600 font-medium flex items-center gap-2 group text-sm">
              View All <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-green-700" />
              <span className="ml-3 text-gray-500 text-sm">Loading properties…</span>
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-20">
              <Building2 className="w-16 h-16 mx-auto text-green-200 mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">No Properties Found</h3>
              <p className="text-gray-500 text-sm">Check back later for new listings.</p>
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {properties.slice(0, 6).map((property: any) => {
                  const TypeIcon = getTypeIcon(property.type);
                  return (
                    <Link key={property.id} href={`/properties/${property.id}`} className="group">
                      <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm border border-green-100 dark:border-gray-700 hover:shadow-md transition-all duration-300">
                        <div className="relative h-52 overflow-hidden">
                          {property.images?.length > 0 ? (
                            <Image src={property.images[0].startsWith('http') ? property.images[0] : getImageUrl(property.images[0])} alt={property.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
                              <TypeIcon className="w-14 h-14 text-green-400" />
                            </div>
                          )}
                          <div className="absolute top-3 left-3">
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-700 text-white">
                              {property.type?.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                        <div className="p-4">
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-green-700 transition-colors line-clamp-1">{property.title}</h3>
                          <div className="flex items-center gap-1 text-gray-500 text-xs">
                            <MapPin className="w-3.5 h-3.5 text-green-600" />
                            <span>{property.city}, {property.state}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-10">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => handlePageChange(page - 1)} className="border-green-200 text-green-700 hover:bg-green-50">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                    const pageNum = start + i;
                    if (pageNum > totalPages) return null;
                    return (
                      <Button key={pageNum} variant={pageNum === page ? 'default' : 'outline'} size="sm" onClick={() => handlePageChange(pageNum)}
                        className={pageNum === page ? 'bg-green-700 hover:bg-green-600 text-white' : 'border-green-200 text-green-700 hover:bg-green-50'}>
                        {pageNum}
                      </Button>
                    );
                  })}
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => handlePageChange(page + 1)} className="border-green-200 text-green-700 hover:bg-green-50">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* ── EVENTS ── */}
      {displayEvents.length > 0 && (
        <section className="py-20 px-4 bg-[#d4e6c3] dark:bg-gray-950">
          <div className="container mx-auto">
            <div className="mb-12">
              <span className="text-green-700 font-semibold text-xs uppercase tracking-wider">Events</span>
              <h2 className="text-3xl md:text-4xl font-bold mt-1 text-gray-900 dark:text-white">Upcoming Events</h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayEvents.map((ev) => {
                const spotsLeft = ev.maxAttendees ? ev.maxAttendees - (ev._count?.registrations ?? 0) : null;
                return (
                  <Link key={ev.id} href={`/event/${ev.slug}`} className="group">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm border border-green-100 dark:border-gray-800 hover:shadow-md transition-all flex flex-col h-full">
                      {ev.bannerUrl ? (
                        <div className="relative h-44 overflow-hidden">
                          <Image src={ev.bannerUrl} alt={ev.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                          {ev.isFeatured && (
                            <div className="absolute top-3 left-3">
                              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-700 text-white flex items-center gap-1">
                                <Star className="w-3 h-3 fill-white" /> Featured
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="h-44 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30 flex items-center justify-center">
                          <Calendar className="w-14 h-14 text-green-400" />
                        </div>
                      )}
                      <div className="p-5 flex flex-col gap-3 flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-green-700 transition-colors line-clamp-2">{ev.title}</h3>
                        <div className="space-y-1.5 text-xs text-gray-500">
                          <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-green-600" />{new Date(ev.eventDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
                          <div className="flex items-center gap-2">
                            {ev.locationType === 'online' ? <Globe className="w-3.5 h-3.5 text-green-600" /> : <MapPin className="w-3.5 h-3.5 text-green-600" />}
                            <span className="capitalize">{ev.locationType}{ev.locationDetails ? ` — ${ev.locationDetails}` : ''}</span>
                          </div>
                          {ev._count?.registrations !== undefined && (
                            <div className="flex items-center gap-2"><Users className="w-3.5 h-3.5 text-green-600" />{ev._count.registrations} registered{spotsLeft !== null ? ` · ${spotsLeft} spots left` : ''}</div>
                          )}
                        </div>
                        <div className="mt-auto pt-3 border-t border-green-50 dark:border-gray-800">
                          <span className="text-green-700 text-sm font-medium flex items-center gap-1">Register Now <ArrowRight className="w-3.5 h-3.5" /></span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── AGENTS ── */}
      {agents.agents && agents.agents.length > 0 && (
        <section className="py-20 px-4 bg-white dark:bg-gray-900">
          <div className="container mx-auto">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12">
              <div>
                <span className="text-green-700 font-semibold text-xs uppercase tracking-wider">Our Team</span>
                <h2 className="text-3xl md:text-4xl font-bold mt-1 text-gray-900 dark:text-white">Meet Our Top Realtors</h2>
              </div>
              <Link href="/auth/register" className="text-green-700 hover:text-green-600 font-medium flex items-center gap-2 group text-sm">
                View All <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {agents.agents.map((agent: any, i: number) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-green-100 dark:border-gray-700 hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="relative flex-shrink-0">
                      {(() => { const photo = agent.photo || agent.image || agent.avatar || ''; return <Image src={photo.startsWith('http') ? photo : getImageUrl(photo)} alt={agent.name} width={52} height={52} className="rounded-full object-cover" />; })()}
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-700 rounded-full border-2 border-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{agent.name}</h3>
                      <p className="text-xs text-gray-500">{typeof agent.role === 'string' ? agent.role : agent.role?.name || ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-green-50 dark:border-gray-700">
                    <div className="flex items-center gap-0.5">
                      {[...Array(Number(agent.rating) || 5)].map((_, j) => (
                        <Star key={j} className="w-3.5 h-3.5 fill-green-600 text-green-600" />
                      ))}
                    </div>
                    <span className="text-xs text-gray-500">{agent.deals} deals</span>
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
            <div className="text-center mb-12">
              <span className="text-green-300 text-xs font-semibold uppercase tracking-widest">Platform</span>
              <h2 className="text-3xl md:text-4xl font-bold mt-2 text-white">Everything You Need to Succeed</h2>
              <p className="text-green-200/70 text-sm mt-2 max-w-xl mx-auto">Comprehensive tools for managing your real estate business</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
              {platformFeatures.features.map((feature: any, i: number) => {
                const FeatureIcon = ICON_MAP[feature.icon] || Zap;
                return (
                  <div key={i} className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-5 hover:bg-white/15 transition-all group">
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

      {/* ── STATS ── */}
      {stats.stats && stats.stats.length > 0 && (
        <section className="py-16 px-4 bg-[#d4e6c3] dark:bg-gray-950">
          <div className="container mx-auto">
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 md:p-12 shadow-sm border border-green-100 dark:border-gray-800">
              <div className="grid md:grid-cols-4 gap-8 text-center">
                {stats.stats.map((stat: any, i: number) => {
                  const StatIcon = ICON_MAP[stat.icon] || [Building2, TrendingUp, Users, Star][i % 4];
                  return (
                    <div key={i} className="group">
                      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-green-50 dark:bg-green-900/40 flex items-center justify-center group-hover:bg-green-700 transition-all">
                        <StatIcon className="w-7 h-7 text-green-700 group-hover:text-white transition-colors" />
                      </div>
                      <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{stat.value}</div>
                      <div className="text-gray-500 text-sm">{stat.label}</div>
                    </div>
                  );
                })}
              </div>
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
                <Building2 className="w-36 h-36 text-green-400/10" strokeWidth={0.5} />
              </div>
              {(stats.stats?.[0] || totalCount > 0) && (
                <div className="absolute bottom-5 right-5 bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl px-4 py-3">
                  <div className="text-xl font-bold text-white">{stats.stats?.[0]?.value || `${totalCount}+`}</div>
                  <div className="text-xs text-green-300/70">{stats.stats?.[0]?.label || 'Properties Listed'}</div>
                </div>
              )}
            </div>
            {/* Content */}
            <div className="flex flex-col justify-center p-8 md:p-12 lg:p-14 flex-1">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-6 h-px bg-green-500" />
                <span className="text-green-400 text-xs font-semibold uppercase tracking-widest">Get Started</span>
              </div>
              <h2 className="text-2xl md:text-4xl font-bold text-white leading-tight mb-4 max-w-md">
                {cta.title || `Ready to Find Your Perfect Property with ${companyName}?`}
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed mb-8 max-w-sm">
                {cta.subtitle || "Whether you're buying, selling, or investing — our expert team guides you every step of the way."}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href={cta.primaryButtonLink || '/auth/register'}>
                  <div className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all">
                    {cta.primaryButtonText || 'Get Started'} <ArrowRight className="w-4 h-4" />
                  </div>
                </Link>
                <Link href={cta.secondaryButtonLink || '/contact'}>
                  <div className="inline-flex items-center gap-2 border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all">
                    {cta.secondaryButtonText || 'Contact Us'}
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CONTACT ── */}
      {(contact.phone || contact.email || contact.address) && (
        <section id="contact" className="py-20 px-4 bg-white dark:bg-gray-900">
          <div className="container mx-auto">
            <div className="grid lg:grid-cols-2 gap-12">
              <div>
                <span className="text-green-700 text-xs font-semibold uppercase tracking-widest">Get In Touch</span>
                <h2 className="text-3xl md:text-4xl font-bold mt-2 mb-6 text-gray-900 dark:text-white">Contact Us</h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-8">Have questions? We&apos;d love to hear from you.</p>
                <div className="space-y-5">
                  {[
                    contact.phone && { icon: Phone, label: 'Phone', value: contact.phone },
                    contact.email && { icon: Mail, label: 'Email', value: contact.email },
                    contact.address && { icon: MapPin, label: 'Address', value: contact.address },
                    contact.hours && { icon: Clock, label: 'Working Hours', value: contact.hours },
                  ].filter(Boolean).map((item: any, i: number) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-green-50 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
                        <item.icon className="w-5 h-5 text-green-700" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">{item.label}</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-green-50 dark:bg-gray-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-5 min-h-[280px] border border-green-100 dark:border-gray-700">
                <div className="w-14 h-14 rounded-2xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                  <Mail className="w-7 h-7 text-green-700" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Send Us a Message</h3>
                  <p className="text-gray-500 text-xs max-w-xs">Ready to connect? Visit our contact page and we&apos;ll get back to you shortly.</p>
                </div>
                <Link href="/contact">
                  <div className="inline-flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white px-6 py-3 rounded-full text-sm font-semibold transition-all">
                    Go to Contact Page <ArrowRight className="w-4 h-4" />
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── MAP ── */}
      <section className="bg-[#d4e6c3] dark:bg-gray-950">
        <div className="container mx-auto px-4 pt-16 pb-8">
          <div className="text-center mb-8">
            <span className="text-green-700 text-xs font-semibold uppercase tracking-widest">Our Location</span>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-1">Find Us</h2>
            {contact.address && (
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-2 flex items-center justify-center gap-1.5">
                <MapPin className="w-4 h-4 text-green-700 flex-shrink-0" />
                {contact.address}
              </p>
            )}
          </div>
        </div>
        <div className="relative w-full overflow-hidden" style={{ height: '420px' }}>
          <iframe
            src={`https://maps.google.com/maps?q=${encodeURIComponent(contact.mapCoordinates?.trim() || contact.address || companyName + ' real estate')}&output=embed&hl=en&z=16`}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Office Location"
          />
          {/* green tint overlay strip at top to blend with section */}
          <div className="absolute top-0 left-0 right-0 h-3 bg-[#d4e6c3] dark:bg-gray-950" />
        </div>
      </section>

      {/* Extra bottom padding on mobile so content clears the floating bottom nav */}
      <div className="md:hidden h-24" />

      <PublicFooter cmsData={cms?.footer} />
    </div>
  );
}
