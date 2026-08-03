import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

// ── SW build-ID plugin ────────────────────────────────────────────────────────
// Injects `window.__SW_BUILD_ID__ = "TIMESTAMP"` into the HTML <head> so that
// the inline SW registration script can version the SW URL: sw.js?v=TIMESTAMP.
// This causes the cache name to change every build, evicting stale assets.
const BUILD_TIME = Date.now().toString();

function swBuildIdPlugin(): Plugin {
  return {
    name: 'sw-build-id',
    transformIndexHtml: {
      order: 'pre' as const,
      handler(): import('vite').HtmlTagDescriptor[] {
        return [
          {
            tag: 'script',
            injectTo: 'head-prepend' as const,
            children: `var __SW_BUILD_ID__="${BUILD_TIME}";`,
          },
        ];
      },
    },
  };
}

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    'PORT environment variable is required but was not provided.',
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    'BASE_PATH environment variable is required but was not provided.',
  );
}

export default defineConfig({
  base: basePath,
  plugins: [
    swBuildIdPlugin(),
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
    // Dynamic imports already split pages into separate chunks;
    // raise the limit so React's vendor bundle doesn't trigger noise.
    chunkSizeWarningLimit: 600,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
