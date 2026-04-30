import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').trim();

const DEFAULT_ICONS = [
  { src: '/icons/icon-72x72.png', sizes: '72x72', type: 'image/png' },
  { src: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png' },
  { src: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
  { src: '/icons/icon-144x144.png', sizes: '144x144', type: 'image/png' },
  { src: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
  { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
  { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
];

export async function GET(req: NextRequest) {
  let companyName = 'Livora OS';
  let shortName = 'Livora OS';
  let description = 'Enterprise-grade PropTech platform for managing realtors, properties, and clients';
  let themeColor = '#2b1464';
  let bgColor = '#ffffff';
  let icons = DEFAULT_ICONS;
  let splashAnimation = 'none';

  // Determine tenant from host header
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const domain = host.split(':')[0]; // strip port if any

  if (domain) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/companies/resolve?domain=${encodeURIComponent(domain)}`, {
        next: { revalidate: 300 },
      });
      if (res.ok) {
        const raw = await res.json();
        const company = raw?.data || raw;
        if (company?.name) companyName = company.name;
        if (company?.primaryColor) themeColor = company.primaryColor;

        const pwa = company?.pwaSettings;
        if (pwa) {
          if (pwa.appName) companyName = pwa.appName;
          if (pwa.shortName) shortName = pwa.shortName;
          if (pwa.description) description = pwa.description;
          if (pwa.themeColor) themeColor = pwa.themeColor;
          if (pwa.bgColor) bgColor = pwa.bgColor;
          if (pwa.splashAnimation) splashAnimation = pwa.splashAnimation;
          if (pwa.splashLogo) {
            icons = [
              { src: pwa.splashLogo, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
              ...DEFAULT_ICONS,
            ];
          }
        }
      }
    } catch {
      // Fall back to defaults
    }
  }

  const manifest = {
    id: '/',
    name: companyName,
    short_name: shortName,
    description,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: bgColor,
    theme_color: themeColor,
    splash_animation: splashAnimation !== 'none' ? splashAnimation : undefined,
    icons,
    categories: ['business', 'productivity'],
    lang: 'en',
    prefer_related_applications: false,
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}
