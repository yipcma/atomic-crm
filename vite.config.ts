import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import createHtmlPlugin from "vite-plugin-simple-html";

// https://vitejs.dev/config/
export default defineConfig({
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
    ...(process.env.ANALYZE
      ? [visualizer({ open: true, filename: "./.analyze/stats.html" })]
      : []),
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
  define:
    process.env.NODE_ENV === "production"
      ? {
          "import.meta.env.VITE_IS_DEMO": JSON.stringify(
            process.env.VITE_IS_DEMO,
          ),
        }
      : undefined,
  // Must be absolute: the app is path-routed (ra-core mounts a BrowserRouter),
  // so with "./" a hard load of /contacts/123/show resolves asset URLs against
  // /contacts/123/ and Caddy's SPA fallback returns HTML for a module script.
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
});
