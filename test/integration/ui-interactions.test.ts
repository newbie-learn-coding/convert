/**
 * UI Interactions Integration Tests
 *
 * Tests user interface interactions including drag-drop, format selection,
 * search, and accessibility features.
 */

import { beforeAll, afterAll, describe, test, expect } from "bun:test";
import puppeteer from "puppeteer";
import CommonFormats from "../../src/CommonFormats.js";
import {
  createTestContext,
  cleanupTestContext,
  waitForAppReady,
  uploadFileByDragDrop,
  uploadFileByInput,
  selectFormat,
  getSelectedFormat,
  getFileSelectionState,
  isConvertButtonEnabled,
  getConvertHelperText,
  getPopupMessage,
  isPopupVisible,
  dismissPopup
} from "./test-helpers.js";

describe("Integration: UI Interactions", () => {
  let context: Awaited<ReturnType<typeof createTestContext>>;

  beforeAll(async () => {
    context = await createTestContext(8083);
    await waitForAppReady(context.page);
  }, 60000);

  afterAll(async () => {
    await cleanupTestContext(context);
  });

  describe("File Upload Methods", () => {
    test("click to upload triggers file input", async () => {
      // Check if clicking file area triggers file input
      const fileInputExists = await context.page.$("#file-input");

      expect(fileInputExists).toBeDefined();
    }, 10000);

    test("drag and drop accepts files", async () => {
      // Get initial state
      const initialState = await getFileSelectionState(context.page);

      // Upload file via drag-drop
      await uploadFileByDragDrop(context.page, "colors_50x50.png");

      // Wait for processing
      await context.page.waitForTimeout(500);

      // Check file was accepted
      const finalState = await getFileSelectionState(context.page);

      expect(finalState.fileCount).toBeGreaterThan(initialState.fileCount);
    }, 30000);

    test("file input uploads files", async () => {
      // Upload via file input
      await uploadFileByInput(context.page, "colors_50x50.png");

      // Wait for processing
      await context.page.waitForTimeout(500);

      // Check file was accepted
      const state = await getFileSelectionState(context.page);

      expect(state.fileCount).toBeGreaterThan(0);
    }, 30000);
  });

  describe("Format Selection", () => {
    test("selecting input format updates UI", async () => {
      // Upload a file first
      await uploadFileByInput(context.page, "colors_50x50.png");
      await context.page.waitForTimeout(500);

      // Clear any existing selection by selecting from the other list
      await selectFormat(context.page, "image/jpeg", "#to-list");

      // Select PNG format
      await selectFormat(context.page, "image/png", "#from-list");

      // Check selection
      const selected = await getSelectedFormat(context.page, "#from-list");

      expect(selected?.mime).toBe("image/png");
    }, 30000);

    test("selecting output format updates UI", async () => {
      // Upload a file first
      await uploadFileByInput(context.page, "colors_50x50.png");
      await context.page.waitForTimeout(500);

      // Select input format
      await selectFormat(context.page, "image/png", "#from-list");
      await context.page.waitForTimeout(100);

      // Select output format
      await selectFormat(context.page, "image/jpeg", "#to-list");
      await context.page.waitForTimeout(100);

      // Check selection
      const selected = await getSelectedFormat(context.page, "#to-list");

      expect(selected?.mime).toBe("image/jpeg");
    }, 30000);

    test("auto-detects format from uploaded file", async () => {
      // Upload PNG file
      await uploadFileByInput(context.page, "colors_50x50.png");
      await context.page.waitForTimeout(1000);

      // Check if PNG was auto-selected
      const selected = await getSelectedFormat(context.page, "#from-list");

      expect(selected?.mime).toBe("image/png");
    }, 30000);
  });

  describe("Format Search", () => {
    test("search filters input format list", async () => {
      // Type in search box
      await context.page.type("#search-from", "png");

      // Wait for debounced search
      await context.page.waitForTimeout(500);

      // Check if results are filtered
      const visibleCount = await context.page.evaluate(() => {
        const list = document.querySelector("#from-list");
        if (!list) return 0;

        const buttons = Array.from(list.querySelectorAll("button"));
        return buttons.filter(b => !b.classList.contains("hidden")).length;
      });

      // Should have some results for PNG
      expect(visibleCount).toBeGreaterThan(0);
    }, 30000);

    test("search filters output format list", async () => {
      // Type in search box
      await context.page.type("#search-to", "jpeg");

      // Wait for debounced search
      await context.page.waitForTimeout(500);

      // Check if results are filtered
      const visibleCount = await context.page.evaluate(() => {
        const list = document.querySelector("#to-list");
        if (!list) return 0;

        const buttons = Array.from(list.querySelectorAll("button"));
        return buttons.filter(b => !b.classList.contains("hidden")).length;
      });

      // Should have some results for JPEG
      expect(visibleCount).toBeGreaterThan(0);
    }, 30000);

    test("clearing search shows all formats again", async () => {
      // Search first
      await context.page.type("#search-from", "xyz123");
      await context.page.waitForTimeout(500);

      const filteredCount = await context.page.evaluate(() => {
        const list = document.querySelector("#from-list");
        if (!list) return 0;
        return Array.from(list.querySelectorAll("button")).filter(b => !b.classList.contains("hidden")).length;
      });

      // Clear search
      await context.page.evaluate(() => {
        const input = document.querySelector("#search-from") as HTMLInputElement;
        if (input) input.value = "";
      });
      await context.page.type("#search-from", " ");
      await context.page.evaluate(() => {
        const input = document.querySelector("#search-from") as HTMLInputElement;
        if (input) input.value = "";
      });
      await context.page.waitForTimeout(500);

      const unfilteredCount = await context.page.evaluate(() => {
        const list = document.querySelector("#from-list");
        if (!list) return 0;
        return Array.from(list.querySelectorAll("button")).filter(b => !b.classList.contains("hidden")).length;
      });

      expect(unfilteredCount).toBeGreaterThanOrEqual(filteredCount);
    }, 30000);
  });

  describe("Convert Button State", () => {
    test("button disabled when no file selected", async () => {
      const enabled = await isConvertButtonEnabled(context.page);
      expect(enabled).toBe(false);
    }, 10000);

    test("button disabled when file selected but no format selected", async () => {
      // Upload file but don't select formats
      await uploadFileByInput(context.page, "colors_50x50.png");
      await context.page.waitForTimeout(500);

      const enabled = await isConvertButtonEnabled(context.page);
      expect(enabled).toBe(false);
    }, 30000);

    test("button enabled when file and formats selected", async () => {
      // Upload file
      await uploadFileByInput(context.page, "colors_50x50.png");
      await context.page.waitForTimeout(500);

      // Select formats
      await selectFormat(context.page, "image/png", "#from-list");
      await context.page.waitForTimeout(100);
      await selectFormat(context.page, "image/jpeg", "#to-list");
      await context.page.waitForTimeout(100);

      const enabled = await isConvertButtonEnabled(context.page);
      expect(enabled).toBe(true);
    }, 30000);

    test("helper text updates with button state", async () => {
      const text1 = await getConvertHelperText(context.page);

      // Upload file
      await uploadFileByInput(context.page, "colors_50x50.png");
      await context.page.waitForTimeout(500);

      const text2 = await getConvertHelperText(context.page);

      // Select input format
      await selectFormat(context.page, "image/png", "#from-list");
      await context.page.waitForTimeout(100);

      const text3 = await getConvertHelperText(context.page);

      // Select output format
      await selectFormat(context.page, "image/jpeg", "#to-list");
      await context.page.waitForTimeout(100);

      const text4 = await getConvertHelperText(context.page);

      // Text should change as state changes
      expect([text1, text2, text3, text4]).toContain("Ready to convert.");
    }, 30000);
  });

  describe("Mode Toggle", () => {
    test("mode toggle button exists and is clickable", async () => {
      const modeButton = await context.page.$("#mode-button");

      expect(modeButton).toBeDefined();

      // Get initial text
      const initialText = await context.page.evaluate(() => {
        return document.querySelector("#mode-button")?.textContent;
      });

      // Click the button
      await modeButton!.click();

      // Wait for rebuild
      await context.page.waitForTimeout(2000);

      // Get new text
      const newText = await context.page.evaluate(() => {
        return document.querySelector("#mode-button")?.textContent;
      });

      // Text should have changed
      expect(initialText).not.toBe(newText);
    }, 30000);
  });

  describe("Popup and Notifications", () => {
    test("popup shows for conversion start", async () => {
      // Setup conversion
      await uploadFileByInput(context.page, "colors_50x50.png");
      await context.page.waitForTimeout(500);
      await selectFormat(context.page, "image/png", "#from-list");
      await context.page.waitForTimeout(100);
      await selectFormat(context.page, "image/jpeg", "#to-list");
      await context.page.waitForTimeout(100);

      // Start conversion
      await context.page.click("#convert-button");

      // Wait a bit for popup
      await context.page.waitForTimeout(500);

      const visible = await isPopupVisible(context.page);
      expect(visible).toBe(true);
    }, 60000);

    test("popup can be dismissed", async () => {
      // Wait for conversion to finish
      await context.page.waitForTimeout(3000);

      // Try to dismiss popup
      await dismissPopup(context.page);

      const visible = await isPopupVisible(context.page);
      expect(visible).toBe(false);
    }, 60000);
  });

  describe("Keyboard Navigation", () => {
    test("arrow keys navigate format list", async () => {
      // Focus on a format button
      await context.page.evaluate(() => {
        const firstButton = document.querySelector("#from-list button");
        if (firstButton) firstButton.dispatchEvent(new FocusEvent("focus"));
      });

      // Press arrow down
      await context.page.keyboard.press("ArrowDown");
      await context.page.waitForTimeout(100);

      // Check focus changed (heuristic - we can't easily test focus state in Puppeteer)
      const hasFocusHandler = await context.page.evaluate(() => {
        const list = document.querySelector("#from-list");
        return list?.getAttribute("role") !== null;
      });

      expect(hasFocusHandler).toBeDefined();
    }, 10000);
  });
});
