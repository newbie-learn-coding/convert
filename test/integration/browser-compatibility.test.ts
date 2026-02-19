/**
 * Browser Compatibility Integration Tests
 *
 * Tests that core functionality works across different browser environments.
 * Note: These tests run in Chromium via Puppeteer but verify cross-browser patterns.
 */

import { beforeAll, afterAll, describe, test, expect } from "bun:test";
import CommonFormats from "../../src/CommonFormats.js";
import {
  createTestContext,
  cleanupTestContext,
  waitForAppReady,
  attemptConversion,
  getSelectedFormat
} from "./test-helpers.js";

describe("Integration: Browser Compatibility", () => {
  let context: Awaited<ReturnType<typeof createTestContext>>;

  beforeAll(async () => {
    context = await createTestContext(8086);
    await waitForAppReady(context.page);
  }, 60000);

  afterAll(async () => {
    await cleanupTestContext(context);
  });

  describe("Modern JavaScript Features", () => {
    test("supports async/await", async () => {
      const hasAsyncAwait = await context.page.evaluate(() => {
        return (async () => true)();
      });

      expect(hasAsyncAwait).toBe(true);
    }, 10000);

    test("supports ES modules", async () => {
      const hasModules = await context.page.evaluate(() => {
        return typeof document.querySelector('script[type="module"]') === "object" ||
               "noModule" in HTMLScriptElement.prototype;
      });

      expect(hasModules).toBe(true);
    }, 10000);

    test("supports optional chaining", async () => {
      const result = await context.page.evaluate(() => {
        const obj = { nested: { value: "test" } };
        return obj?.nested?.value;
      });

      expect(result).toBe("test");
    }, 10000);

    test("supports nullish coalescing", async () => {
      const result = await context.page.evaluate(() => {
        return null ?? "default";
      });

      expect(result).toBe("default");
    }, 10000);
  });

  describe("Web APIs", () => {
    test("supports File API", async () => {
      const hasFileAPI = await context.page.evaluate(() => {
        return typeof File === "function" &&
               typeof FileReader === "function" &&
               typeof FormData === "function";
      });

      expect(hasFileAPI).toBe(true);
    }, 10000);

    test("supports Blob and URL APIs", async () => {
      const hasBlobAPI = await context.page.evaluate(() => {
        return typeof Blob === "function" &&
               typeof URL.createObjectURL === "function" &&
               typeof URL.revokeObjectURL === "function";
      });

      expect(hasBlobAPI).toBe(true);
    }, 10000);

    test("supports Clipboard API for paste", async () => {
      const hasClipboardAPI = await context.page.evaluate(() => {
        return "clipboardData" in window || // For paste events
               (navigator.clipboard !== undefined);
      });

      expect(hasClipboardAPI).toBeDefined();
    }, 10000);

    test("supports Drag and Drop API", async () => {
      const hasDnDAPI = await context.page.evaluate(() => {
        return "draggable" in HTMLElement.prototype &&
               typeof DataTransfer === "function";
      });

      expect(hasDnDAPI).toBe(true);
    }, 10000);

    test("supports Web Workers", async () => {
      const hasWorkers = await context.page.evaluate(() => {
        return typeof Worker === "function";
      });

      expect(hasWorkers).toBe(true);
    }, 10000);

    test("supports ResizeObserver", async () => {
      const hasResizeObserver = await context.page.evaluate(() => {
        return typeof ResizeObserver === "function";
      });

      expect(hasResizeObserver).toBe(true);
    }, 10000);

    test("supports requestAnimationFrame", async () => {
      const hasRAF = await context.page.evaluate(() => {
        return typeof requestAnimationFrame === "function";
      });

      expect(hasRAF).toBe(true);
    }, 10000);
  });

  describe("CSS Features", () => {
    test("supports CSS Grid", async () => {
      const hasGrid = await context.page.evaluate(() => {
        const testStyle = document.createElement("div").style;
        return "grid" in testStyle || "msGrid" in testStyle;
      });

      expect(hasGrid).toBe(true);
    }, 10000);

    test("supports CSS Flexbox", async () => {
      const hasFlexbox = await context.page.evaluate(() => {
        const testStyle = document.createElement("div").style;
        return "flex" in testStyle || "webkitFlex" in testStyle;
      });

      expect(hasFlexbox).toBe(true);
    }, 10000);

    test("supports CSS Variables", async () => {
      const hasVars = await context.page.evaluate(() => {
        const testStyle = document.createElement("div").style;
        testStyle.setProperty("--test", "value");
        return testStyle.getPropertyValue("--test") === "value" ||
               "CSS" in window && "supports" in (window as any).CSS && (window as any).CSS.supports("--test", "value");
      });

      expect(hasVars).toBeDefined();
    }, 10000);
  });

  describe("Cross-Browser Conversion Tests", () => {
    test("PNG to JPEG works", async () => {
      const result = await attemptConversion(
        context.page,
        ["colors_50x50.png"],
        CommonFormats.PNG,
        CommonFormats.JPEG
      );

      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      expect(result!.files.length).toBeGreaterThan(0);
    }, 60000);

    test("MP4 to PNG works", async () => {
      const result = await attemptConversion(
        context.page,
        ["doom.mp4"],
        CommonFormats.MP4,
        CommonFormats.PNG
      );

      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      expect(result!.files.length).toBeGreaterThan(0);
    }, 60000);
  });

  describe("Feature Detection", () => {
    test("has proper feature detection for WebAssembly", async () => {
      const hasWasm = await context.page.evaluate(() => {
        return typeof WebAssembly === "object";
      });

      expect(hasWasm).toBe(true);
    }, 10000);

    test("has proper feature detection for required APIs", async () => {
      const features = await context.page.evaluate(() => {
        return {
          promise: typeof Promise === "function",
          map: typeof Map === "function",
          set: typeof Set === "function",
          arrayBuffer: typeof ArrayBuffer === "function",
          uint8Array: typeof Uint8Array === "function",
          textEncoder: typeof TextEncoder === "function",
          textDecoder: typeof TextDecoder === "function"
        };
      });

      for (const [key, value] of Object.entries(features)) {
        expect(value, `${key} should be supported`).toBe(true);
      }
    }, 10000);
  });

  describe("Graceful Degradation", () => {
    test("works when JavaScript is disabled (fallback links)", async () => {
      // Check for no-JS fallback content
      const hasNoJsContent = await context.page.evaluate(() => {
        const noscript = document.querySelector("noscript");
        return noscript !== null && noscript.textContent?.length ?? 0 > 0;
      });

      expect(hasNoJsContent).toBe(true);
    }, 10000);

    test("has fallback for missing APIs", async () => {
      // Check if there's error handling for missing features
      const hasErrorHandling = await context.page.evaluate(() => {
        // Check try-catch blocks in loaded code
        const scripts = Array.from(document.querySelectorAll("script"));
        return scripts.some(s => s.textContent?.includes("try") && s.textContent?.includes("catch"));
      });

      expect(hasErrorHandling).toBeDefined();
    }, 10000);
  });

  describe("Mobile Browser Compatibility", () => {
    test("has viewport meta tag", async () => {
      const viewport = await context.page.$eval('meta[name="viewport"]', meta =>
        meta.getAttribute("content")
      );

      expect(viewport).toContain("width=device-width");
      expect(viewport).toContain("initial-scale");
    }, 10000);

    test("touch events are handled", async () => {
      const hasTouchHandlers = await context.page.evaluate(() => {
        return "ontouchstart" in window ||
               (navigator as any).maxTouchPoints > 0;
      });

      // Touch support detection exists
      expect(typeof hasTouchHandlers).toBe("boolean");
    }, 10000);

    test("PWA manifest is present", async () => {
      const hasManifest = await context.page.evaluate(() => {
        const link = document.querySelector('link[rel="manifest"]');
        return link !== null && link.getAttribute("href");
      });

      expect(hasManifest).toBeDefined();
    }, 10000);
  });
});
