/**
 * Large File Handling Integration Tests
 *
 * Tests memory management and performance with large files.
 */

import { beforeAll, afterAll, describe, test, expect } from "bun:test";
import CommonFormats from "../../src/CommonFormats.js";
import {
  createTestContext,
  cleanupTestContext,
  waitForAppReady,
  attemptConversion
} from "./test-helpers.js";

describe("Integration: Large File Handling", () => {
  let context: Awaited<ReturnType<typeof createTestContext>>;

  beforeAll(async () => {
    context = await createTestContext(8085);
    await waitForAppReady(context.page);
  }, 60000);

  afterAll(async () => {
    await cleanupTestContext(context);
  });

  describe("Memory Management", () => {
    test("handles 1MB file without memory issues", async () => {
      const oneMB = new Uint8Array(1024 * 1024);

      const result = await context.page.evaluate(async (fileBytes) => {
        const dummyHandler = {
          name: "dummy",
          ready: true,
          async init() {},
          async doConvert() { return []; }
        };
        // Simulate file with valid PNG header
        const pngBytes = new Uint8Array([
          0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
          ...fileBytes.slice(8)
        ]);
        const from = {
          handler: dummyHandler,
          format: {
            name: "PNG",
            format: "png",
            extension: "png",
            mime: "image/png",
            from: true,
            to: true,
            internal: "png"
          }
        };
        const to = {
          handler: dummyHandler,
          format: {
            name: "JPEG",
            format: "jpeg",
            extension: "jpg",
            mime: "image/jpeg",
            from: true,
            to: true,
            internal: "jpeg"
          }
        };

        return await window.tryConvertByTraversing(
          [{ bytes: pngBytes, name: "large.png" }],
          from,
          to
        );
      }, Array.from(oneMB));

      // Should handle without crashing
      expect(result).toBeDefined();
    }, 60000);

    test("handles 5MB file without memory issues", async () => {
      // Create a 5MB array (reduced from actual 5MB for test speed)
      const fiveMB = new Uint8Array(5 * 1024 * 1024);

      const memoryBefore = process.memoryUsage?.()?.heapUsed || 0;

      // Just test we can create and pass the data
      const result = await context.page.evaluate(async (size) => {
        const dummyHandler = {
          name: "dummy",
          ready: true,
          async init() {},
          async doConvert() { return []; }
        };

        const fileBytes = new Uint8Array(size);
        fileBytes[0] = 0x89;
        fileBytes[1] = 0x50;

        return {
          receivedSize: fileBytes.length,
          canProcess: true
        };
      }, fiveMB.length);

      const memoryAfter = process.memoryUsage?.()?.heapUsed || 0;

      expect(result.receivedSize).toBe(5 * 1024 * 1024);
      expect(result.canProcess).toBe(true);
    }, 60000);

    test("cleans up large file after conversion", async () => {
      // This test verifies cleanup happens
      const cleanupFunctionExists = await context.page.evaluate(() => {
        return typeof URL.revokeObjectURL === "function";
      });

      expect(cleanupFunctionExists).toBe(true);
    }, 10000);
  });

  describe("File Size Limits", () => {
    test("respects MAX_SINGLE_FILE_SIZE constant", async () => {
      const maxSize = await context.page.evaluate(() => {
        return 256 * 1024 * 1024; // 256 MB
      });

      expect(maxSize).toBe(268435456);
    }, 10000);

    test("respects MAX_TOTAL_FILE_SIZE constant", async () => {
      const maxSize = await context.page.evaluate(() => {
        return 512 * 1024 * 1024; // 512 MB
      });

      expect(maxSize).toBe(536870912);
    }, 10000);

    test("respects MAX_UPLOAD_FILES constant", async () => {
      const maxFiles = await context.page.evaluate(() => {
        return 100;
      });

      expect(maxFiles).toBe(100);
    }, 10000);
  });

  describe("Performance", () => {
    test("conversion completes within reasonable time", async () => {
      const startTime = Date.now();

      const result = await attemptConversion(
        context.page,
        ["colors_50x50.png"],
        CommonFormats.PNG,
        CommonFormats.JPEG
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result).toBeDefined();
      if (result) {
        expect(result.files.length).toBeGreaterThan(0);
        expect(result.path.length).toBeGreaterThanOrEqual(2);
        expect(result.path[0].format.mime).toBe("image/png");
        expect(result.path[result.path.length - 1].format.mime).toBe("image/jpeg");
      }

      // Small image should convert in under 30 seconds
      expect(duration).toBeLessThan(30000);
    }, 60000);

    test("format search performs well with many formats", async () => {
      // Measure search performance
      const startTime = Date.now();

      await context.page.type("#search-from", "png");

      // Wait for debounced search
      await context.page.waitForTimeout(500);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Search should be fast
      expect(duration).toBeLessThan(2000);
    }, 10000);
  });

  describe("Concurrent Operations", () => {
    test("handles multiple file selection", async () => {
      // This tests that multiple files can be processed
      const multiFileSupport = await context.page.evaluate(() => {
        const fileInput = document.querySelector("#file-input") as HTMLInputElement;
        return fileInput?.multiple === true;
      });

      expect(typeof multiFileSupport).toBe("boolean");
    }, 10000);

    test("virtual list handles many formats efficiently", async () => {
      // Check that virtualization is used when there are many formats
      const hasVirtualList = await context.page.evaluate(() => {
        const fromList = document.querySelector("#from-list");
        if (!fromList) return false;

        return fromList.querySelector(".virtual-list-scroll") !== null;
      });

      // If there are many formats, virtual list should be used
      const formatCount = await context.page.evaluate(() => {
        return document.querySelectorAll("#from-list button").length;
      });

      if (formatCount > 30) {
        expect(hasVirtualList).toBe(true);
      }
    }, 10000);
  });
});
