import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // We register the SW ourselves (src/lib/pwaUpdate.ts) so we can prompt
      // the user to reload when a new version is ready, instead of silently
      // leaving an already-open tab running stale JS indefinitely.
      injectRegister: false,
      includeAssets: ['favicon.ico', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: "Who's Bad Logistic",
        short_name: 'WB Logistic',
        description: 'Gestion volants, t-shirts et entraînements',
        theme_color: '#FBF7EF',
        background_color: '#FBF7EF',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        shortcuts: [
          {
            name: 'Nouvelle vente',
            short_name: 'Vente',
            description: "Ouvrir la dictée pour saisir une vente",
            url: '/',
            icons: [{ src: '/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Impayés',
            short_name: 'Impayés',
            description: 'Voir les paiements en attente',
            url: '/pending',
            icons: [{ src: '/icon-192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/whosbad-backend\.onrender\.com\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
