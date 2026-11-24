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
      includeAssets: ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'logo.svg'],
      manifest: {
        id: '/',
        name: 'SplitCircle — split bills fairly',
        short_name: 'SplitCircle',
        description:
          'Split shared expenses with roommates, trips and friends. Everyone approves each bill, and SplitCircle shows who pays whom.',
        theme_color: '#1769E0',
        background_color: '#F3F6FB',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait',
        scope: '/',
        start_url: '/?source=pwa',
        launch_handler: { client_mode: 'focus-existing' },
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Shown in Chrome's richer install sheet
        screenshots: [
          { src: 'screenshot-phone-1.png', sizes: '780x1688', type: 'image/png', form_factor: 'narrow', label: 'Your groups and balances' },
          { src: 'screenshot-phone-2.png', sizes: '780x1688', type: 'image/png', form_factor: 'narrow', label: 'Expenses split and approved together' },
          { src: 'screenshot-wide.png', sizes: '1366x768', type: 'image/png', form_factor: 'wide', label: 'SplitCircle on a computer' },
        ],
        // Long-press the app icon for these
        shortcuts: [
          {
            name: 'Add an expense',
            short_name: 'Add',
            url: '/?action=add',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'My groups',
            short_name: 'Groups',
            url: '/rooms',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Scan a QR to join',
            short_name: 'Join',
            url: '/join',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
        categories: ['finance', 'productivity', 'lifestyle'],
        lang: 'en-IN',
        dir: 'ltr',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // jsPDF's optional helpers (HTML/SVG rendering) are never used here; keep them out of the install.
        // Install-sheet screenshots and the link-preview image aren't needed offline.
        globIgnores: ['**/html2canvas*.js', '**/purify.es*.js', '**/index.es-*.js', '**/screenshot-*.png', '**/og-image.png'],
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
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-icons': ['react-icons'],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
