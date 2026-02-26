'use client';

import { useState, useEffect } from 'react';
import { getTenantId, setTenantId } from '@/lib/api';
import { resetBrandingCache } from '@/hooks/use-branding';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').trim();

/**
 * Resolves the tenant company ID from the current hostname when
 * NEXT_PUBLIC_COMPANY_ID is not set (e.g. Vercel preview URLs).
 *
 * Returns `tenantReady: true` once the ID is known (or resolution failed),
 * so data-fetching effects can safely depend on it.
 *
 * Also calls resetBrandingCache() after resolution so useBranding() consumers
 * (e.g. PublicNavbar) re-fetch with the correct X-Company-ID header.
 */
export function useTenantResolution(): { tenantReady: boolean } {
  const [tenantReady, setTenantReady] = useState(() => Boolean(getTenantId()));

  useEffect(() => {
    if (getTenantId()) {
      setTenantReady(true);
      return;
    }
    const hostname = window.location.hostname;
    fetch(`${API_BASE}/api/v1/companies/resolve?domain=${encodeURIComponent(hostname)}`)
      .then(r => r.ok ? r.json() : null)
      .then(raw => {
        const company = raw?.data || raw;
        if (company?.id) {
          setTenantId(company.id);
          resetBrandingCache(); // re-fetch branding with correct X-Company-ID
        }
      })
      .catch(() => {})
      .finally(() => setTenantReady(true));
  }, []);

  return { tenantReady };
}
