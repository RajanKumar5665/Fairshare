import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['screenshot-wide.png'],
      manifest: {
        name: 'FairShare - Expense Tracker',
        short_name: 'FairShare',
        description: 'Track personal expenses and split bills with friends',
        theme_color: '#0f6e56',
        background_color: '#f4f1ea',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'screenshot-wide.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'screenshot-wide.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'screenshot-wide.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Add Expense',
            short_name: 'Add',
            description: 'Quickly add a personal expense',
            url: '/?action=add',
            icons: [{ src: 'screenshot-wide.png', sizes: '192x192' }],
          },
          {
            name: 'View Rooms',
            short_name: 'Rooms',
            description: 'Open your shared rooms',
            url: '/rooms',
            icons: [{ src: 'screenshot-wide.png', sizes: '192x192' }],
          },
        ],
        categories: ['finance', 'productivity'],
        lang: 'en-IN',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
});
