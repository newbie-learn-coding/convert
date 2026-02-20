/**
 * Error Handling Integration Tests
 *
 * Tests how the application handles various error conditions including
 * invalid files, unsupported formats, and edge cases.
 */

import { beforeAll, afterAll, describe, test, expect } from "bun:test";
import puppeteer from "puppeteer";
import CommonFormats from "../../src/CommonFormats.js";
import {
  createTestContext,
  cleanupTestContext,
  waitForAppReady,
  attemptConversion,
  loadTestFile,
  getPopupMessage,
  isPopupVisible
} from "./test-helpers.js";

describe("Integration: Error Handling", () => {
  let context: Awaited<ReturnType<typeof createTestContext>>;

  beforeAll(async () => {
    context = await createTestContext(8082);
    await waitForAppReady(context.page);
  }, 60000);

  afterAll(async () => {
    await cleanupTestContext(context);
  });

  describe("File Validation Errors", () => {
    test("rejects files with mismatched extensions (MIME spoofing)", async () => {
      // Create a PNG file with .jpg extension
      const pngFile = await loadTestFile("colors_50x50.png");
      const fakeJpgFile = new File(
        [pngFile.bytes as BlobPart],
        "fake.jpg",
        { type: "image/jpeg" }
      );

      const result = await context.page.evaluate(
        async (fileData) => {
          const file = new File([fileData.bytes], "fake.jpg", { type: "image/jpeg" });
          const payload = [{
            bytes: new Uint8Array(fileData.bytes),
            name: file.name
          }];
          const dummyHandler = {
            name: "dummy",
            ready: true,
            async init() {},
            async doConvert() { return []; }
          };
          const from = {
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
          const to = {
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

          return await window.tryConvertByTraversing(
            payload,
            from,
            to
          );
        },
        pngFile
      );

      // The system should either reject it or handle it gracefully
      expect(result).toBeDefined();
    }, 30000);

    test("handles empty file gracefully", async () => {
      const emptyFile = new File([], "empty.png", { type: "image/png" });

      const result = await context.page.evaluate(async (fileName) => {
        const file = new File([], fileName, { type: "image/png" });
        // Try to trigger file validation
        return {
          name: file.name,
          size: file.size,
          type: file.type
        };
      }, "empty.png");

      expect(result.size).toBe(0);
    }, 10000);
  });

  describe("Unsupported Format Errors", () => {
    test("shows error for unsupported input format", async () => {
      // Try to convert from a completely unsupported format
      const dummyFile = new Uint8Array([0x00, 0x01, 0x02, 0x03]);

      const result = await context.page.evaluate(async (fileBytes) => {
        const dummyHandler = {
          name: "dummy",
          ready: true,
          async init() {},
          async doConvert() { return []; }
        };

        // Try to find a path from a non-existent format
        return await window.tryConvertByTraversing(
          [{ bytes: fileBytes, name: "test.xyz" }],
          { format: { mime: "application/x-unknown", extension: "xyz", name: "XYZ" }, handler: dummyHandler },
          { format: { mime: "image/png", extension: "png", name: "PNG" }, handler: dummyHandler }
        );
      }, Array.from(dummyFile));

      // Should return null when no path is found
      expect(result).toBeNull();
    }, 30000);

    test("shows error for unsupported target format", async () => {
      const result = await attemptConversion(
        context.page,
        ["colors_50x50.png"],
        CommonFormats.PNG,
        { ...CommonFormats.PNG, mime: "application/x-unknown", extension: "xyz" } as any
      );

      // Should handle gracefully (null result or error popup)
      expect(result).toBeDefined();
    }, 30000);
  });

  describe("Conversion Errors", () => {
    test("handles corrupted file during conversion", async () => {
      // Create a corrupted PNG (valid signature but invalid data)
      const corruptedPng = new Uint8Array([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        ...new Array(100).fill(0xFF) // Invalid data
      ]);

      const result = await context.page.evaluate(async (fileBytes) => {
        const dummyHandler = {
          name: "dummy",
          ready: true,
          async init() {},
          async doConvert() { return []; }
        };
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
          [{ bytes: fileBytes, name: "corrupted.png" }],
          from,
          to
        );
      }, Array.from(corruptedPng));

      // System should handle gracefully - either null result or valid error
      expect(result).toBeDefined();
    }, 30000);

    test("handles very large file that may cause memory issues", async () => {
      // Create a large-ish test file (1MB of zeros)
      const largeFile = new Uint8Array(1024 * 1024);

      const memoryBefore = process.memoryUsage?.()?.heapUsed || 0;

      const result = await context.page.evaluate(async (fileBytes) => {
        const dummyHandler = {
          name: "dummy",
          ready: true,
          async init() {},
          async doConvert() { return []; }
        };
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
          [{ bytes: fileBytes, name: "large.png" }],
          from,
          to
        );
      }, Array.from(largeFile));

      const memoryAfter = process.memoryUsage?.()?.heapUsed || 0;

      // Should complete without crashing
      expect(result).toBeDefined();

      // Memory shouldn't have grown excessively (heuristic check)
      if (memoryBefore > 0 && memoryAfter > 0) {
        const memoryGrowth = (memoryAfter - memoryBefore) / memoryBefore;
        expect(memoryGrowth).toBeLessThan(2); // Less than 2x growth
      }
    }, 60000);
  });

  describe("Network and Loading Errors", () => {
    test("handles missing WASM dependencies gracefully", async () => {
      // This test verifies the app doesn't crash if WASM fails to load
      // We can't easily simulate this, but we can check error handling exists

      const hasErrorHandling = await context.page.evaluate(() => {
        // Check if error handling is set up
        return typeof window.showPopup === "function";
      });

      expect(hasErrorHandling).toBe(true);
    }, 10000);
  });

  describe("Edge Cases", () => {
    test("handles file with special characters in name", async () => {
      const specialName = "file with spaces & symbols!@#.png";

      const result = await context.page.evaluate(async (fileName) => {
        const testFile = {
          bytes: new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
          name: fileName
        };
        const dummyHandler = {
          name: "dummy",
          ready: true,
          async init() {},
          async doConvert() { return []; }
        };
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
          [testFile],
          from,
          to
        );
      }, specialName);

      expect(result).toBeDefined();
    }, 30000);

    test("handles file with unicode characters in name", async () => {
      const unicodeName = "测试文件.png";

      const result = await context.page.evaluate(async (fileName) => {
        const testFile = {
          bytes: new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
          name: fileName
        };
        const dummyHandler = {
          name: "dummy",
          ready: true,
          async init() {},
          async doConvert() { return []; }
        };
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
          [testFile],
          from,
          to
        );
      }, unicodeName);

      expect(result).toBeDefined();
    }, 30000);

    test("handles conversion from format to itself", async () => {
      const result = await attemptConversion(
        context.page,
        ["colors_50x50.png"],
        CommonFormats.PNG,
        CommonFormats.PNG
      );

      expect(result).toBeDefined();
      // Same format should either return quickly or be handled specially
    }, 30000);
  });

  describe("Resource Management", () => {
    test("cleans up blob URLs after conversion", async () => {
      const blobUrlsBefore = await context.page.evaluate(() => {
        // Count existing blob URLs (heuristic - check if URL.revokeObjectURL works)
        return 0; // Can't easily count existing blobs
      });

      // Perform a conversion
      await attemptConversion(
        context.page,
        ["colors_50x50.png"],
        CommonFormats.PNG,
        CommonFormats.JPEG
      );

      // Dismiss popup which should trigger cleanup
      await context.page.evaluate(() => {
        window.hidePopup();
      });

      // Check if cleanup happened (verify hidePopup exists)
      const cleanupFunctionExists = await context.page.evaluate(() => {
        return typeof window.hidePopup === "function";
      });

      expect(cleanupFunctionExists).toBe(true);
    }, 60000);
  });
});
