import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/** Identifiant de la publication (commit + date) : permet de vérifier sur le téléphone quelle version est installée. */
function commitId(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'local';
  }
}

/**
 * Chemin de publication. Sur GitHub Pages, le site est servi depuis
 * https://<utilisateur>.github.io/<nom-du-repo>/ : le workflow de déploiement
 * fournit BASE_PATH=/<nom-du-repo>/. Par défaut : /mg-elec-plans/.
 */
const base = process.env.BASE_PATH ?? '/mg-elec-plans/';

const build = { commit: commitId(), date: new Date().toISOString() };

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD__: JSON.stringify(build),
  },
  plugins: [
    {
      // version.json (jamais mis en cache) : l'application compare sa version à celle en ligne,
      // indépendamment du service worker.
      name: 'mg-version-json',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify(build) });
      },
    },
    react(),
    tailwindcss(),
    VitePWA({
      // La nouvelle version prend la main dès qu'elle est téléchargée (sur iPhone, l'application
      // n'est presque jamais complètement fermée : une version « en attente » n'arrivait jamais).
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['logo.svg', 'apple-touch-icon.png', 'favicon-32.png'],
      manifest: {
        id: base,
        name: 'MG Elec & Plans',
        short_name: 'MG Elec',
        description: 'Vos plans électriques, simplement. Plans, symboles, liaisons et étiquettes de tableau pour électriciens.',
        lang: 'fr',
        dir: 'ltr',
        display: 'standalone',
        orientation: 'portrait-primary',
        theme_color: '#111827',
        background_color: '#ffffff',
        start_url: base,
        scope: base,
        categories: ['productivity', 'business', 'utilities'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,webp,ico,woff2,json}'],
        // OpenCV.js (≈10 Mo) n'est pas pré-caché : il est mis en cache à la première utilisation.
        globIgnores: ['**/opencv-*.js', '**/version.json'],
        // Prise en main immédiate (non activée automatiquement avec injectRegister: false).
        skipWaiting: true,
        clientsClaim: true,
        // Recharge les pages ouvertes avec une ancienne version qui ne savent pas le faire seules.
        importScripts: ['sw-takeover.js'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/assets\/opencv-[^/]*\.js$/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'mg-opencv', expiration: { maxEntries: 3 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 16000,
  },
});
