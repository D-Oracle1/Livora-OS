'use client';

import { useEffect } from 'react';
import { useBranding } from '@/hooks/use-branding';

/**
 * Sets the browser tab title to the CMS company name.
 * Watches for route transitions and re-applies automatically.
 */
export function BrandingTitle() {
  const branding = useBranding();

  useEffect(() => {
    if (!branding.companyName) return;

    const name = branding.companyName;

    const applyTitle = () => {
      const current = document.title;
      // Replace any "Livora OS", or "Loading..." with the CMS name
      if (current === 'Loading...' || current.includes('Livora OS')) {
        document.title = current
          .replace(/Livora OS/g, name)
          .replace('Loading...', name);
      }
      // If the title is just a page name without branding, append it
      if (!current.includes(name) && current !== 'Loading...') {
        // Don't modify if it already has a proper title
      }
    };

    // Apply immediately
    applyTitle();

    // Watch for title changes from Next.js route transitions
    const titleEl = document.querySelector('title');
    if (!titleEl) return;

    const observer = new MutationObserver(applyTitle);
    observer.observe(titleEl, { childList: true, characterData: true, subtree: true });

    return () => observer.disconnect();
  }, [branding.companyName]);

  return null;
}
