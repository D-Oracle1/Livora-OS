'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Building2,
  Search,
  MapPin,
  Home,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LandPlot,
  Loader2,
  BarChart3,
  X,
  ArrowRight,
} from 'lucide-react';
import { api, getImageUrl } from '@/lib/api';
import { PublicNavbar } from '@/components/layout/public-navbar';
import { PublicFooter } from '@/components/layout/public-footer';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').trim();

const PROPERTY_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'RESIDENTIAL', label: 'Residential' },
  { value: 'COMMERCIAL', label: 'Commercial' },
  { value: 'LAND', label: 'Land' },
  { value: 'APARTMENT', label: 'Apartment' },
  { value: 'VILLA', label: 'Villa' },
  { value: 'CONDO', label: 'Condo' },
  { value: 'TOWNHOUSE', label: 'Townhouse' },
  { value: 'INDUSTRIAL', label: 'Industrial' },
  { value: 'MIXED_USE', label: 'Mixed Use' },
];

const PRICE_RANGES = [
  { value: '', label: 'Any Price', min: undefined, max: undefined },
  { value: '0-50', label: 'Under ₦50M', min: 0, max: 50000000 },
  { value: '50-100', label: '₦50M - ₦100M', min: 50000000, max: 100000000 },
  { value: '100-500', label: '₦100M - ₦500M', min: 100000000, max: 500000000 },
  { value: '500-1000', label: '₦500M - ₦1B', min: 500000000, max: 1000000000 },
  { value: '1000+', label: 'Above ₦1B', min: 1000000000, max: undefined },
];

function getTypeIcon(type: string) {
  switch (type) {
    case 'LAND': return LandPlot;
    case 'COMMERCIAL': case 'INDUSTRIAL': return Building2;
    default: return Home;
  }
}

export default function PropertiesPage() {
  const [searchLocation, setSearchLocation] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [priceRange, setPriceRange] = useState('');
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showPriceDropdown, setShowPriceDropdown] = useState(false);

  const fetchProperties = useCallback(async (currentPage = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(currentPage));
      params.append('limit', '12');
      if (searchLocation) params.append('search', searchLocation);
      if (propertyType) params.append('type', propertyType);
      const range = PRICE_RANGES.find(r => r.value === priceRange);
      if (range?.min !== undefined) params.append('minPrice', String(range.min));
      if (range?.max !== undefined) params.append('maxPrice', String(range.max));

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
  }, [searchLocation, propertyType, priceRange]);

  useEffect(() => {
    fetchProperties(1);
  }, [fetchProperties]);

  const handleSearch = () => {
    setPage(1);
    fetchProperties(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchProperties(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearFilters = () => {
    setSearchLocation('');
    setPropertyType('');
    setPriceRange('');
    setPage(1);
  };

  const hasFilters = searchLocation || propertyType || priceRange;
  const selectedTypeLabel = PROPERTY_TYPES.find(t => t.value === propertyType)?.label || 'All Types';
  const selectedPriceLabel = PRICE_RANGES.find(r => r.value === priceRange)?.label || 'Any Price';

  return (
    <div className="min-h-screen bg-white dark:bg-primary-950">
      <PublicNavbar currentPage="/properties" />

      {/* Hero */}
      <section className="bg-gradient-to-r from-primary via-primary-600 to-primary pt-28 pb-12 px-4">
        <div className="container mx-auto text-center">
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">Browse Properties</h1>
          <p className="text-white/80 text-lg max-w-2xl mx-auto">
            Discover your perfect property from our curated selection of premium real estate
          </p>
        </div>
      </section>

      {/* Search & Filters */}
      <section className="sticky top-16 z-40 bg-white dark:bg-primary-950 border-b border-gray-200 dark:border-primary-800 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="bg-gray-50 dark:bg-primary-900 rounded-2xl p-2">
            <div className="flex flex-col md:flex-row gap-2">
              <div className="flex-1 flex items-center gap-3 px-4 py-3 border-b md:border-b-0 md:border-r border-gray-200 dark:border-primary-700">
                <MapPin className="w-5 h-5 text-accent" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500 font-medium">Location</p>
                  <input
                    type="text"
                    placeholder="Enter city or area"
                    value={searchLocation}
                    onChange={(e) => setSearchLocation(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="w-full text-sm text-gray-800 dark:text-white bg-transparent outline-none placeholder:text-gray-400"
                  />
                </div>
              </div>
              <div className="flex-1 flex items-center gap-3 px-4 py-3 border-b md:border-b-0 md:border-r border-gray-200 dark:border-primary-700 relative">
                <Home className="w-5 h-5 text-accent" />
                <div className="flex-1 cursor-pointer" onClick={() => { setShowTypeDropdown(!showTypeDropdown); setShowPriceDropdown(false); }}>
                  <p className="text-xs text-gray-500 font-medium">Property Type</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-800 dark:text-white">{selectedTypeLabel}</span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
                {showTypeDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-primary-800 rounded-xl shadow-lg border border-gray-200 dark:border-primary-700 z-50 max-h-60 overflow-y-auto">
                    {PROPERTY_TYPES.map((t) => (
                      <button
                        key={t.value}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-accent/10 transition-colors ${propertyType === t.value ? 'text-accent font-medium bg-accent/5' : 'text-gray-700 dark:text-gray-300'}`}
                        onClick={() => { setPropertyType(t.value); setShowTypeDropdown(false); }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-1 flex items-center gap-3 px-4 py-3 relative">
                <BarChart3 className="w-5 h-5 text-accent" />
                <div className="flex-1 cursor-pointer" onClick={() => { setShowPriceDropdown(!showPriceDropdown); setShowTypeDropdown(false); }}>
                  <p className="text-xs text-gray-500 font-medium">Price Range</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-800 dark:text-white">{selectedPriceLabel}</span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
                {showPriceDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-primary-800 rounded-xl shadow-lg border border-gray-200 dark:border-primary-700 z-50">
                    {PRICE_RANGES.map((r) => (
                      <button
                        key={r.value}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-accent/10 transition-colors ${priceRange === r.value ? 'text-accent font-medium bg-accent/5' : 'text-gray-700 dark:text-gray-300'}`}
                        onClick={() => { setPriceRange(r.value); setShowPriceDropdown(false); }}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button onClick={handleSearch} className="bg-accent hover:bg-accent-600 text-white px-6 py-6 rounded-xl">
                <Search className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Active Filters */}
          {hasFilters && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-sm text-gray-500">Filters:</span>
              {searchLocation && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-accent/10 text-accent text-sm rounded-full">
                  {searchLocation}
                  <button onClick={() => setSearchLocation('')}><X className="w-3 h-3" /></button>
                </span>
              )}
              {propertyType && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-accent/10 text-accent text-sm rounded-full">
                  {selectedTypeLabel}
                  <button onClick={() => setPropertyType('')}><X className="w-3 h-3" /></button>
                </span>
              )}
              {priceRange && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-accent/10 text-accent text-sm rounded-full">
                  {selectedPriceLabel}
                  <button onClick={() => setPriceRange('')}><X className="w-3 h-3" /></button>
                </span>
              )}
              <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-accent ml-2">Clear all</button>
            </div>
          )}
        </div>
      </section>

      {/* Results */}
      <section className="py-12 px-4">
        <div className="container mx-auto">
          <div className="flex items-center justify-between mb-8">
            <p className="text-gray-600 dark:text-gray-400">
              {loading ? 'Searching...' : `${totalCount} properties found`}
            </p>
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
              <p className="text-gray-500 dark:text-gray-400 mb-6">Try adjusting your search filters or check back later.</p>
              {hasFilters && (
                <Button onClick={clearFilters} variant="outline">Clear Filters</Button>
              )}
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {properties.map((property: any) => {
                  const TypeIcon = getTypeIcon(property.type);
                  return (
                    <Link key={property.id} href={`/properties/${property.id}`} className="group">
                      <div className="bg-white dark:bg-primary-900 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-primary-800">
                        <div className="relative h-52 overflow-hidden">
                          {property.images && property.images.length > 0 ? (
                            <img
                              src={getImageUrl(property.images[0])}
                              alt={property.title}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
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

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-10">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => handlePageChange(page - 1)}
                    className="border-gray-300"
                  >
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
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => handlePageChange(page + 1)}
                    className="border-gray-300"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 bg-gradient-to-r from-primary via-primary-600 to-primary">
        <div className="container mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4 text-white">
            Can&apos;t Find What You&apos;re Looking For?
          </h2>
          <p className="text-white/80 max-w-xl mx-auto mb-6">
            Contact our agents for personalized property recommendations
          </p>
          <Link href="/contact">
            <Button size="lg" className="bg-accent hover:bg-accent-600 text-white shadow-accent">
              Contact Us
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
