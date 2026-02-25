'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Building2,
  MapPin,
  BedDouble,
  Bath,
  Maximize,
  Calendar,
  ArrowLeft,
  Phone,
  User,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Home,
} from 'lucide-react';

import { PublicNavbar } from '@/components/layout/public-navbar';
import { PublicFooter } from '@/components/layout/public-footer';
import { useBranding, getCompanyName } from '@/hooks/use-branding';
import { getToken } from '@/lib/auth-storage';
import { getImageUrl } from '@/lib/api';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').trim();

function formatPrice(price: number): string {
  if (price >= 1000000000) return `₦${(price / 1000000000).toFixed(2)}B`;
  if (price >= 1000000) return `₦${(price / 1000000).toFixed(1)}M`;
  return `₦${price.toLocaleString()}`;
}

function resolveImageSrc(src: string): string {
  if (!src) return '';
  return src.startsWith('http') ? src : getImageUrl(src);
}

export default function PropertyDetailPage() {
  const params = useParams();
  const branding = useBranding();
  const companyName = getCompanyName(branding);
  const [property, setProperty] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    async function fetchProperty() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/properties/listed/${params.id}`);
        if (!res.ok) throw new Error('Property not found');
        const data = await res.json();
        setProperty(data);
      } catch {
        setError('Property not found or no longer listed.');
      } finally {
        setLoading(false);
      }
    }
    if (params.id) fetchProperty();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <Building2 className="w-16 h-16 text-gray-300 mb-4" />
        <h1 className="text-2xl font-bold text-gray-700 mb-2">Property Not Found</h1>
        <p className="text-gray-500 mb-6">{error}</p>
        <Link href="/#properties">
          <Button className="bg-accent hover:bg-accent-600 text-white">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Properties
          </Button>
        </Link>
      </div>
    );
  }

  const images = property.images || [];
  const realtorName = property.realtor
    ? `${property.realtor.user.firstName} ${property.realtor.user.lastName}`
    : `${companyName} Agent`;

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicNavbar />

      {/* Breadcrumb */}
      <div className="bg-white border-b pt-16">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
            <Link href="/" className="hover:text-accent transition-colors">Home</Link>
            <span>/</span>
            <Link href="/properties" className="hover:text-accent transition-colors">Properties</Link>
            <span>/</span>
            <span className="text-gray-900 font-medium line-clamp-1">{property.title}</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Right Column — Price & Agent (shows FIRST on mobile) */}
          <div className="lg:col-span-1 lg:order-2">
            <div className="bg-white rounded-2xl p-6 shadow-lg lg:sticky lg:top-24">
              <div className="text-sm text-gray-500 mb-1">Listed Price</div>
              <div className="text-3xl font-bold text-primary mb-1">
                {formatPrice(Number(property.price))}
              </div>
              {property.pricePerSqm && (
                <div className="text-sm text-gray-500 mb-4">
                  {formatPrice(Number(property.pricePerSqm))} / plot
                </div>
              )}

              {/* Agent Card */}
              <div className="border-t border-gray-100 pt-4 mt-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {property.realtor?.user?.avatar ? (
                      <Image
                        src={resolveImageSrc(property.realtor.user.avatar)}
                        alt={realtorName}
                        width={48}
                        height={48}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <User className="w-6 h-6 text-primary" />
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{realtorName}</div>
                    <div className="text-sm text-gray-500">Property Agent</div>
                  </div>
                </div>
                {property.realtor?.user?.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                    <Phone className="w-4 h-4 flex-shrink-0" />
                    <span>{property.realtor.user.phone}</span>
                  </div>
                )}
              </div>

              {(() => {
                const token = getToken();
                const purchaseUrl = `/properties/${property.id}/purchase`;
                const href = token
                  ? purchaseUrl
                  : `/auth/login?redirect=${encodeURIComponent(purchaseUrl)}`;
                return (
                  <>
                    <Link href={href} className="block">
                      <Button className="w-full bg-accent hover:bg-accent-600 text-white py-6 text-lg">
                        Purchase Property
                      </Button>
                    </Link>
                    {!token && (
                      <p className="text-xs text-gray-400 text-center mt-3">
                        Sign in or create an account to proceed
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Left Column — Details (shows SECOND on mobile) */}
          <div className="lg:col-span-2 lg:order-1 space-y-6">
            {/* Image Gallery */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-lg">
              <div className="relative h-[280px] sm:h-[400px] md:h-[480px]">
                {images.length > 0 ? (
                  <>
                    <Image
                      src={resolveImageSrc(images[activeImage])}
                      alt={property.title}
                      fill
                      className="object-cover"
                    />
                    {images.length > 1 && (
                      <>
                        <button
                          onClick={() => setActiveImage(activeImage > 0 ? activeImage - 1 : images.length - 1)}
                          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow-lg transition-all"
                        >
                          <ChevronLeft className="w-5 h-5 text-gray-700" />
                        </button>
                        <button
                          onClick={() => setActiveImage(activeImage < images.length - 1 ? activeImage + 1 : 0)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow-lg transition-all"
                        >
                          <ChevronRight className="w-5 h-5 text-gray-700" />
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                    <Home className="w-24 h-24 text-primary/20" />
                  </div>
                )}
                <div className="absolute top-4 left-4 flex gap-2">
                  {property.type && (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-accent text-white">
                      {property.type.replace('_', ' ')}
                    </span>
                  )}
                  {property.status && (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary text-white">
                      {property.status}
                    </span>
                  )}
                </div>
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 p-4 overflow-x-auto">
                  {images.map((img: string, index: number) => (
                    <button
                      key={index}
                      onClick={() => setActiveImage(index)}
                      className={`relative w-20 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${
                        index === activeImage ? 'border-accent' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <Image src={resolveImageSrc(img)} alt={`View ${index + 1}`} fill className="object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Property Info */}
            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 leading-tight">
                {property.title}
              </h1>
              <div className="flex items-center gap-2 text-gray-500 mb-6 flex-wrap">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <span>{property.address}, {property.city}, {property.state}</span>
              </div>

              {/* Key Details Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {property.bedrooms != null && (
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <BedDouble className="w-6 h-6 text-accent mx-auto mb-1" />
                    <div className="text-lg font-bold text-gray-900">{property.bedrooms}</div>
                    <div className="text-xs text-gray-500">Bedrooms</div>
                  </div>
                )}
                {property.bathrooms != null && (
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <Bath className="w-6 h-6 text-accent mx-auto mb-1" />
                    <div className="text-lg font-bold text-gray-900">{property.bathrooms}</div>
                    <div className="text-xs text-gray-500">Bathrooms</div>
                  </div>
                )}
                {property.area != null && (
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <Maximize className="w-6 h-6 text-accent mx-auto mb-1" />
                    <div className="text-lg font-bold text-gray-900">{Number(property.area).toLocaleString()}</div>
                    <div className="text-xs text-gray-500">Sq Ft</div>
                  </div>
                )}
                {property.yearBuilt && (
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <Calendar className="w-6 h-6 text-accent mx-auto mb-1" />
                    <div className="text-lg font-bold text-gray-900">{property.yearBuilt}</div>
                    <div className="text-xs text-gray-500">Year Built</div>
                  </div>
                )}
              </div>

              {/* For Land Properties */}
              {property.type === 'LAND' && (
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {property.pricePerSqm && (
                    <div className="bg-accent/5 border border-accent/20 rounded-xl p-4">
                      <div className="text-sm text-gray-500">Price per plot</div>
                      <div className="text-lg font-bold text-accent">{formatPrice(Number(property.pricePerSqm))}</div>
                    </div>
                  )}
                  {property.numberOfPlots && (
                    <div className="bg-accent/5 border border-accent/20 rounded-xl p-4">
                      <div className="text-sm text-gray-500">Number of Plots</div>
                      <div className="text-lg font-bold text-accent">{property.numberOfPlots}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Description</h2>
                {property.description ? (
                  <p className="text-gray-600 leading-relaxed">{property.description}</p>
                ) : (
                  <p className="text-gray-400 italic">No description available.</p>
                )}
              </div>

              {/* Features */}
              {property.features && property.features.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-3">Features</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {property.features.map((feature: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}
