import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, type PluginOption } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import createHtmlPlugin from "vite-plugin-simple-html";

// Imported lazily, and only when analysing. rollup-plugin-visualizer is a
// devDependency, so a top-level import would make `vite build` fail outright in
// any image built with `npm ci --omit=dev` -- a break that would only show up at
// deploy time, in the Docker build, long after CI went green.
async function analyzerPlugin(): Promise<PluginOption[]> {
  if (!process.env.ANALYZE) return [];
  const { visualizer } = await import("rollup-plugin-visualizer");
  return [visualizer({ open: true, filename: "./.analyze/stats.html" })];
}

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  server: {
    port: 5173,
    host: true,
    // Same-origin API access in dev, matching the Caddy reverse proxy in prod.
    proxy: {
      "/api": "http://localhost:3000",
      "/storage": "http://localhost:3000",
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    // Opt-in only (`npm run build:analyze`). Writing the report into dist/ made
    // Caddy serve the full module graph publicly at /stats.html, and `open`
    // tried to launch a browser inside the Docker build.
    ...(await analyzerPlugin()),
    createHtmlPlugin({
      minify: true,
      inject: {
        data: {
          mainScript: `src/main.tsx`,
        },
      },
    }),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB
        // The app is path-routed, so an offline deep link must resolve to the
        // SPA shell rather than 404. API and storage calls must never be
        // answered with HTML.
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/storage\//],
      },
      manifest: false, // Use existing manifest.json from public/
    }),
  ],
  // Absolute rather than "./". The app is hash-routed (ra-core mounts a
  // HashRouter), so pathname is normally "/" and "./" happens to resolve
  // correctly -- but only by luck. Any real path, such as the SPA fallback
  // serving a mistyped or legacy URL, resolves "./assets/..." against that
  // path instead and gets HTML back for a module script.
  base: "/",
  build: {
    // No sourcemaps in production until there is an error tracker to upload
    // them to; Caddy would otherwise serve them publicly.
    sourcemap: false,
  },
  resolve: {
    preserveSymlinks: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
