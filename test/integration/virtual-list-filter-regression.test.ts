/**
 * Virtual List Filter Regression Tests
 *
 * Ensures virtualized format lists render the correct items after filter changes.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { cleanupTestContext, createTestContext, waitForAppReady } from "./test-helpers.js";

describe("Integration: Virtual List Filter Regression", () => {
  let context: Awaited<ReturnType<typeof createTestContext>>;

  beforeAll(async () => {
    context = await createTestContext(8089);
    await waitForAppReady(context.page);
  }, 60000);

  afterAll(async () => {
    await cleanupTestContext(context);
  });

  test("search query changes re-render virtual rows with matching formats", async () => {
    const hasVirtualList = await context.page.evaluate(() => {
      return document.querySelector("#from-list .virtual-list-content") !== null;
    });

    if (!hasVirtualList) {
      // Environment with too few formats: nothing to regress here.
      expect(hasVirtualList).toBe(false);
      return;
    }

    const queries = await context.page.evaluate(() => {
      const buttons = Array.from(
        document.querySelectorAll("#from-list .virtual-list-content button")
      ) as HTMLButtonElement[];

      const result: string[] = [];
      for (const button of buttons) {
        const mime = (button.getAttribute("mime-type") || "").toLowerCase();
        const subtype = mime.split("/")[1];
        if (!subtype || subtype.length < 3 || result.includes(subtype)) continue;
        result.push(subtype);
        if (result.length === 2) break;
      }
      return result;
    });

    expect(queries.length).toBeGreaterThanOrEqual(2);
    const secondQuery = queries[1];

    const setQuery = async (query: string): Promise<void> => {
      await context.page.evaluate((value) => {
        const input = document.querySelector("#search-from") as HTMLInputElement | null;
        if (!input) throw new Error("Search input #search-from was not found.");
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }, query);
      await context.page.waitForTimeout(700);
    };

    // Prime the virtual list with one filter, then switch to another.
    await setQuery(queries[0]);
    await setQuery(secondQuery);

    const renderedRows = await context.page.evaluate(() => {
      const container = document.querySelector("#from-list .virtual-list-content");
      if (!container) return [] as { mime: string; text: string }[];

      return Array.from(container.querySelectorAll("button")).map(button => ({
        mime: (button.getAttribute("mime-type") || "").toLowerCase(),
        text: (button.textContent || "").toLowerCase()
      }));
    });

    expect(renderedRows.length).toBeGreaterThan(0);

    const mismatches = renderedRows.filter(
      row => !row.mime.includes(secondQuery) && !row.text.includes(secondQuery)
    );
    expect(mismatches).toHaveLength(0);
  }, 30000);
});
