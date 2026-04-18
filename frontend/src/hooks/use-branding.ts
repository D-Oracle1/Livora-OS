'use client';

import { useState, useEffect } from 'react';
import { getTenantId } from '@/lib/api';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').trim();
const STORAGE_KEY = 'cms_branding';

export interface BrandingData {
  companyName?: string;
  shortName?: string;
  logo?: string;
  primaryColor?: string;
  whatsappNumber?: string;
  whatsappLink?: string;
  supportEmail?: string;
  supportPhone?: string;
  address?: string;
  // Receipt / document details
  rcNumber?: string;
  accountName?: string;
  accountNumber?: string;
  bankName?: string;
  paymentMethod?: string;
  signatoryName?: string;
  signatoryTitle?: string;
  signatureImage?: string;
  // Receipt document branding — architecturally separate from platform/general logo
  receiptHeaderLogo?: string;    // top-left logo shown only on receipts
  receiptCompanyName?: string;   // company name shown only on receipts (overrides companyName)
  receiptWatermarkLogo?: string; // watermark logo (if different from header logo)
  watermarkOpacity?: number;     // 0–10, default 4 (stored as integer percentage)
  receiptLogo?: string;          // bottom-right footer logo on receipts
}

// Module-level cache — survives across component mounts within a page session
const cache: { data: BrandingData | null; promise: Promise<void> | null } = {
  data: null,
  promise: null,
};

// Synchronously load from localStorage on module init (client only).
// This makes branding data available BEFORE the first React render,
// so there is zero flash of fallback values on repeat visits / refreshes.
if (typeof window !== 'undefined') {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      cache.data = JSON.parse(stored);
    }
  } catch {
    // localStorage unavailable or corrupt — will fetch from API
  }
}

function fetchBranding(): Promise<void> {
  if (!cache.promise) {
    const headers: HeadersInit = {};
    const tid = getTenantId();
    if (tid) (headers as Record<string, string>)['X-Company-ID'] = tid;
    cache.promise = fetch(`${API_BASE_URL}/api/v1/cms/public/branding`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((raw) => {
        const data = raw?.data || raw;
        cache.data = data && typeof data === 'object' ? data : {};
        // Persist to localStorage so next page load / refresh is instant
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
 * Clears the branding cache and dispatches a 'branding-reset' event so all
 * mounted useBranding() consumers re-fetch with the current tenant ID.
 * Call this after setTenantId() to ensure branding reflects the resolved tenant.
 */
export function resetBrandingCache(): void {
  cache.data = null;
  cache.promise = null;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('branding-reset'));
  }
}

/**
 * Returns true if branding data has already been loaded
 * (from localStorage sync read or from a completed API call).
 */
export function hasBrandingData(): boolean {
  return cache.data !== null;
}

/**
 * Ensures branding data is fetched from the API.
 * Returns a promise that resolves once data is available.
 */
export function ensureBranding(): Promise<void> {
  return fetchBranding();
}

/**
 * Primary hook — returns branding data reactively.
 * On repeat visits, data is available on the very first render (from localStorage).
 * Always re-fetches from API in the background to pick up CMS changes.
 */
export function useBranding(): BrandingData {
  const [branding, setBranding] = useState<BrandingData>(cache.data || {});

  useEffect(() => {
    const refetch = () => {
      fetchBranding().then(() => {
        if (cache.data) setBranding(cache.data);
      });
    };

    // If localStorage had data, use it immediately
    if (cache.data) {
      setBranding(cache.data);
    }
    // Always fetch fresh from API (stale-while-revalidate)
    refetch();

    // Re-fetch when tenant ID is resolved after mount (e.g. dynamic hostname resolution)
    window.addEventListener('branding-reset', refetch);
    return () => window.removeEventListener('branding-reset', refetch);
  }, []);

  return branding;
}

/** Helper — company name with fallback */
export function getCompanyName(branding: BrandingData): string {
  return branding.companyName || 'Livora OS';
}

/** Helper — short name with fallback.
 *  Priority: explicit shortName → first-word of companyName → 'Livora OS'
 */
export function getShortName(branding: BrandingData): string {
  if (branding.shortName) return branding.shortName;
  if (branding.companyName) {
    const words = branding.companyName.trim().split(/\s+/);
    // Multi-word: use initials (up to 4 chars); single word: first 6 chars
    return words.length > 1
      ? words.map((w) => w[0]).join('').toUpperCase().slice(0, 4)
      : branding.companyName.slice(0, 6);
  }
  return 'Livora OS';
}
