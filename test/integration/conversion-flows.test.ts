/**
 * Conversion Flows Integration Tests
 *
 * Tests the complete user journey from file upload to download for
 * various file format conversions.
 */

import { beforeAll, afterAll, describe, test, expect } from "bun:test";
import puppeteer from "puppeteer";
import CommonFormats from "../../src/CommonFormats.js";
import {
  createTestContext,
  cleanupTestContext,
  waitForAppReady,
  attemptConversion,
  TestFixtures,
  TestAssertions
} from "./test-helpers.js";

describe("Integration: Conversion Flows", () => {
  let context: Awaited<ReturnType<typeof createTestContext>>;

  beforeAll(async () => {
    context = await createTestContext(8081);
    await waitForAppReady(context.page);
  }, 60000);

  afterAll(async () => {
    await cleanupTestContext(context);
  });

  describe("Image Conversions", () => {
    test("PNG to JPEG conversion produces valid output", async () => {
      const result = await attemptConversion(
        context.page,
        [TestFixtures.PNG_50X50],
        CommonFormats.PNG,
        CommonFormats.JPEG
      );

      expect(result).toBeDefined();
      expect(result).not.toBeNull();

      TestAssertions.assertValidConversion(
        result,
        "image/png",
        "image/jpeg"
      );

      // Verify output is actually JPEG (starts with FF D8 FF)
      const firstByte = result!.files[0].bytes[0];
      expect(firstByte).toBe(0xFF);
      const secondByte = result!.files[0].bytes[1];
      expect(secondByte).toBe(0xD8);
    }, 60000);

    test("PNG to WEBP conversion", async () => {
      const result = await attemptConversion(
        context.page,
        [TestFixtures.PNG_50X50],
        CommonFormats.PNG,
        CommonFormats.WEBP
      );

      expect(result).toBeDefined();
      TestAssertions.assertValidConversion(result, "image/png", "image/webp");

      // Verify WEBP signature (RIFF....WEBP)
      const bytes = result!.files[0].bytes;
      expect(bytes[0]).toBe(0x52); // R
      expect(bytes[1]).toBe(0x49); // I
      expect(bytes[2]).toBe(0x46); // F
      expect(bytes[3]).toBe(0x46); // F
    }, 60000);

    test("PNG to SVG conversion", async () => {
      const result = await attemptConversion(
        context.page,
        [TestFixtures.PNG_50X50],
        CommonFormats.PNG,
        CommonFormats.SVG
      );

      expect(result).toBeDefined();
      TestAssertions.assertValidConversion(result, "image/png", "image/svg+xml");

      // Verify SVG output contains <svg tag
      const text = new TextDecoder().decode(result!.files[0].bytes);
      expect(text.toLowerCase()).toContain("<svg");
    }, 60000);
  });

  describe("Video Conversions", () => {
    test("MP4 to GIF conversion", async () => {
      const result = await attemptConversion(
        context.page,
        [TestFixtures.MP4_DOOM],
        CommonFormats.MP4,
        CommonFormats.GIF
      );

      expect(result).toBeDefined();
      TestAssertions.assertValidConversion(result, "video/mp4", "image/gif");

      // Verify GIF signature (GIF87a or GIF89a)
      const bytes = result!.files[0].bytes;
      expect(bytes[0]).toBe(0x47); // G
      expect(bytes[1]).toBe(0x49); // I
      expect(bytes[2]).toBe(0x46); // F
    }, 60000);

    test("MP4 to PNG (frame extraction)", async () => {
      const result = await attemptConversion(
        context.page,
        [TestFixtures.MP4_DOOM],
        CommonFormats.MP4,
        CommonFormats.PNG
      );

      expect(result).toBeDefined();
      TestAssertions.assertValidConversion(result, "video/mp4", "image/png");

      // Verify PNG signature
      const bytes = result!.files[0].bytes;
      expect(bytes[0]).toBe(0x89);
      expect(bytes[1]).toBe(0x50);
    }, 60000);
  });

  describe("Audio Conversions", () => {
    test("MP3 to WAV conversion", async () => {
      const result = await attemptConversion(
        context.page,
        [TestFixtures.MP3_GASTER],
        CommonFormats.MP3,
        CommonFormats.WAV
      );

      expect(result).toBeDefined();
      TestAssertions.assertValidConversion(result, "audio/mpeg", "audio/wav");

      // Verify RIFF header for WAV
      const bytes = result!.files[0].bytes;
      expect(bytes[0]).toBe(0x52); // R
      expect(bytes[1]).toBe(0x49); // I
    }, 60000);

    test("MP3 to OGG conversion", async () => {
      const result = await attemptConversion(
        context.page,
        [TestFixtures.MP3_GASTER],
        CommonFormats.MP3,
        CommonFormats.OGG
      );

      expect(result).toBeDefined();
      TestAssertions.assertValidConversion(result, "audio/mpeg", "audio/ogg");

      // Verify OGG signature (OggS)
      const bytes = result!.files[0].bytes;
      expect(bytes[0]).toBe(0x4F); // O
      expect(bytes[1]).toBe(0x67); // g
    }, 60000);
  });

  describe("Document Conversions", () => {
    test("DOCX to PDF conversion", async () => {
      const result = await attemptConversion(
        context.page,
        [TestFixtures.DOCX_WORD],
        CommonFormats.DOCX,
        CommonFormats.PDF
      );

      expect(result).toBeDefined();
      TestAssertions.assertValidConversion(
        result,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/pdf"
      );

      // Verify PDF signature (%PDF)
      const bytes = result!.files[0].bytes;
      expect(bytes[0]).toBe(0x25); // %
      expect(bytes[1]).toBe(0x50); // P
      expect(bytes[2]).toBe(0x44); // D
      expect(bytes[3]).toBe(0x46); // F
    }, 60000);

    test("Markdown to HTML conversion", async () => {
      const result = await attemptConversion(
        context.page,
        [TestFixtures.MD_MARKDOWN],
        CommonFormats.MD,
        CommonFormats.HTML
      );

      expect(result).toBeDefined();
      TestAssertions.assertValidConversion(result, "text/markdown", "text/html");

      // Verify HTML output
      const text = new TextDecoder().decode(result!.files[0].bytes);
      expect(text.toLowerCase()).toContain("<html");
    }, 60000);
  });

  describe("Cross-Category Conversions", () => {
    test("PNG to MP4 (image to video)", async () => {
      const result = await attemptConversion(
        context.page,
        [TestFixtures.PNG_50X50],
        CommonFormats.PNG,
        CommonFormats.MP4
      );

      expect(result).toBeDefined();
      TestAssertions.assertValidConversion(result, "image/png", "video/mp4");
    }, 60000);

    test("MP3 to PNG (audio visualization to image)", async () => {
      const result = await attemptConversion(
        context.page,
        [TestFixtures.MP3_GASTER],
        CommonFormats.MP3,
        CommonFormats.PNG
      );

      expect(result).toBeDefined();
      TestAssertions.assertValidConversion(result, "audio/mpeg", "image/png");
    }, 60000);
  });

  describe("Multi-Step Conversions", () => {
    test("DOCX to PDF (multi-step via HTML and SVG)", async () => {
      const result = await attemptConversion(
        context.page,
        [TestFixtures.DOCX_WORD],
        CommonFormats.DOCX,
        CommonFormats.PDF
      );

      expect(result).toBeDefined();

      // Check that path has multiple steps
      expect(result!.path.length).toBeGreaterThan(2);

      // Verify the final output is PDF
      const lastFormat = result!.path[result!.path.length - 1].format.mime;
      expect(lastFormat).toBe("application/pdf");
    }, 60000);
  });
});
