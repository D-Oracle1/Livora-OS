'use client';

import { useEffect } from 'react';
import { usePlatformBranding, getPlatformName } from '@/hooks/use-platform-branding';

/**
 * Sets the browser tab title dynamically from platform branding.
 * Reacts instantly when branding is saved via updatePlatformBranding().
 */
export function DynamicTitle() {
  const branding = usePlatformBranding();

  useEffect(() => {
    const name = getPlatformName(branding);
    document.title = `${name} | Admin`;
  }, [branding]);

  return null;
}
