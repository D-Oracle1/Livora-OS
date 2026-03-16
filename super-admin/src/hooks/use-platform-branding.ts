'use client';

import { useState, useEffect } from 'react';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').trim();
const STORAGE_KEY = 'platform_branding';

export interface PlatformBrandingData {
  platformName?: string;
  logo?: string;
  primaryColor?: string;
  tagline?: string;
  favicon?: string;
  sidebarColor?: string;
  sidebarTextColor?: string;
}

// Module-level cache — survives component mounts within a page session
const cache: { data: PlatformBrandingData | null; promise: Promise<void> | null } = {
  data: null,
  promise: null,
};

// Synchronously load from localStorage on module init (client only)
if (typeof window !== 'undefined') {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      cache.data = JSON.parse(stored);
    }
  } catch {
    // ignore
  }
}

function fetchPlatformBranding(): Promise<void> {
  if (!cache.promise) {
    cache.promise = fetch(`${API_BASE_URL}/api/v1/master/platform-settings/public`)
      .then((r) => (r.ok ? r.json() : null))
      .then((raw) => {
        const data = raw?.data || raw;
        cache.data = data && typeof data === 'object' ? data : {};
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cache.data));
        } catch {}
      })
      .catch(() => {
        if (!cache.data) cache.data = {};
      });
  }
  return cache.promise;
}

/**
 * Immediately updates the in-memory cache + localStorage and broadcasts
 * a 'branding-updated' event so every mounted usePlatformBranding consumer
 * re-renders instantly — no page refresh required.
 * Call this after successfully saving branding settings.
 */
export function updatePlatformBranding(data: PlatformBrandingData): void {
  cache.data = data;
  cache.promise = null;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('branding-updated', { detail: data }));
  }
}

/**
 * Invalidates the platform branding cache so next call re-fetches.
 * Prefer updatePlatformBranding() after saves for an instant update.
 */
export function invalidatePlatformBranding(): void {
  cache.data = null;
  cache.promise = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

/**
 * Returns reactive platform branding data for the super-admin sidebar/UI.
 * Re-renders whenever branding is saved via updatePlatformBranding().
 */
export function usePlatformBranding(): PlatformBrandingData {
  const [branding, setBranding] = useState<PlatformBrandingData>(cache.data || {});

  useEffect(() => {
    if (cache.data) setBranding(cache.data);
    fetchPlatformBranding().then(() => {
      if (cache.data) setBranding(cache.data);
    });

    const onBrandingUpdated = (e: Event) => {
      const detail = (e as CustomEvent<PlatformBrandingData>).detail;
      if (detail) setBranding(detail);
    };
    window.addEventListener('branding-updated', onBrandingUpdated);
    return () => window.removeEventListener('branding-updated', onBrandingUpdated);
  }, []);

  return branding;
}

export function getPlatformName(branding: PlatformBrandingData): string {
  return branding.platformName || 'Vicson Digital Hub';
}
