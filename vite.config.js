import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  optimizeDeps: {
    exclude: [
      "@ffmpeg/ffmpeg",
      "@sqlite.org/sqlite-wasm",
    ]
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("/node_modules/three/") ||
            id.includes("/node_modules/three-bvh-csg/")
          ) return "vendor-three";

          if (
            id.includes("/node_modules/@ffmpeg/ffmpeg/") ||
            id.includes("/node_modules/@ffmpeg/util/")
          ) return "vendor-ffmpeg";

          if (id.includes("/node_modules/@imagemagick/magick-wasm/")) return "vendor-imagemagick";
          if (id.includes("/node_modules/@sqlite.org/sqlite-wasm/")) return "vendor-sqlite";

          if (
            id.includes("/node_modules/jszip/") ||
            id.includes("/node_modules/pako/") ||
            id.includes("/node_modules/mime/") ||
            id.includes("/node_modules/wavefile/") ||
            id.includes("/node_modules/meyda/") ||
            id.includes("/node_modules/nbtify/") ||
            id.includes("/node_modules/@std/yaml/") ||
            id.includes("/node_modules/pe-library/") ||
            id.includes("/node_modules/ts-flp/") ||
            id.includes("/node_modules/qoa-fu/") ||
            id.includes("/node_modules/qoi-fu/")
          ) return "vendor-data";

          if (
            id.includes("/src/handlers/qoa-fu/") ||
            id.includes("/src/handlers/qoi-fu/") ||
            id.includes("/src/handlers/pyTurtle.ts")
          ) return "vendor-specialized";

          return undefined;
        }
      }
    }
  },
  base: "/",
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: "node_modules/@flo-audio/reflo/reflo_bg.wasm",
          dest: "wasm"
        },
        {
          src: "node_modules/@imagemagick/magick-wasm/dist/magick.wasm",
          dest: "wasm"
        },
        {
          src: "src/handlers/libopenmpt/libopenmpt.wasm",
          dest: "wasm"
        },
        {
          src: "src/handlers/libopenmpt/libopenmpt.js",
          dest: "wasm"
        },
        {
          src: "src/handlers/espeakng.js/js/espeakng.worker.js",
          dest: "js"
        },
        {
          src: "src/handlers/espeakng.js/js/espeakng.worker.data",
          dest: "js"
        }
      ]
    }),
    tsconfigPaths()
  ]
});
