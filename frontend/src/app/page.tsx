'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Users, TrendingUp, Shield, BarChart3, MessageSquare, Award, Zap,
  Search, Home, ChevronLeft, ChevronRight, Star, ArrowRight, CheckCircle2,
  Phone, Mail, MapPin, Clock, LandPlot, Loader2, Calendar, Globe,
  Bed, Bath, Maximize2, ChevronDown,
  // Mobile-only
  Heart, User, X, SlidersHorizontal,
} from 'lucide-react';
import { PublicNavbar } from '@/components/layout/public-navbar';
import { PublicFooter } from '@/components/layout/public-footer';
import { api, getImageUrl } from '@/lib/api';
import { useTenantResolution } from '@/hooks/use-tenant-resolution';
import { useBranding, getCompanyName } from '@/hooks/use-branding';

// ── Types ──────────────────────────────────────────────────────────────────────
interface HomepageEvent {
  id: string; title: string; slug: string; bannerUrl: string | null;
  isFeatured: boolean; eventDate: string; locationType: 'physical' | 'online';
  locationDetails: string | null; maxAttendees: number | null;
  _count: { registrations: number };
}

// ── Constants ──────────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, any> = {
  Users, Building2, TrendingUp, Award, BarChart3, MessageSquare, Shield, Zap, Star, Search,
};

const HERO_PLACEHOLDERS = [
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&q=80',
  'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1600&q=80',
  'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1600&q=80',
  'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1600&q=80',
  'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=1600&q=80',
];

// Desktop dropdown types
const PROPERTY_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'APARTMENT', label: 'Apartment' },
  { value: 'HOUSE', label: 'House' },
  { value: 'DUPLEX', label: 'Duplex' },
  { value: 'LAND', label: 'Land' },
  { value: 'COMMERCIAL', label: 'Commercial' },
  { value: 'INDUSTRIAL', label: 'Industrial' },
];

// Mobile chip categories (with emoji)
const PROPERTY_CATEGORIES = [
  { value: '', label: 'All', emoji: '🏠' },
  { value: 'HOUSE', label: 'House', emoji: '🏡' },
  { value: 'APARTMENT', label: 'Apartment', emoji: '🏢' },
  { value: 'DUPLEX', label: 'Duplex', emoji: '🏘️' },
  { value: 'LAND', label: 'Land', emoji: '🌿' },
  { value: 'COMMERCIAL', label: 'Commercial', emoji: '🏪' },
];

const PRICE_RANGES = [
  { value: '', label: 'Any Price' },
  { value: '0-50', label: 'Under ₦50M' },
  { value: '50-100', label: '₦50M – ₦100M' },
  { value: '100-500', label: '₦100M – ₦500M' },
  { value: '500-1000', label: '₦500M – ₦1B' },
  { value: '1000+', label: 'Above ₦1B' },
];

// Desktop price ranges (original N prefix)
const PRICE_RANGES_DESKTOP = [
  { value: '', label: 'Any Price' },
  { value: '0-50', label: 'Under N50M' },
  { value: '50-100', label: 'N50M - N100M' },
  { value: '100-500', label: 'N100M - N500M' },
  { value: '500-1000', label: 'N500M - N1B' },
  { value: '1000+', label: 'Above N1B' },
];

const MOBILE_NAV = [
  { id: 'home', label: 'Home', Icon: Home, href: '/' },
  { id: 'properties', label: 'Properties', Icon: Building2, href: '/properties' },
  { id: 'about', label: 'About', Icon: Users, href: '/about' },
  { id: 'contact', label: 'Contact', Icon: Phone, href: '/contact' },
  { id: 'login', label: 'Login', Icon: User, href: '/auth/login' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatPriceMobile(price: any) {
  const n = Number(price);
  if (!n) return 'Contact Us';
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  return `₦${n.toLocaleString()}`;
}

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

// ── Component ──────────────────────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter();

  // Branding (used by mobile top bar + both layouts)
  const branding = useBranding();
  const companyName = getCompanyName(branding);
  const logoUrl = branding.logo
    ? (branding.logo.startsWith('http') ? branding.logo : getImageUrl(branding.logo))
    : '';

  // ── Shared data state ───────────────────────────────────────────────────────
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [cms, setCms] = useState<Record<string, any> | null>(null);
  const [events, setEvents] = useState<{
    featured: HomepageEvent[]; upcoming: HomepageEvent[]; closingSoon: HomepageEvent[];
  } | null>(null);

  // ── Shared search state ─────────────────────────────────────────────────────
  const [searchType, setSearchType] = useState('');
  const [searchPrice, setSearchPrice] = useState('');

  // ── Desktop-specific state ──────────────────────────────────────────────────
  const [searchLocation, setSearchLocation] = useState('');
  const [showTypeDD, setShowTypeDD] = useState(false);
  const [showPriceDD, setShowPriceDD] = useState(false);
  const typeRef = useRef<HTMLDivElement>(null);
  const priceRef = useRef<HTMLDivElement>(null);

  // ── Mobile-specific state ───────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [searchSheetOpen, setSearchSheetOpen] = useState(false);
  const [activeNavTab, setActiveNavTab] = useState('home');

  const { tenantReady } = useTenantResolution();

  // ── Carousel state ──────────────────────────────────────────────────────────
  const [carouselIndex, setCarouselIndex] = useState(0);
  const carouselTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Desktop dropdown outside-click ─────────────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (typeRef.current && !typeRef.current.contains(e.target as Node)) setShowTypeDD(false);
      if (priceRef.current && !priceRef.current.contains(e.target as Node)) setShowPriceDD(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── Data fetching ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tenantReady) return;
    api.get('/cms/public')
      .then(raw => { const d = raw?.data || raw; if (d && typeof d === 'object') setCms(d); })
      .catch(() => {});
    api.get<any>('/events/homepage')
      .then(res => { const d = res?.data; if (d && (d.featured || d.upcoming)) setEvents(d); })
      .catch(() => {});
  }, [tenantReady]);

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
    } catch { setProperties([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!tenantReady) return;
    fetchProperties(1);
  }, [tenantReady, fetchProperties]);

  // ── Carousel setup ──────────────────────────────────────────────────────────
  const hero = cms?.hero || {};
  const rawCarouselImages: string[] =
    Array.isArray(hero.backgroundImages) && hero.backgroundImages.length > 0
      ? hero.backgroundImages
      : hero.backgroundImage ? [hero.backgroundImage] : [];
  const cmsImages = rawCarouselImages.map((img: string) =>
    img.startsWith('http') ? img : getImageUrl(img)
  );
  const carouselImages = cmsImages.length > 0 ? cmsImages : HERO_PLACEHOLDERS;

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

  // ── Derived ─────────────────────────────────────────────────────────────────
  const cmsCompanyName = cms?.branding?.companyName || companyName;
  const agents = cms?.agents || {};
  const features = cms?.features || {};
  const platformFeatures = cms?.platform_features || {};
  const about = cms?.about || {};
  const stats = cms?.stats || {};
  const cta = cms?.cta || {};
  const contact = cms?.contact || {};

  const heroTitle = hero.title || 'Your Reliable Ally in';
  const heroTitleLine2 = hero.titleAccent || 'Worldwide Real Estate';

  const selectedTypeLabel = PROPERTY_TYPES.find(t => t.value === searchType)?.label || 'All Types';
  const selectedPriceLabel = PRICE_RANGES_DESKTOP.find(r => r.value === searchPrice)?.label || 'Any Price';

  const displayEvents = events
    ? (events.featured.length > 0 ? events.featured : events.upcoming.slice(0, 6))
    : [];

  const filteredProperties = activeCategory
    ? properties.filter((p: any) => p.type === activeCategory)
    : properties;

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleDesktopSearch = () => {
    const params = new URLSearchParams();
    if (searchType) params.set('type', searchType);
    if (searchPrice) params.set('price', searchPrice);
    if (searchLocation) params.set('search', searchLocation);
    router.push(`/properties?${params.toString()}`);
  };

  const handleMobileSearch = () => {
    const params = new URLSearchParams();
    if (searchType) params.set('type', searchType);
    if (searchPrice) params.set('price', searchPrice);
    if (searchQuery) params.set('search', searchQuery);
    setSearchSheetOpen(false);
    router.push(`/properties?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchProperties(newPage);
    document.getElementById('properties')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleNavTab = (tab: (typeof MOBILE_NAV)[0]) => {
    if (tab.href) {
      setActiveNavTab(tab.id);
      router.push(tab.href);
    }
  };

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════════════
          MOBILE APP UI  —  screens below md (< 768 px)
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="md:hidden min-h-dvh bg-gray-50 dark:bg-gray-950">

        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <section className="relative h-[85dvh] overflow-hidden">
          {carouselImages.map((src, idx) => (
            <div
              key={idx}
              className="absolute inset-0 transition-opacity duration-1000"
              style={{ opacity: idx === carouselIndex ? 1 : 0 }}
            >
              <Image src={src} alt="" fill className="object-cover" priority={idx === 0} sizes="100vw" />
            </div>
          ))}
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-black/80" />

          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 z-10 px-5 pt-14 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {logoUrl ? (
                <img src={logoUrl} alt={companyName} className="h-8 w-auto object-contain" />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
              )}
              <span className="text-white font-bold text-base drop-shadow">{companyName}</span>
            </div>
            <Link href="/auth/login">
              <motion.button
                whileTap={{ scale: 0.95 }}
                className="bg-white/20 backdrop-blur-md border border-white/40 text-white text-xs font-semibold px-4 py-2 rounded-full"
              >
                Sign In
              </motion.button>
            </Link>
          </div>

          {/* Hero text + dots */}
          <div className="absolute inset-0 flex flex-col justify-end px-5 pb-14">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <p className="text-white/70 text-sm font-medium mb-2">Welcome to {companyName}</p>
              <h1 className="text-white text-4xl font-black leading-[1.1] tracking-tight">{heroTitle}</h1>
              <h1 className="text-accent text-4xl font-black leading-[1.1] tracking-tight mb-4">{heroTitleLine2}</h1>
              {hero.subtitle && (
                <p className="text-white/60 text-sm max-w-xs leading-relaxed mb-4">{hero.subtitle}</p>
              )}
            </motion.div>
            <div className="flex gap-2">
              {carouselImages.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => { setCarouselIndex(idx); startCarousel(); }}
                  className={`transition-all duration-300 rounded-full h-1.5 ${
                    idx === carouselIndex ? 'bg-white w-7' : 'bg-white/40 w-2'
                  }`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ── SEARCH CARD ──────────────────────────────────────────────────── */}
        <div className="relative z-10 -mt-8 mx-4 mb-7">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-4"
          >
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Quick Search</p>
            <div className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3 mb-3">
              <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
              <input
                type="text"
                placeholder="Where are you looking?"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleMobileSearch()}
                className="flex-1 bg-transparent text-sm text-gray-800 dark:text-white placeholder-gray-400 outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSearchSheetOpen(true)}
                className="flex items-center justify-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-2.5 flex-1"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filters
              </button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleMobileSearch}
                className="flex items-center justify-center gap-2 bg-primary text-white text-sm font-bold px-5 py-2.5 rounded-2xl flex-1"
              >
                <Search className="w-4 h-4" />
                Search
              </motion.button>
            </div>
          </motion.div>
        </div>

        {/* ── CATEGORIES ───────────────────────────────────────────────────── */}
        <section className="px-4 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Browse by Type</h2>
            <Link href="/properties" className="text-xs text-primary font-semibold">See All</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto [&::-webkit-scrollbar]:hidden pb-1">
            {PROPERTY_CATEGORIES.map(cat => (
              <motion.button
                key={cat.value}
                whileTap={{ scale: 0.93 }}
                onClick={() => {
                  setActiveCategory(cat.value);
                  router.push(cat.value ? `/properties?type=${cat.value}` : '/properties');
                }}
                className={`flex-none flex flex-col items-center gap-1.5 px-5 py-3 rounded-2xl transition-all ${
                  activeCategory === cat.value
                    ? 'bg-primary text-white shadow-lg shadow-primary/25'
                    : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 shadow-sm border border-gray-100 dark:border-gray-800'
                }`}
              >
                <span className="text-xl leading-none">{cat.emoji}</span>
                <span className="text-[11px] font-bold whitespace-nowrap">{cat.label}</span>
              </motion.button>
            ))}
          </div>
        </section>

        {/* ── FEATURED PROPERTIES ──────────────────────────────────────────── */}
        <section className="mb-10">
          <div className="px-4 flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Featured Listings</h2>
              {totalCount > 0 && <p className="text-[11px] text-gray-400 mt-0.5">{totalCount} properties available</p>}
            </div>
            <Link href="/properties" className="text-xs font-semibold text-primary flex items-center gap-0.5">
              See All <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="flex gap-4 px-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex-none w-[230px] h-[280px] bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : filteredProperties.length === 0 ? (
            <div className="mx-4 bg-white dark:bg-gray-900 rounded-2xl p-8 text-center shadow-sm">
              <Building2 className="w-10 h-10 mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-400">No properties listed yet</p>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto [&::-webkit-scrollbar]:hidden snap-x snap-mandatory px-4 pb-2">
              {filteredProperties.map((property: any, idx: number) => {
                const TypeIcon = getTypeIcon(property.type);
                const imgSrc = property.images?.[0]
                  ? (property.images[0].startsWith('http') ? property.images[0] : getImageUrl(property.images[0]))
                  : null;
                return (
                  <motion.div
                    key={property.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex-none w-[230px] snap-start"
                  >
                    <Link href={`/properties/${property.id}`}>
                      <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-md active:scale-[0.98] transition-transform border border-gray-100 dark:border-gray-800">
                        <div className="relative h-[155px]">
                          {imgSrc ? (
                            <Image src={imgSrc} alt={property.title} fill className="object-cover" sizes="230px" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/30 flex items-center justify-center">
                              <TypeIcon className="w-12 h-12 text-primary/30" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />
                          <span className="absolute top-2.5 left-2.5 bg-white/90 backdrop-blur-sm text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded-lg">
                            For Sale
                          </span>
                          <button className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center">
                            <Heart className="w-3.5 h-3.5 text-gray-400" />
                          </button>
                          <div className="absolute bottom-2.5 left-3">
                            <span className="text-white font-black text-sm">{formatPriceMobile(property.price)}</span>
                          </div>
                        </div>
                        <div className="p-3">
                          <p className="font-bold text-xs text-gray-900 dark:text-white line-clamp-1 mb-1">{property.title}</p>
                          <p className="text-[11px] text-gray-400 flex items-center gap-1 mb-2.5">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            {[property.city, property.state].filter(Boolean).join(', ') || 'Location TBD'}
                          </p>
                          <div className="flex items-center gap-3 text-[11px] text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-800">
                            {property.bedrooms != null && <span className="flex items-center gap-1"><Bed className="w-3 h-3" />{property.bedrooms} bd</span>}
                            {property.bathrooms != null && <span className="flex items-center gap-1"><Bath className="w-3 h-3" />{property.bathrooms} ba</span>}
                            {property.area != null && <span className="flex items-center gap-1"><Maximize2 className="w-3 h-3" />{Number(property.area).toLocaleString()}</span>}
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
              <div className="flex-none w-[120px] snap-start flex items-center justify-center">
                <Link href="/properties">
                  <div className="flex flex-col items-center gap-2 text-primary">
                    <div className="w-12 h-12 rounded-full border-2 border-primary/30 flex items-center justify-center">
                      <ArrowRight className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold">View All</span>
                  </div>
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* ── EVENTS ───────────────────────────────────────────────────────── */}
        {displayEvents.length > 0 && (
          <section className="mb-10">
            <div className="px-4 mb-4">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Upcoming Events</h2>
            </div>
            <div className="flex gap-4 overflow-x-auto [&::-webkit-scrollbar]:hidden snap-x snap-mandatory px-4 pb-2">
              {displayEvents.map((ev, idx) => (
                <motion.div
                  key={ev.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex-none w-[210px] snap-start"
                >
                  <Link href={`/event/${ev.slug}`}>
                    <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-md border border-gray-100 dark:border-gray-800">
                      <div className="relative h-[120px]">
                        {ev.bannerUrl ? (
                          <Image src={ev.bannerUrl} alt={ev.title} fill className="object-cover" sizes="210px" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary/15 to-accent/20 flex items-center justify-center">
                            <Calendar className="w-10 h-10 text-primary/30" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        {ev.isFeatured && (
                          <span className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 text-[10px] font-black px-2 py-0.5 rounded-md">Featured</span>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="font-bold text-xs text-gray-900 dark:text-white line-clamp-2 mb-2 leading-snug">{ev.title}</p>
                        <p className="text-[11px] text-gray-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-primary flex-shrink-0" />
                          {new Date(ev.eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* ── AGENTS ───────────────────────────────────────────────────────── */}
        {agents.agents && agents.agents.length > 0 && (
          <section className="mb-10">
            <div className="px-4 mb-4">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Top Realtors</h2>
            </div>
            <div className="flex gap-5 overflow-x-auto [&::-webkit-scrollbar]:hidden px-4 pb-2">
              {agents.agents.map((agent: any, idx: number) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.06 }}
                  className="flex-none flex flex-col items-center gap-2 w-[72px]"
                >
                  <div className="relative">
                    <div className="w-[58px] h-[58px] rounded-full overflow-hidden border-2 border-primary/20">
                      {agent.image ? (
                        <Image
                          src={agent.image.startsWith('http') ? agent.image : getImageUrl(agent.image)}
                          alt={agent.name} width={58} height={58} className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                          <User className="w-6 h-6 text-primary/50" />
                        </div>
                      )}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-400 rounded-full border-2 border-white dark:border-gray-950" />
                  </div>
                  <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 text-center line-clamp-1 w-full">{agent.name}</p>
                  <div className="flex items-center gap-0.5">
                    {[...Array(Math.min(5, Number(agent.rating) || 5))].map((_, i) => (
                      <Star key={i} className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* ── WHY CHOOSE US ────────────────────────────────────────────────── */}
        {features.features && features.features.length > 0 && (
          <section className="px-4 mb-10">
            <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-4">
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Why Choose Us</p>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">What Makes Us Different</h2>
            </motion.div>
            <div className="space-y-4">
              {features.features.slice(0, 3).map((feature: any, idx: number) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800 flex"
                >
                  {feature.image && (
                    <div className="relative w-[100px] flex-shrink-0 overflow-hidden">
                      <Image
                        src={feature.image.startsWith('http') ? feature.image : getImageUrl(feature.image)}
                        alt={feature.title} fill className="object-cover"
                      />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-bold text-xs text-gray-900 dark:text-white mb-1">{feature.title}</h3>
                    <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2">{feature.description}</p>
                    <Link href="/features" className="text-primary text-[11px] font-bold flex items-center gap-1 mt-2">
                      Read More <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* ── PLATFORM ─────────────────────────────────────────────────────── */}
        {platformFeatures.features && platformFeatures.features.length > 0 && (
          <section className="mx-4 mb-10 rounded-3xl overflow-hidden relative bg-primary-900 p-5">
            <div className="absolute top-0 right-0 w-36 h-36 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-28 h-28 bg-accent/10 rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />
            <div className="relative z-10">
              <p className="text-accent text-[10px] font-bold uppercase tracking-widest mb-1">Platform</p>
              <h2 className="text-white font-bold text-sm mb-4">Everything You Need</h2>
              <div className="grid grid-cols-2 gap-3">
                {platformFeatures.features.slice(0, 4).map((feature: any, idx: number) => {
                  const FIcon = ICON_MAP[feature.icon] || Zap;
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: idx * 0.08 }}
                      className="bg-white/10 border border-white/15 rounded-2xl p-3"
                    >
                      <div className="w-8 h-8 rounded-xl bg-accent/20 flex items-center justify-center mb-2">
                        <FIcon className="w-4 h-4 text-accent" />
                      </div>
                      <p className="text-white font-bold text-[11px] mb-1">{feature.title}</p>
                      <p className="text-white/50 text-[10px] leading-relaxed line-clamp-2">{feature.description}</p>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ── ABOUT ────────────────────────────────────────────────────────── */}
        {(about.title || about.content) && (
          <section className="px-4 mb-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-white dark:bg-gray-900 rounded-3xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800"
            >
              {about.image && (
                <div className="relative h-[180px]">
                  <Image
                    src={about.image.startsWith('http') ? about.image : getImageUrl(about.image)}
                    alt="About" fill className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                </div>
              )}
              <div className="p-5">
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">{about.subtitle || 'About Us'}</p>
                {about.title && <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-2">{about.title}</h2>}
                {about.content && (
                  <p className="text-[11px] text-gray-400 leading-relaxed mb-3 line-clamp-3">
                    {about.content.replace(/<[^>]+>/g, '').trim()}
                  </p>
                )}
                {about.items && about.items.length > 0 && (
                  <div className="space-y-1.5 mb-4">
                    {about.items.slice(0, 3).map((item: any, i: number) => (
                      <div key={i} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        <span className="text-[11px] text-gray-600 dark:text-gray-300">
                          {item.text || item.title || (typeof item === 'string' ? item : '')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <Link href="/about">
                  <motion.button whileTap={{ scale: 0.97 }} className="bg-primary text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2">
                    Learn More <ArrowRight className="w-3.5 h-3.5" />
                  </motion.button>
                </Link>
              </div>
            </motion.div>
          </section>
        )}

        {/* ── STATS ────────────────────────────────────────────────────────── */}
        {stats.stats && stats.stats.length > 0 && (
          <section className="px-4 mb-10">
            <div className="grid grid-cols-2 gap-3">
              {stats.stats.slice(0, 4).map((stat: any, idx: number) => {
                const StatIcon = ICON_MAP[stat.icon] || [Building2, TrendingUp, Users, Star][idx % 4];
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.07 }}
                    className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800"
                  >
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                      <StatIcon className="w-4 h-4 text-primary" />
                    </div>
                    <p className="text-2xl font-black text-gray-900 dark:text-white leading-none">{stat.value}</p>
                    <p className="text-[11px] text-gray-400 mt-1">{stat.label}</p>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── CONTACT ──────────────────────────────────────────────────────── */}
        {(contact.phone || contact.email || contact.address) && (
          <section className="px-4 mb-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-white dark:bg-gray-900 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-800"
            >
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Get In Touch</p>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Contact Us</h2>
              <div className="space-y-3 mb-4">
                {[
                  contact.phone && { Icon: Phone, label: 'Phone', value: contact.phone },
                  contact.email && { Icon: Mail, label: 'Email', value: contact.email },
                  contact.address && { Icon: MapPin, label: 'Address', value: contact.address },
                  contact.hours && { Icon: Clock, label: 'Hours', value: contact.hours },
                ].filter(Boolean).map((item: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <item.Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400">{item.label}</p>
                      <p className="text-xs font-semibold text-gray-900 dark:text-white">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/contact">
                <motion.button whileTap={{ scale: 0.97 }} className="w-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                  Send Us a Message <ArrowRight className="w-3.5 h-3.5" />
                </motion.button>
              </Link>
            </motion.div>
          </section>
        )}

        {/* ── CTA ──────────────────────────────────────────────────────────── */}
        <section className="px-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 p-6 text-center"
          >
            <div className="absolute top-0 right-0 w-44 h-44 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-accent/10 rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />
            <div className="relative z-10">
              <h2 className="text-white font-black text-lg mb-2">{cta.title || 'Ready to Get Started?'}</h2>
              <p className="text-white/60 text-xs mb-5 max-w-xs mx-auto">
                {cta.subtitle || `Find your perfect property with ${companyName} today.`}
              </p>
              <div className="flex gap-3">
                <Link href={cta.primaryButtonLink || '/auth/register'} className="flex-1">
                  <button className="w-full bg-accent text-white font-bold text-sm py-3.5 rounded-2xl">
                    {cta.primaryButtonText || 'Get Started'}
                  </button>
                </Link>
                <Link href={cta.secondaryButtonLink || '/contact'} className="flex-1">
                  <button className="w-full border border-white/30 text-white font-bold text-sm py-3.5 rounded-2xl">
                    {cta.secondaryButtonText || 'Contact Us'}
                  </button>
                </Link>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Quick links */}
        <div className="px-4 pb-3 flex flex-wrap gap-x-5 gap-y-2 justify-center">
          {[
            { label: 'About', href: '/about' },
            { label: 'Properties', href: '/properties' },
            { label: 'Features', href: '/features' },
            { label: 'Gallery', href: '/gallery' },
            { label: 'Contact', href: '/contact' },
            { label: 'Register', href: '/auth/register' },
          ].map(link => (
            <Link key={link.href} href={link.href} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              {link.label}
            </Link>
          ))}
        </div>
        <p className="text-center text-[11px] text-gray-300 dark:text-gray-600 pb-4">
          © {new Date().getFullYear()} {companyName}
        </p>

        {/* Bottom spacer */}
        <div className="h-28" />

        {/* ── BOTTOM NAVIGATION ──────────────────────────────────────────── */}
        <div className="fixed bottom-4 left-0 right-0 z-50 flex justify-center px-4">
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, type: 'spring', stiffness: 280, damping: 28 }}
            className="bg-white/85 dark:bg-gray-900/85 backdrop-blur-xl border border-white/30 dark:border-gray-700/50 rounded-[28px] shadow-2xl px-2 py-1.5 w-full max-w-[380px]"
          >
            <div className="flex items-center justify-around">
              {MOBILE_NAV.map(item => {
                const isActive = item.id === activeNavTab;
                const { Icon } = item;
                return (
                  <motion.button
                    key={item.id}
                    whileTap={{ scale: 0.88 }}
                    onClick={() => handleNavTab(item)}
                    className={`relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl transition-colors ${isActive ? 'bg-primary/10' : ''}`}
                  >
                    <Icon className={`w-5 h-5 transition-colors ${isActive ? 'text-primary' : 'text-gray-400 dark:text-gray-500'}`} />
                    <span className={`text-[10px] font-bold transition-colors ${isActive ? 'text-primary' : 'text-gray-400 dark:text-gray-500'}`}>
                      {item.label}
                    </span>
                    {isActive && (
                      <motion.div layoutId="nav-indicator" className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* ── SEARCH BOTTOM SHEET ────────────────────────────────────────── */}
        <AnimatePresence>
          {searchSheetOpen && (
            <>
              <motion.div
                key="search-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-50"
                onClick={() => setSearchSheetOpen(false)}
              />
              <motion.div
                key="search-sheet"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 rounded-t-[32px] px-5 pt-4 pb-10 max-h-[92dvh] overflow-y-auto"
              >
                <div className="w-10 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-5" />
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-base font-black text-gray-900 dark:text-white">Search Properties</h2>
                  <button
                    onClick={() => setSearchSheetOpen(false)}
                    className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  </button>
                </div>
                <div className="mb-5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Location</label>
                  <div className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3">
                    <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                    <input
                      type="text"
                      placeholder="City, area, or landmark"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="flex-1 bg-transparent text-sm text-gray-800 dark:text-white placeholder-gray-400 outline-none"
                      autoFocus
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')}><X className="w-4 h-4 text-gray-400" /></button>
                    )}
                  </div>
                </div>
                <div className="mb-5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 block">Property Type</label>
                  <div className="flex gap-2 flex-wrap">
                    {PROPERTY_CATEGORIES.map(cat => (
                      <motion.button
                        key={cat.value}
                        whileTap={{ scale: 0.93 }}
                        onClick={() => setSearchType(cat.value)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                          searchType === cat.value
                            ? 'bg-primary text-white shadow-md shadow-primary/25'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        <span>{cat.emoji}</span>{cat.label}
                      </motion.button>
                    ))}
                  </div>
                </div>
                <div className="mb-8">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 block">Price Range</label>
                  <div className="flex gap-2 flex-wrap">
                    {PRICE_RANGES.map(range => (
                      <motion.button
                        key={range.value}
                        whileTap={{ scale: 0.93 }}
                        onClick={() => setSearchPrice(range.value)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                          searchPrice === range.value
                            ? 'bg-primary text-white shadow-md shadow-primary/25'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        {range.label}
                      </motion.button>
                    ))}
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleMobileSearch}
                  className="w-full bg-primary text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 text-sm"
                >
                  <Search className="w-4 h-4" />
                  Search Properties
                </motion.button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          DESKTOP / TABLET UI  —  screens md and above (≥ 768 px)
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="hidden md:block min-h-dvh bg-white dark:bg-gray-950">
        <PublicNavbar currentPage="/" />

        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <section className="pt-16 bg-white dark:bg-gray-950">
          <div className="px-3 sm:px-6 lg:px-8 pt-4 pb-0">
            <div className="relative w-full overflow-hidden rounded-xl sm:rounded-2xl min-h-[580px] sm:min-h-[540px] md:min-h-[560px]">
              {carouselImages.map((src, idx) => (
                <div
                  key={idx}
                  className="absolute inset-0 transition-opacity duration-1000"
                  style={{ opacity: idx === carouselIndex ? 1 : 0 }}
                >
                  <Image src={src} alt={`Hero slide ${idx + 1}`} fill className="object-cover" priority={idx === 0} />
                </div>
              ))}
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/50 to-black/90" />
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
              <div className="relative z-10 flex flex-col items-center justify-end pb-7 sm:pb-10 px-4 text-center min-h-[580px] sm:min-h-[540px] md:min-h-[560px]">
                <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight drop-shadow-lg">
                  {heroTitle}
                </h1>
                <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-5 sm:mb-8 drop-shadow-lg">
                  {heroTitleLine2}
                </h1>
                {/* Search bar */}
                <div className="w-full max-w-2xl bg-white rounded-xl sm:rounded-2xl shadow-2xl overflow-visible">
                  <div className="grid grid-cols-2 sm:flex">
                    {/* Type */}
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
                    {/* Price */}
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
                          {PRICE_RANGES_DESKTOP.map(r => (
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
                    {/* Area */}
                    <div className="sm:flex-1 min-w-0 px-3 sm:px-5 py-3 sm:py-4 sm:border-r border-gray-200">
                      <p className="text-[10px] sm:text-xs text-gray-400 leading-none mb-0.5">Area</p>
                      <input
                        type="text"
                        placeholder="City or area"
                        value={searchLocation}
                        onChange={e => setSearchLocation(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleDesktopSearch()}
                        className="w-full text-xs sm:text-sm font-semibold text-gray-800 placeholder-gray-400 outline-none bg-transparent"
                      />
                    </div>
                    {/* Search button */}
                    <button
                      onClick={handleDesktopSearch}
                      className="flex items-center justify-center gap-2 bg-primary hover:bg-primary-800 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-br-xl sm:rounded-br-2xl rounded-bl-xl sm:rounded-bl-none sm:rounded-tr-2xl font-semibold text-xs sm:text-sm transition-colors"
                    >
                      <Search className="w-4 h-4" />
                      Search
                    </button>
                  </div>
                </div>
                {/* Dots */}
                <div className="flex gap-2 mt-4 sm:mt-5">
                  {carouselImages.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => { setCarouselIndex(idx); startCarousel(); }}
                      className={`transition-all duration-300 rounded-full ${
                        idx === carouselIndex ? 'bg-white w-5 sm:w-6 h-2 sm:h-2.5' : 'bg-white/50 hover:bg-white/75 w-2 sm:w-2.5 h-2 sm:h-2.5'
                      }`}
                      aria-label={`Go to slide ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── PROPERTIES ───────────────────────────────────────────────────── */}
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
                        <Link href={`/properties/${property.id}`} className="block relative flex-shrink-0 overflow-hidden" style={{ height: '200px' }}>
                          {property.images && property.images.length > 0 ? (
                            <Image
                              src={property.images[0].startsWith('http') ? property.images[0] : getImageUrl(property.images[0])}
                              alt={property.title} fill className="object-cover hover:scale-105 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                              <TypeIcon className="w-14 h-14 text-primary-300" />
                            </div>
                          )}
                          <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-md shadow-sm">
                            For Sale
                          </span>
                        </Link>
                        <div className="p-5 flex flex-col flex-1">
                          <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1.5">
                            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="line-clamp-1">{[property.city, property.state].filter(Boolean).join(', ')}</span>
                          </div>
                          <Link href={`/properties/${property.id}`}>
                            <h3 className="font-bold text-gray-900 dark:text-white text-base mb-3 leading-snug hover:text-primary transition-colors line-clamp-1">
                              {property.title}
                            </h3>
                          </Link>
                          <div className="flex items-center text-gray-400 text-xs mb-4 pb-4 border-b border-gray-100 dark:border-gray-800">
                            {beds != null && <div className="flex items-center gap-1.5 flex-shrink-0"><Bed className="w-3.5 h-3.5" /><span>{beds} Bed Room</span></div>}
                            {beds != null && (baths != null || sqft != null) && <div className="w-px h-3 bg-gray-200 dark:bg-gray-700 mx-3 flex-shrink-0" />}
                            {baths != null && <div className="flex items-center gap-1.5 flex-shrink-0"><Bath className="w-3.5 h-3.5" /><span>{baths} Bath</span></div>}
                            {baths != null && sqft != null && <div className="w-px h-3 bg-gray-200 dark:bg-gray-700 mx-3 flex-shrink-0" />}
                            {sqft != null && <div className="flex items-center gap-1.5 flex-shrink-0"><Maximize2 className="w-3.5 h-3.5" /><span>{Number(sqft).toLocaleString()} SQ FT</span></div>}
                          </div>
                          <div className="flex items-center justify-between mt-auto">
                            <span className="text-lg font-bold text-gray-900 dark:text-white">{formatPrice(property.price)}</span>
                            <Link href={`/properties/${property.id}`}>
                              <button className="flex items-center gap-1.5 bg-primary hover:bg-primary-800 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors">
                                View Details <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-10">
                    <button disabled={page <= 1} onClick={() => handlePageChange(page - 1)} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      <ChevronLeft className="w-4 h-4 text-gray-600" />
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                      const pageNum = start + i;
                      if (pageNum > totalPages) return null;
                      return (
                        <button key={pageNum} onClick={() => handlePageChange(pageNum)} className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${pageNum === page ? 'bg-primary text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                          {pageNum}
                        </button>
                      );
                    })}
                    <button disabled={page >= totalPages} onClick={() => handlePageChange(page + 1)} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      <ChevronRight className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* ── EVENTS ───────────────────────────────────────────────────────── */}
        {displayEvents.length > 0 && (
          <section className="py-14 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900">
            <div className="max-w-screen-xl mx-auto">
              <div className="mb-8">
                <p className="text-primary font-semibold text-xs uppercase tracking-wider mb-1">Events</p>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Upcoming Events</h2>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayEvents.slice(0, 3).map((ev) => {
                  const spotsLeft = ev.maxAttendees ? ev.maxAttendees - (ev._count?.registrations ?? 0) : null;
                  return (
                    <Link key={ev.id} href={`/event/${ev.slug}`} className="group">
                      <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300 border border-gray-100 dark:border-gray-700 flex flex-col h-full">
                        {ev.bannerUrl ? (
                          <div className="relative h-44 flex-shrink-0 overflow-hidden">
                            <Image src={ev.bannerUrl} alt={ev.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                            {ev.isFeatured && <span className="absolute top-3 left-3 bg-yellow-400 text-yellow-900 text-xs font-semibold px-2.5 py-1 rounded-md">Featured</span>}
                          </div>
                        ) : (
                          <div className="h-44 bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center flex-shrink-0">
                            <Calendar className="w-14 h-14 text-primary-300" />
                          </div>
                        )}
                        <div className="p-5 flex flex-col gap-3 flex-1">
                          <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-primary transition-colors line-clamp-2 leading-snug">{ev.title}</h3>
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

        {/* ── AGENTS ───────────────────────────────────────────────────────── */}
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

        {/* ── FEATURES ─────────────────────────────────────────────────────── */}
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
                          <Image src={feature.image?.startsWith('http') ? feature.image : getImageUrl(feature.image || '')} alt={feature.title} fill className="object-cover" />
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

        {/* ── PLATFORM ─────────────────────────────────────────────────────── */}
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

        {/* ── ABOUT ────────────────────────────────────────────────────────── */}
        {(about.title || about.content) && (
          <section className="py-14 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-950">
            <div className="max-w-screen-xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <p className="text-primary font-semibold text-xs uppercase tracking-wider mb-2">{about.subtitle || 'About Us'}</p>
                {about.title && <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-5 leading-tight">{about.title}</h2>}
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
                  <Image src={about.image?.startsWith('http') ? about.image : getImageUrl(about.image)} alt="About us" fill className="object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                    <Building2 className="w-20 h-20 text-primary-300" />
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── STATS ────────────────────────────────────────────────────────── */}
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

        {/* ── CTA ──────────────────────────────────────────────────────────── */}
        <section className="py-14 px-4 sm:px-6 lg:px-8 bg-primary-900">
          <div className="max-w-screen-xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
              {cta.title || `Ready to Get Started with ${cmsCompanyName}?`}
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

        {/* ── CONTACT ──────────────────────────────────────────────────────── */}
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
    </>
  );
}
