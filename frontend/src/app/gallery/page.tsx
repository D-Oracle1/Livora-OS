'use client';

import { useState, useEffect, useCallback } from 'react';
import { Camera, Film, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PublicNavbar } from '@/components/layout/public-navbar';
import { PublicFooter } from '@/components/layout/public-footer';
import { GalleryLightbox } from '@/components/gallery-lightbox';
import { getImageUrl } from '@/lib/api';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').trim();

type GalleryItemType = 'PHOTO' | 'VIDEO';

interface GalleryItem {
  id: string;
  title?: string;
  description?: string;
  type: GalleryItemType;
  url: string;
  thumbnailUrl?: string;
}

const FILTER_TABS = [
  { id: 'ALL', label: 'All', icon: ImageIcon },
  { id: 'PHOTO', label: 'Photos', icon: Camera },
  { id: 'VIDEO', label: 'Videos', icon: Film },
];

export default function GalleryPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | GalleryItemType>('ALL');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [footerData, setFooterData] = useState<any>(undefined);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const typeParam = filter !== 'ALL' ? `?type=${filter}` : '';
      const res = await fetch(`${API_BASE_URL}/api/v1/gallery/public${typeParam}`);
      if (res.ok) {
        const raw = await res.json();
        const data = raw?.data || raw;
        setItems(Array.isArray(data) ? data : []);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Fetch CMS data (footer + branding)
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/v1/cms/public`)
      .then((r) => r.ok ? r.json() : null)
      .then((raw) => {
        const data = raw?.data || raw;
        if (data && typeof data === 'object') {
          if (data.footer) setFooterData(data.footer);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-dvh bg-white dark:bg-primary-950">
      <PublicNavbar currentPage="/gallery" />

      {/* Hero */}
      <section className="bg-gradient-to-r from-primary via-primary-600 to-primary pt-28 pb-12 px-4">
        <div className="container mx-auto text-center">
          <span className="text-accent font-semibold text-sm uppercase tracking-wider">Gallery</span>
          <h1 className="text-3xl md:text-5xl font-bold text-white mt-3 mb-4">Our Gallery</h1>
          <p className="text-white/80 text-lg max-w-2xl mx-auto">
            Explore our collection of property photos and videos
          </p>
        </div>
      </section>

      {/* Gallery Content */}
      <section className="py-16 px-4 bg-white dark:bg-primary-950">
        <div className="container mx-auto">
          {/* Filter tabs */}
          <div className="flex justify-center gap-2 mb-10">
            {FILTER_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <Button
                  key={tab.id}
                  variant={filter === tab.id ? 'default' : 'outline'}
                  onClick={() => setFilter(tab.id as any)}
                  className={filter === tab.id ? 'bg-accent hover:bg-accent-600 text-white' : ''}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {tab.label}
                </Button>
              );
            })}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-20">
              <ImageIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">No Items Found</h3>
              <p className="text-gray-500 dark:text-gray-400">Check back later for new photos and videos.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  className="relative group cursor-pointer rounded-xl overflow-hidden aspect-square bg-muted"
                  onClick={() => setLightboxIndex(idx)}
                >
                  {item.type === 'PHOTO' ? (
                    <img
                      src={getImageUrl(item.url)}
                      alt={item.title || 'Gallery photo'}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <>
                      <video
                        src={getImageUrl(item.url)}
                        className="w-full h-full object-cover"
                        muted
                        preload="metadata"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-14 h-14 rounded-full bg-black/50 flex items-center justify-center">
                          <Film className="w-7 h-7 text-white" />
                        </div>
                      </div>
                    </>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                  {item.title && (
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-white text-sm font-medium truncate">{item.title}</p>
                      {item.description && (
                        <p className="text-white/70 text-xs truncate">{item.description}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {lightboxIndex !== null && (
        <GalleryLightbox
          items={items}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}

      <PublicFooter cmsData={footerData} />
    </div>
  );
}
