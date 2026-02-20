import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Performance budget configuration for bundle size limits.
 * Ensures the main bundle stays optimized for fast LCP.
 */
const performanceBudgetConfig = {
  output: {
    /**
     * Warn when chunks exceed these sizes (in KB).
     * Main bundle should stay under 170KB gzipped for fast LCP.
     */
    chunkSizeWarningsLimit: 500,
  },
  // Enforce budget checks during build
  onwarn(warning, warn) {
    if (warning.code === "CIRCULAR_DEPENDENCY") return;
    if (warning.code === "EVAL") return;
    warn(warning);
  },
};

export default defineConfig({
  base: "/",
  build: {
    target: "es2022",
    cssMinify: true,
    minify: "esbuild",
    sourcemap: false,
    // Build optimization
    cssCodeSplit: true,
    assetsInlineLimit: 4096, // 4KB - inline small assets
    chunkSizeWarningLimit: 500,
    // Performance budgets for bundle sizes
    rollupOptions: {
      ...performanceBudgetConfig,
      output: {
        manualChunks: (id) => {
          // Keep web-vitals in main bundle for early metrics collection
          if (id.includes("web-vitals")) return "main";

          // Lazy-loaded handler chunks - split into separate bundles
          if (id.includes("/handlers/FFmpeg.")) return "handler-ffmpeg";
          if (id.includes("/handlers/ImageMagick.")) return "handler-imagemagick";
          if (id.includes("/handlers/pdftoimg.")) return "handler-pdftoimg";
          if (id.includes("/handlers/pandoc.")) return "handler-pandoc";
          if (id.includes("/handlers/threejs.")) return "handler-threejs";
          if (id.includes("/handlers/sppd.")) return "handler-sppd";
          if (id.includes("/handlers/sqlite.")) return "handler-sqlite";
          if (id.includes("/handlers/meyda.")) return "handler-meyda";
          if (id.includes("/handlers/envelope.")) return "handler-envelope";
          if (id.includes("/handlers/libopenmpt.")) return "handler-libopenmpt";
          if (id.includes("/handlers/lzh.")) return "handler-lzh";
          if (id.includes("/handlers/flo.")) return "handler-flo";
          if (id.includes("/handlers/petozip.")) return "handler-petozip";
          if (id.includes("/handlers/flptojson.")) return "handler-flptojson";

          // Shared vendor chunks for WASM-heavy dependencies
          if (id.includes("@ffmpeg/ffmpeg") || id.includes("@ffmpeg/util")) return "vendor-ffmpeg";
          if (id.includes("@imagemagick/magick-wasm")) return "vendor-imagemagick";
          if (id.includes("@sqlite.org/sqlite-wasm")) return "vendor-sqlite";
          if (id.includes("pdftoimg-js")) return "vendor-pdftoimg";
          if (id.includes("three") || id.includes("three-mesh-bvh") || id.includes("three-bvh-csg")) return "vendor-three";
          if (id.includes("@flo-audio/reflo")) return "vendor-flo";
          if (id.includes("meyda")) return "vendor-meyda";

          // Other shared libraries
          if (id.includes("jszip") || id.includes("pako") || id.includes("mime") || id.includes("imagetracer")) return "vendor-data";
          if (id.includes("nbtify") || id.includes("pe-library") || id.includes("ts-flp") || id.includes("wavefile")) return "vendor-niche";

          // Node polyfills
          if (id.includes("node-polyfill") || id.includes("buffer")) return "polyfills";
        },
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split(".");
          const ext = info[info.length - 1];
          if (/\.wasm$/i.test(assetInfo.name)) {
            return "wasm/[name][extname]";
          }
          return "assets/[name]-[hash][extname]";
        },
      },
    },
    reportCompressedSize: true,
    // Preload critical chunks for faster LCP
    modulePreload: {
      polyfill: false, // Modern browsers support modulepreload
    },
  },
  optimizeDeps: {
    exclude: [
      "@ffmpeg/ffmpeg",
      "@ffmpeg/core",
      "@sqlite.org/sqlite-wasm",
      "@imagemagick/magick-wasm",
    ],
    include: ["mime", "jszip", "pako"],
  },
  esbuild: {
    drop: ["console", "debugger"],
    legalComments: "none",
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true,
  },
  server: {
    headers: {
      "Cache-Control": "public, max-age=0",
      "Service-Worker-Allowed": "/",
    },
  },
  preview: {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Service-Worker-Allowed": "/",
    },
  },
  // Experimental features for better performance
  experimental: {
    // Enable faster HMR updates
    hmrPartialAccept: true,
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: "public/sw.js",
          dest: ".",
        },
        {
          src: "public/manifest.json",
          dest: ".",
        },
        {
          src: "node_modules/@flo-audio/reflo/reflo_bg.wasm",
          dest: "wasm",
        },
        {
          src: "node_modules/@imagemagick/magick-wasm/dist/magick.wasm",
          dest: "wasm",
        },
        {
          src: "src/handlers/libopenmpt/libopenmpt.wasm",
          dest: "wasm",
        },
        {
          src: "src/handlers/libopenmpt/libopenmpt.js",
          dest: "wasm",
        },
      ],
    }),
    tsconfigPaths(),
    {
      name: "service-worker-inject",
      writeBundle() {
        // The service worker is copied via viteStaticCopy
        // This hook ensures sw.js is included in the build
      },
    },
  ],
});
