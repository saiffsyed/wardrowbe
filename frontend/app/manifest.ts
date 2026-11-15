import type { MetadataRoute } from 'next';

// Served at /manifest.webmanifest. Lets Android (Chrome) and iPhone (Safari, via
// "Add to Home Screen") install the app so it opens full screen like a native app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Wardrowbe',
    short_name: 'Wardrowbe',
    description: 'Your wardrobe and weekly outfit planner',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#111827',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
