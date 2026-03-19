import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
            manifest: {
                name: 'Neoclima Field Tracker',
                short_name: 'NCTracker',
                description: 'Suivi chantier temps réel — Neoclima',
                theme_color: '#2C3E50',
                background_color: '#C0392B',
                display: 'standalone',
                orientation: 'portrait',
                scope: '/',
                start_url: '/?pwa=1',
                icons: [
                    { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
                    { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
                    { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'supabase-cache',
                            expiration: { maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 },
                            networkTimeoutSeconds: 5
                        }
                    },
                    {
                        urlPattern: /.*\.(pdf|png|jpg|jpeg|webp)$/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'plans-cache',
                            expiration: { maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 }
                        }
                    }
                ]
            }
        })
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    }
});
