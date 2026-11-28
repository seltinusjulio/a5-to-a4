import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/**
 * Serves (dev) and copies (build) PDF.js cmaps & standard_fonts from node_modules
 * so PDF text rendering works 100% offline with zero external CDN requests.
 */
function copyPdfjsOfflineAssets(): Plugin {
  const rootDir = import.meta.dirname;
  const pdfjsDir = path.resolve(rootDir, 'node_modules/pdfjs-dist');
  const assetDirs = ['cmaps', 'standard_fonts'] as const;

  return {
    name: 'copy-pdfjs-offline-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const reqPath = (req.url || '').split('?')[0];
        for (const folder of assetDirs) {
          const marker = `/pdfjs/${folder}/`;
          const idx = reqPath.indexOf(marker);
          if (idx !== -1) {
            const relFile = decodeURIComponent(reqPath.slice(idx + marker.length));
            const safePath = path.resolve(pdfjsDir, folder, relFile);
            const allowedRoot = path.resolve(pdfjsDir, folder);
            if (safePath.startsWith(allowedRoot) && fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
              res.setHeader('Content-Type', 'application/octet-stream');
              fs.createReadStream(safePath).pipe(res);
              return;
            }
          }
        }
        next();
      });
    },
    writeBundle(options) {
      const outDir = options.dir ? path.resolve(options.dir) : path.resolve(rootDir, 'dist');
      for (const folder of assetDirs) {
        const src = path.join(pdfjsDir, folder);
        const dest = path.join(outDir, 'pdfjs', folder);
        if (fs.existsSync(src)) {
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.cpSync(src, dest, { recursive: true, force: true });
        }
      }
    },
  };
}

export default defineConfig(() => {
  const rawBase = (process.env.VITE_BASE_PATH || '/').trim();
  const normalizedBase = rawBase.replace(/^\/+|\/+$/g, '');
  const base = normalizedBase ? `/${normalizedBase}/` : '/';

  return {
    base,
    plugins: [react(), tailwindcss(), copyPdfjsOfflineAssets()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
