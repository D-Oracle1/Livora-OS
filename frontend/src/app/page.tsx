'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Building2, Users, TrendingUp, Shield, BarChart3, MessageSquare, Award, Zap,
  Search, Home, ChevronLeft, ChevronRight, Star, ArrowRight, CheckCircle2,
  Phone, Mail, MapPin, Clock, LandPlot, Loader2, Calendar, Globe,
  Bed, Bath, Maximize2, ChevronDown,
} from 'lucide-react';
import { PublicNavbar } from '@/components/layout/public-navbar';
import { PublicFooter } from '@/components/layout/public-footer';
import { api, getImageUrl } from '@/lib/api';
import { useTenantResolution } from '@/hooks/use-tenant-resolution';

interface HomepageEvent {
  id: string; title: string; slug: string; bannerUrl: string | null;
  isFeatured: boolean; eventDate: string; locationType: 'physical' | 'online';
  locationDetails: string | null; maxAttendees: number | null;
  _count: { registrations: number };
}

const ICON_MAP: Record<string, any> = {
  Users, Building2, TrendingUp, Award, BarChart3, MessageSquare, Shield, Zap, Star, Search,
};

const PROPERTY_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'APARTMENT', label: 'Apartment' },
  { value: 'HOUSE', label: 'House' },
  { value: 'DUPLEX', label: 'Duplex' },
  { value: 'LAND', label: 'Land' },
  { value: 'COMMERCIAL', label: 'Commercial' },
  { value: 'INDUSTRIAL', label: 'Industrial' },
];

const PRICE_RANGES = [
  { value: '', label: 'Any Price' },
  { value: '0-50', label: 'Under N50M' },
  { value: '50-100', label: 'N50M - N100M' },
  { value: '100-500', label: 'N100M - N500M' },
  { value: '500-1000', label: 'N500M - N1B' },
  { value: '1000+', label: 'Above N1B' },
];

// Placeholder hero images (used when no CMS hero images are configured)
const HERO_PLACEHOLDERS = [
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&q=80',
  'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1600&q=80',
  'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1600&q=80',
  'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1600&q=80',
  'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=1600&q=80',
];

function formatPrice(price: any) {
  const n = Number(price);
  if (!n) return 'Contact';
  if (n >= 1_000_000_000) return `N${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `N${(n / 1_000_000).toFixed(2)}M`;
  return `N${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'LAND': return LandPlot;
    case 'COMMERCIAL':
    case 'INDUSTRIAL': return Building2;
    default: return Home;
  }
}

export default function HomePage() {
  const router = useRouter();
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [cms, setCms] = useState<Record<string, any> | null>(null);
  const [cmsLoading, setCmsLoading] = useState(true);
  const [events, setEvents] = useState<{
    featured: HomepageEvent[];
    upcoming: HomepageEvent[];
    closingSoon: HomepageEvent[];
  } | null>(null);

  const [searchType, setSearchType] = useState('');
  const [searchPrice, setSearchPrice] = useState('');
  const [searchLocation, setSearchLocation] = useState('');
  const [showTypeDD, setShowTypeDD] = useState(false);
  const [showPriceDD, setShowPriceDD] = useState(false);
  const typeRef = useRef<HTMLDivElement>(null);
  const priceRef = useRef<HTMLDivElement>(null);

  const { tenantReady } = useTenantResolution();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (typeRef.current && !typeRef.current.contains(e.target as Node)) setShowTypeDD(false);
      if (priceRef.current && !priceRef.current.contains(e.target as Node)) setShowPriceDD(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (!tenantReady) return;
    api.get('/cms/public')
      .then((raw) => {
        const data = raw?.data || raw;
        if (data && typeof data === 'object') setCms(data);
      })
      .catch(() => {})
      .finally(() => setCmsLoading(false));
    api.get<{ data: { featured: HomepageEvent[]; upcoming: HomepageEvent[]; closingSoon: HomepageEvent[] } }>('/events/homepage')
      .then((res) => {
        const d = res?.data;
        if (d && (d.featured || d.upcoming)) setEvents(d);
      })
      .catch(() => {});
  }, [tenantReady]);

  const companyName = cms?.branding?.companyName || 'Livora OS';
  const hero = cms?.hero || {};
  const agents = cms?.agents || {};
  const features = cms?.features || {};
  const platformFeatures = cms?.platform_features || {};
  const about = cms?.about || {};
  const stats = cms?.stats || {};
  const cta = cms?.cta || {};
  const contact = cms?.contact || {};

  const heroTitle = hero.title || 'Your Reliable Ally in';
  const heroTitleLine2 = hero.titleAccent || 'Worldwide Real Estate';

  const fetchProperties = useCallback(async (currentPage = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(currentPage));
      params.append('limit', '6');
      const raw = await api.get(`/properties/listed?${params.toString()}`);
      const items = Array.isArray(raw) ? raw : (raw?.data || []);
      const meta = raw?.meta;
      setProperties(items);
      setTotalPages(meta?.totalPages || 1);
      setTotalCount(meta?.total ?? items.length);
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

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchType) params.set('type', searchType);
    if (searchPrice) params.set('price', searchPrice);
    if (searchLocation) params.set('search', searchLocation);
    router.push(`/properties?${params.toString()}`);
  };

  const rawCarouselImages: string[] = Array.isArray(hero.backgroundImages) && hero.backgroundImages.length > 0
    ? hero.backgroundImages
    : hero.backgroundImage ? [hero.backgroundImage] : [];
  const cmsImages = rawCarouselImages.map((img: string) =>
    img.startsWith('http') ? img : getImageUrl(img)
  );
  // Always show a carousel: use CMS images if available, else placeholders
  const carouselImages = cmsImages.length > 0 ? cmsImages : HERO_PLACEHOLDERS;

  const [carouselIndex, setCarouselIndex] = useState(0);
  const carouselTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCarousel = useCallback(() => {
    if (carouselTimer.current) clearInterval(carouselTimer.current);
    carouselTimer.current = setInterval(() => {
      setCarouselIndex(prev => (prev + 1) % carouselImages.length);
    }, 5000);
  }, [carouselImages.length]);

  const goPrev = useCallback(() => {
    setCarouselIndex(prev => (prev - 1 + carouselImages.length) % carouselImages.length);
    startCarousel();
  }, [carouselImages.length, startCarousel]);

  const goNext = useCallback(() => {
    setCarouselIndex(prev => (prev + 1) % carouselImages.length);
    startCarousel();
  }, [carouselImages.length, startCarousel]);

  useEffect(() => {
    startCarousel();
    return () => { if (carouselTimer.current) clearInterval(carouselTimer.current); };
  }, [startCarousel]);

  const displayEvents = events
    ? (events.featured.length > 0 ? events.featured : events.upcoming.slice(0, 3))
    : [];

  const selectedTypeLabel = PROPERTY_TYPES.find(t => t.value === searchType)?.label || 'All Types';
  const selectedPriceLabel = PRICE_RANGES.find(r => r.value === searchPrice)?.label || 'Any Price';

  return (
    <div className="min-h-dvh bg-white dark:bg-gray-950">
      <PublicNavbar currentPage="/" />

      {/* ──────────────── HERO ──────────────── */}
      <section className="pt-16 bg-white dark:bg-gray-950">
        <div className="px-3 sm:px-6 lg:px-8 pt-4 pb-0">
          {/* Rounded hero card — taller on mobile to fit stacked search bar */}
          <div className="relative w-full overflow-hidden rounded-xl sm:rounded-2xl min-h-[580px] sm:min-h-[540px] md:min-h-[560px]">

            {/* Carousel slides */}
            {carouselImages.map((src, idx) => (
              <div
                key={idx}
                className="absolute inset-0 transition-opacity duration-1000"
                style={{ opacity: idx === carouselIndex ? 1 : 0 }}
              >
                <Image
                  src={src}
                  alt={`Hero slide ${idx + 1}`}
                  fill
                  className="object-cover"
                  priority={idx === 0}
                />
              </div>
            ))}

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/50 to-black/90" />

            {/* Prev / Next arrows — anchored to center of the image area above the content block */}
            <button
              onClick={goPrev}
              aria-label="Previous slide"
              className="absolute left-3 sm:left-4 top-[38%] sm:top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-sm border border-white/30 flex items-center justify-center text-white transition-all"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button
              onClick={goNext}
              aria-label="Next slide"
              className="absolute right-3 sm:right-4 top-[38%] sm:top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-sm border border-white/30 flex items-center justify-center text-white transition-all"
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Hero content: title + search bar anchored to bottom */}
            <div className="relative z-10 flex flex-col items-center justify-end pb-7 sm:pb-10 px-4 text-center min-h-[580px] sm:min-h-[540px] md:min-h-[560px]">

              <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight drop-shadow-lg">
                {heroTitle}
              </h1>
              <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-5 sm:mb-8 drop-shadow-lg">
                {heroTitleLine2}
              </h1>

              {/* ── Search bar ── */}
              <div className="w-full max-w-2xl bg-white rounded-xl sm:rounded-2xl shadow-2xl overflow-visible">

                {/* Mobile: 2×2 grid layout. Desktop: single row */}
                <div className="grid grid-cols-2 sm:flex">

                  {/* Type dropdown */}
                  <div ref={typeRef} className="relative sm:flex-1 min-w-0 border-b sm:border-b-0 border-r sm:border-r border-gray-200">
                    <button
                      onClick={() => { setShowTypeDD(v => !v); setShowPriceDD(false); }}
                      className="w-full flex items-center justify-between gap-1 px-3 sm:px-5 py-3 sm:py-4 hover:bg-gray-50 rounded-tl-xl sm:rounded-tl-2xl transition-colors"
                    >
                      <div className="text-left min-w-0">
                        <p className="text-[10px] sm:text-xs text-gray-400 leading-none mb-0.5">Type</p>
                        <p className="text-xs sm:text-sm font-semibold text-gray-800 truncate">{selectedTypeLabel}</p>
                      </div>
                      <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                    </button>
                    {showTypeDD && (
                      <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 py-1 min-w-[150px] z-50">
                        {PROPERTY_TYPES.map(t => (
                          <button
                            key={t.value}
                            onClick={() => { setSearchType(t.value); setShowTypeDD(false); }}
                            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-primary/5 transition-colors ${searchType === t.value ? 'text-primary font-semibold' : 'text-gray-700'}`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Price dropdown */}
                  <div ref={priceRef} className="relative sm:flex-1 min-w-0 border-b sm:border-b-0 sm:border-r border-gray-200">
                    <button
                      onClick={() => { setShowPriceDD(v => !v); setShowTypeDD(false); }}
                      className="w-full flex items-center justify-between gap-1 px-3 sm:px-5 py-3 sm:py-4 hover:bg-gray-50 rounded-tr-xl sm:rounded-tr-none transition-colors"
                    >
                      <div className="text-left min-w-0">
                        <p className="text-[10px] sm:text-xs text-gray-400 leading-none mb-0.5">Price</p>
                        <p className="text-xs sm:text-sm font-semibold text-gray-800 truncate">{selectedPriceLabel}</p>
                      </div>
                      <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                    </button>
                    {showPriceDD && (
                      <div className="absolute top-full right-0 sm:left-0 sm:right-auto mt-1 bg-white rounded-xl shadow-xl border border-gray-100 py-1 min-w-[170px] z-50">
                        {PRICE_RANGES.map(r => (
                          <button
                            key={r.value}
                            onClick={() => { setSearchPrice(r.value); setShowPriceDD(false); }}
                            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-primary/5 transition-colors ${searchPrice === r.value ? 'text-primary font-semibold' : 'text-gray-700'}`}
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Area text input */}
                  <div className="sm:flex-1 min-w-0 px-3 sm:px-5 py-3 sm:py-4 sm:border-r border-gray-200">
                    <p className="text-[10px] sm:text-xs text-gray-400 leading-none mb-0.5">Area</p>
                    <input
                      type="text"
                      placeholder="City or area"
                      value={searchLocation}
                      onChange={e => setSearchLocation(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSearch()}
                      className="w-full text-xs sm:text-sm font-semibold text-gray-800 placeholder-gray-400 outline-none bg-transparent"
                    />
                  </div>

                  {/* Search button — spans full width on mobile bottom row */}
                  <button
                    onClick={handleSearch}
                    className="flex items-center justify-center gap-2 bg-primary hover:bg-primary-800 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-br-xl sm:rounded-br-2xl rounded-bl-xl sm:rounded-bl-none sm:rounded-tr-2xl font-semibold text-xs sm:text-sm transition-colors"
                  >
                    <Search className="w-4 h-4" />
                    Search
                  </button>
                </div>
              </div>

              {/* Dot indicators */}
              <div className="flex gap-2 mt-4 sm:mt-5">
                {carouselImages.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => { setCarouselIndex(idx); startCarousel(); }}
                    className={`transition-all duration-300 rounded-full ${
                      idx === carouselIndex
                        ? 'bg-white w-5 sm:w-6 h-2 sm:h-2.5'
                        : 'bg-white/50 hover:bg-white/75 w-2 sm:w-2.5 h-2 sm:h-2.5'
                    }`}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────── PROPERTIES ──────────────── */}
      <section id="properties" className="py-14 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-950">
        <div className="max-w-screen-xl mx-auto">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Available Properties</h2>
              {totalCount > 0 && <p className="text-gray-400 text-sm mt-1">{totalCount} properties listed</p>}
            </div>
            <Link href="/properties" className="text-sm font-semibold text-primary hover:text-primary-800 flex items-center gap-1 group">
              View All <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-3 text-gray-400">Loading properties...</span>
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-24">
              <Building2 className="w-14 h-14 mx-auto text-gray-200 mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-1">No Properties Listed Yet</h3>
              <p className="text-gray-400 text-sm">Check back soon for new listings.</p>
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {properties.slice(0, 6).map((property: any) => {
                  const TypeIcon = getTypeIcon(property.type);
                  const beds = property.bedrooms;
                  const baths = property.bathrooms;
                  const sqft = property.area;
                  return (
                    <div key={property.id} className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300 border border-gray-100 dark:border-gray-800 flex flex-col">
                      {/* Image area */}
                      <Link href={`/properties/${property.id}`} className="block relative flex-shrink-0 overflow-hidden" style={{ height: '200px' }}>
                        {property.images && property.images.length > 0 ? (
                          <Image
                            src={property.images[0].startsWith('http') ? property.images[0] : getImageUrl(property.images[0])}
                            alt={property.title}
                            fill
                            className="object-cover hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                            <TypeIcon className="w-14 h-14 text-primary-300" />
                          </div>
                        )}
                        {/* For Sale badge */}
                        <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-md shadow-sm">
                          For Sale
                        </span>
                      </Link>

                      {/* Card body */}
                      <div className="p-5 flex flex-col flex-1">
                        {/* Location */}
                        <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1.5">
                          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="line-clamp-1">{[property.city, property.state].filter(Boolean).join(', ')}</span>
                        </div>

                        {/* Title */}
                        <Link href={`/properties/${property.id}`}>
                          <h3 className="font-bold text-gray-900 dark:text-white text-base mb-3 leading-snug hover:text-primary transition-colors line-clamp-1">
                            {property.title}
                          </h3>
                        </Link>

                        {/* Specs row */}
                        <div className="flex items-center text-gray-400 text-xs mb-4 pb-4 border-b border-gray-100 dark:border-gray-800">
                          {beds != null && (
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <Bed className="w-3.5 h-3.5" />
                              <span>{beds} Bed Room</span>
                            </div>
                          )}
                          {beds != null && (baths != null || sqft != null) && (
                            <div className="w-px h-3 bg-gray-200 dark:bg-gray-700 mx-3 flex-shrink-0" />
                          )}
                          {baths != null && (
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <Bath className="w-3.5 h-3.5" />
                              <span>{baths} Bath</span>
                            </div>
                          )}
                          {baths != null && sqft != null && (
                            <div className="w-px h-3 bg-gray-200 dark:bg-gray-700 mx-3 flex-shrink-0" />
                          )}
                          {sqft != null && (
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <Maximize2 className="w-3.5 h-3.5" />
                              <span>{Number(sqft).toLocaleString()} SQ FT</span>
                            </div>
                          )}
                        </div>

                        {/* Price + View Details */}
                        <div className="flex items-center justify-between mt-auto">
                          <span className="text-lg font-bold text-gray-900 dark:text-white">
                            {formatPrice(property.price)}
                          </span>
                          <Link href={`/properties/${property.id}`}>
                            <button className="flex items-center gap-1.5 bg-primary hover:bg-primary-800 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors">
                              View Details
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-10">
                  <button
                    disabled={page <= 1}
                    onClick={() => handlePageChange(page - 1)}
                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                    const pageNum = start + i;
                    if (pageNum > totalPages) return null;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${pageNum === page ? 'bg-primary text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    disabled={page >= totalPages}
                    onClick={() => handlePageChange(page + 1)}
                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* ──────────────── EVENTS ──────────────── */}
      {displayEvents.length > 0 && (
        <section className="py-14 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900">
          <div className="max-w-screen-xl mx-auto">
            <div className="mb-8">
              <p className="text-primary font-semibold text-xs uppercase tracking-wider mb-1">Events</p>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Upcoming Events</h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayEvents.map((ev) => {
                const spotsLeft = ev.maxAttendees ? ev.maxAttendees - (ev._count?.registrations ?? 0) : null;
                return (
                  <Link key={ev.id} href={`/event/${ev.slug}`} className="group">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300 border border-gray-100 dark:border-gray-700 flex flex-col h-full">
                      {ev.bannerUrl ? (
                        <div className="relative h-44 flex-shrink-0 overflow-hidden">
                          <Image src={ev.bannerUrl} alt={ev.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                          {ev.isFeatured && (
                            <span className="absolute top-3 left-3 bg-yellow-400 text-yellow-900 text-xs font-semibold px-2.5 py-1 rounded-md">
                              Featured
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="h-44 bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center flex-shrink-0">
                          <Calendar className="w-14 h-14 text-primary-300" />
                        </div>
                      )}
                      <div className="p-5 flex flex-col gap-3 flex-1">
                        <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                          {ev.title}
                        </h3>
                        <div className="space-y-1.5 text-xs text-gray-400">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                            <span>{new Date(ev.eventDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {ev.locationType === 'online'
                              ? <Globe className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                              : <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                            <span className="capitalize">{ev.locationType}{ev.locationDetails && ` — ${ev.locationDetails}`}</span>
                          </div>
                          {ev._count?.registrations !== undefined && (
                            <div className="flex items-center gap-2">
                              <Users className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                              <span>{ev._count.registrations} registered{spotsLeft !== null && ` · ${spotsLeft} spots left`}</span>
                            </div>
                          )}
                        </div>
                        <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-700">
                          <span className="text-primary text-sm font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                            Register Now <ArrowRight className="w-3.5 h-3.5" />
                          </span>
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

      {/* ──────────────── AGENTS ──────────────── */}
      {agents.agents && agents.agents.length > 0 && (
        <section className="py-14 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-950">
          <div className="max-w-screen-xl mx-auto">
            <p className="text-primary font-semibold text-xs uppercase tracking-wider mb-1">Our Team</p>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-8">Meet Our Top Realtors</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {agents.agents.map((agent: any, index: number) => (
                <div key={index} className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-md hover:shadow-xl transition-shadow border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="relative flex-shrink-0">
                      <Image
                        src={agent.image?.startsWith('http') ? agent.image : getImageUrl(agent.image || '')}
                        alt={agent.name} width={48} height={48} className="rounded-full object-cover"
                      />
                      <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-primary rounded-full border-2 border-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white text-sm">{agent.name}</h3>
                      <p className="text-xs text-gray-400">{typeof agent.role === 'string' ? agent.role : agent.role?.name || ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex">
                      {[...Array(Math.min(5, Number(agent.rating) || 5))].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <span className="text-xs text-gray-400">{agent.deals} deals</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ──────────────── FEATURES ──────────────── */}
      {features.features && features.features.length > 0 && (
        <section className="py-14 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900">
          <div className="max-w-screen-xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-primary font-semibold text-xs uppercase tracking-wider mb-2">Why Choose Us</p>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-3">Search Properties with Ease</h2>
              <p className="text-gray-400 max-w-xl mx-auto text-sm">Powerful features for modern real estate professionals</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.features.slice(0, 3).map((feature: any, index: number) => {
                const desc: string = feature.description || '';
                const excerpt = desc.length > 140 ? desc.slice(0, 140) + '…' : desc;
                return (
                  <div key={index} className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow border border-gray-100 dark:border-gray-700">
                    {feature.image && (
                      <div className="relative h-44 overflow-hidden">
                        <Image
                          src={feature.image?.startsWith('http') ? feature.image : getImageUrl(feature.image || '')}
                          alt={feature.title} fill className="object-cover"
                        />
                      </div>
                    )}
                    <div className="p-6">
                      <h3 className="font-bold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
                      <p className="text-gray-400 text-sm mb-4 leading-relaxed">{excerpt}</p>
                      <Link href="/features" className="text-primary text-sm font-semibold flex items-center gap-1">
                        Read More <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ──────────────── PLATFORM ──────────────── */}
      {platformFeatures.features && platformFeatures.features.length > 0 && (
        <section className="py-14 px-4 sm:px-6 lg:px-8 bg-primary-900">
          <div className="max-w-screen-xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-accent font-semibold text-xs uppercase tracking-wider mb-2">Platform</p>
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Everything You Need to Succeed</h2>
              <p className="text-white/60 max-w-xl mx-auto text-sm">Comprehensive tools for managing your real estate business</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
              {platformFeatures.features.map((feature: any, index: number) => {
                const FeatureIcon = ICON_MAP[feature.icon] || Zap;
                return (
                  <div key={index} className="bg-white/10 border border-white/15 rounded-2xl p-6 hover:bg-white/15 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center mb-4">
                      <FeatureIcon className="w-5 h-5 text-accent" />
                    </div>
                    <h3 className="font-bold text-white mb-2 text-sm">{feature.title}</h3>
                    <p className="text-white/60 text-xs leading-relaxed">{feature.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ──────────────── ABOUT ──────────────── */}
      {(about.title || about.content) && (
        <section className="py-14 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-950">
          <div className="max-w-screen-xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-primary font-semibold text-xs uppercase tracking-wider mb-2">{about.subtitle || 'About Us'}</p>
              {about.title && (
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-5 leading-tight">{about.title}</h2>
              )}
              {(() => {
                const raw = about.content || '';
                const plain = raw.replace(/<[^>]+>/g, '').trim();
                const full = plain || 'Your trusted partner in real estate. Dedicated to helping you find the perfect property.';
                const limit = 320;
                const excerpt = full.length > limit ? full.slice(0, full.lastIndexOf(' ', limit)) + '…' : full;
                return <p className="text-gray-400 mb-6 leading-relaxed text-sm">{excerpt}</p>;
              })()}
              {about.items && about.items.length > 0 && (
                <div className="space-y-3 mb-8">
                  {about.items.slice(0, 3).map((item: any, index: number) => (
                    <div key={index} className="flex items-center gap-3">
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="text-gray-600 dark:text-gray-300 text-sm">{item.text || item.title || (typeof item === 'string' ? item : '')}</span>
                    </div>
                  ))}
                </div>
              )}
              <Link href="/about">
                <button className="bg-primary hover:bg-primary-800 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors flex items-center gap-2">
                  Learn More <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </div>
            <div className="relative h-[380px] sm:h-[460px] rounded-2xl overflow-hidden">
              {about.image ? (
                <Image
                  src={about.image?.startsWith('http') ? about.image : getImageUrl(about.image)}
                  alt="About us" fill className="object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                  <Building2 className="w-20 h-20 text-primary-300" />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ──────────────── STATS ──────────────── */}
      {stats.stats && stats.stats.length > 0 && (
        <section className="py-14 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900">
          <div className="max-w-screen-xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 md:p-12 shadow-md border border-gray-100 dark:border-gray-700">
              <div className="grid md:grid-cols-4 gap-8 text-center">
                {stats.stats.map((stat: any, index: number) => {
                  const StatIcon = ICON_MAP[stat.icon] || [Building2, TrendingUp, Users, Star][index % 4];
                  return (
                    <div key={index}>
                      <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-primary/10 flex items-center justify-center">
                        <StatIcon className="w-6 h-6 text-primary" />
                      </div>
                      <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{stat.value}</div>
                      <div className="text-gray-400 text-sm">{stat.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ──────────────── CTA ──────────────── */}
      <section className="py-14 px-4 sm:px-6 lg:px-8 bg-primary-900">
        <div className="max-w-screen-xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
            {cta.title || `Ready to Get Started with ${companyName}?`}
          </h2>
          <p className="text-white/70 max-w-xl mx-auto mb-8 text-sm">
            {cta.subtitle || "Whether you're buying, selling, or managing properties — we are your trusted partner."}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={cta.primaryButtonLink || '/auth/register'}>
              <button className="bg-accent hover:bg-accent-600 text-white font-semibold px-8 py-3 rounded-xl transition-colors">
                {cta.primaryButtonText || 'Get Started'}
              </button>
            </Link>
            <Link href={cta.secondaryButtonLink || '/contact'}>
              <button className="border border-white/30 text-white hover:bg-white/10 font-semibold px-8 py-3 rounded-xl transition-colors">
                {cta.secondaryButtonText || 'Contact Us'}
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ──────────────── CONTACT ──────────────── */}
      {(contact.phone || contact.email || contact.address) && (
        <section className="py-14 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-950">
          <div className="max-w-screen-xl mx-auto grid lg:grid-cols-2 gap-12">
            <div>
              <p className="text-primary font-semibold text-xs uppercase tracking-wider mb-2">Get In Touch</p>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6">Contact Us</h2>
              <div className="space-y-5">
                {[
                  contact.phone && { icon: Phone, label: 'Phone', value: contact.phone },
                  contact.email && { icon: Mail, label: 'Email', value: contact.email },
                  contact.address && { icon: MapPin, label: 'Address', value: contact.address },
                  contact.hours && { icon: Clock, label: 'Working Hours', value: contact.hours },
                ].filter(Boolean).map((item: any, index: number) => (
                  <div key={index} className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">{item.label}</p>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-5 border border-gray-100 dark:border-gray-800">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Mail className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-1">Send Us a Message</h3>
                <p className="text-gray-400 text-sm max-w-xs mx-auto">
                  Visit our contact page and we&apos;ll get back to you as soon as possible.
                </p>
              </div>
              <Link href="/contact">
                <button className="bg-primary hover:bg-primary-800 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm flex items-center gap-2">
                  Go to Contact Page <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </div>
          </div>
        </section>
      )}

      <PublicFooter cmsData={cms?.footer} />
    </div>
  );
}
