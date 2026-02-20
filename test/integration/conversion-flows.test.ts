/**
 * Conversion Flows Integration Tests
 *
 * Uses the current production graph behavior:
 * - assert successful routes for known-supported conversions
 * - assert null for unavailable conversion pairs
 */

import { beforeAll, afterAll, describe, test, expect } from "bun:test";
import CommonFormats from "../../src/CommonFormats.js";
import {
  createTestContext,
  cleanupTestContext,
  waitForAppReady,
  attemptConversion,
  TestFixtures
} from "./test-helpers.js";

type ConversionResult = Awaited<ReturnType<typeof attemptConversion>>;

const expectSupportedConversion = (
  result: ConversionResult,
  fromMime: string,
  toMime: string
) => {
  expect(result).toBeDefined();
  expect(result).not.toBeNull();
  expect(result!.files.length).toBeGreaterThan(0);
  const outputSize = Object.values(result!.files[0].bytes as Record<string, number>).length;
  expect(outputSize).toBeGreaterThan(0);
  expect(result!.path[0].format.mime).toBe(fromMime);
  expect(result!.path[result!.path.length - 1].format.mime).toBe(toMime);
};

const expectNoRoute = (result: ConversionResult) => {
  expect(result).toBeNull();
};

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

      expectSupportedConversion(result, "image/png", "image/jpeg");
    }, 60000);

    test("PNG to WEBP conversion produces valid output", async () => {
      const result = await attemptConversion(
        context.page,
        [TestFixtures.PNG_50X50],
        CommonFormats.PNG,
        CommonFormats.WEBP
      );

      expectSupportedConversion(result, "image/png", "image/webp");
    }, 60000);

    test("PNG to SVG returns no route when unavailable", async () => {
      const result = await attemptConversion(
        context.page,
        [TestFixtures.PNG_50X50],
        CommonFormats.PNG,
        CommonFormats.SVG
      );

      expectNoRoute(result);
    }, 60000);
  });

  describe("Audio Conversions", () => {
    test("MP3 to WAV conversion produces valid output", async () => {
      const result = await attemptConversion(
        context.page,
        [TestFixtures.MP3_GASTER],
        CommonFormats.MP3,
        CommonFormats.WAV
      );

      expectSupportedConversion(result, "audio/mpeg", "audio/wav");
    }, 60000);

    test("MP3 to OGG returns no route when unavailable", async () => {
      const result = await attemptConversion(
        context.page,
        [TestFixtures.MP3_GASTER],
        CommonFormats.MP3,
        CommonFormats.OGG
      );

      expectNoRoute(result);
    }, 60000);
  });

  describe("Document Conversions", () => {
    test("DOCX to HTML conversion produces valid output", async () => {
      const result = await attemptConversion(
        context.page,
        [TestFixtures.DOCX_WORD],
        CommonFormats.DOCX,
        CommonFormats.HTML
      );

      expectSupportedConversion(
        result,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/html"
      );
    }, 60000);

    test("DOCX to PDF returns no route when unavailable", async () => {
      const result = await attemptConversion(
        context.page,
        [TestFixtures.DOCX_WORD],
        CommonFormats.DOCX,
        CommonFormats.PDF
      );

      expectNoRoute(result);
    }, 60000);
  });

  describe("Video and Cross-Category Conversions", () => {
    test("MP4 to PNG returns no route when unavailable", async () => {
      const result = await attemptConversion(
        context.page,
        [TestFixtures.MP4_DOOM],
        CommonFormats.MP4,
        CommonFormats.PNG
      );

      expectNoRoute(result);
    }, 60000);

    test("PNG to MP4 returns no route when unavailable", async () => {
      const result = await attemptConversion(
        context.page,
        [TestFixtures.PNG_50X50],
        CommonFormats.PNG,
        CommonFormats.MP4
      );

      expectNoRoute(result);
    }, 60000);

    test("MP3 to PNG conversion produces valid output", async () => {
      const result = await attemptConversion(
        context.page,
        [TestFixtures.MP3_GASTER],
        CommonFormats.MP3,
        CommonFormats.PNG
      );

      expectSupportedConversion(result, "audio/mpeg", "image/png");
    }, 60000);
  });
});
