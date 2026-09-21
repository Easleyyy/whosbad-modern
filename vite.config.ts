import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import fs from 'fs';
import type { Plugin } from 'vite';
import { handleAdherents, type AdherentStore } from './netlify/lib/adherentsApi';

/** `npm run dev` has no Netlify Functions: serve /api/adherents from a local JSON file
 *  (.dev-data/, git-ignored) using the exact same handler as production. The dev list is
 *  therefore separate from the real one — testing here never touches the club's data. */
function devAdherents(): Plugin {
  const file = path.resolve(__dirname, '.dev-data/adherents.json');
  const store: AdherentStore = {
    async read() {
      try {
        const names = JSON.parse(fs.readFileSync(file, 'utf8'));
        return { names: Array.isArray(names) ? names : [], version: String(fs.statSync(file).mtimeMs) };
      } catch {
        return { names: [], version: undefined };
      }
    },
    async write(names) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(names, null, 2));
      return true;
    },
  };
  return {
    name: 'dev-adherents',
    configureServer(server) {
      server.middlewares.use('/api/adherents', async (req, res) => {
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const body = chunks.length ? Buffer.concat(chunks) : undefined;
        const request = new Request('http://localhost/api/adherents', {
          method: req.method,
          body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
        });
        const response = await handleAdherents(request, store);
        res.statusCode = response.status;
        response.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(await response.text());
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    devAdherents(),
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
