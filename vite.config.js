import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  base: "/",
  build: {
    target: "es2022",
    cssMinify: true,
    minify: "esbuild",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor": ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
          "media": ["@imagemagick/magick-wasm", "@flo-audio/reflo"],
          "data": ["jszip", "pako", "mime"],
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
    chunkSizeWarningLimit: 500,
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
  server: {
    headers: {
      "Cache-Control": "public, max-age=0",
    },
  },
  preview: {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
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
  ],
});
