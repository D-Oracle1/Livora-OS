import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { Providers } from './providers';
import { Toaster } from '@/components/ui/sonner';
import { SupportChatWidget } from '@/components/support/support-chat-widget';
import { BrandingTitle } from '@/components/branding-title';
import { BrandingGate } from '@/components/branding-gate';

const inter = Inter({ subsets: ['latin'] });

const APP_DESCRIPTION =
  'Enterprise-grade PropTech platform for managing realtors, properties, and clients';

export const metadata: Metadata = {
  title: {
    default: 'Loading...',
    template: '%s',
  },
  description: APP_DESCRIPTION,
  keywords: ['real estate', 'property management', 'realtors', 'proptech'],
  manifest: '/api/manifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Livora OS',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    description: APP_DESCRIPTION,
  },
  twitter: {
    card: 'summary',
    description: APP_DESCRIPTION,
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png' },
      { url: '/icons/icon-152x152.png', sizes: '152x152' },
      { url: '/icons/icon-192x192.png', sizes: '180x180' },
    ],
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0b5c46' },
    { media: '(prefers-color-scheme: dark)', color: '#031e19' },
  ],
  width: 'device-width',
  initialScale: 1,
  // Do NOT set maximumScale=1 — iOS 10+ ignores it and Safari flags it as
  // an accessibility violation. Allow users to pinch-zoom freely.
  minimumScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-visual',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <BrandingGate>
            <BrandingTitle />
            {children}
            <SupportChatWidget />
          </BrandingGate>
          <Toaster position="top-right" richColors closeButton />
        </Providers>
      </body>
    </html>
  );
}
