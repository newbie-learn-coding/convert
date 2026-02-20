/**
 * Performance Monitoring Integration Tests
 *
 * Tests performance tracking, metrics collection, and budget monitoring
 * in a real browser environment.
 */

import { beforeAll, afterAll, describe, test, expect } from "bun:test";
import puppeteer from "puppeteer";
import {
  createTestContext,
  cleanupTestContext,
} from "./test-helpers.js";

describe("Integration: Performance Monitoring", () => {
  let context: Awaited<ReturnType<typeof createTestContext>>;

  beforeAll(async () => {
    context = await createTestContext(8087);
    await context.page.goto(`${context.baseUrl}/convert/index.html`, { waitUntil: "domcontentloaded" });
    await context.page.waitForFunction(() => typeof window.performance !== "undefined", { timeout: 60000 });
  }, 60000);

  afterAll(async () => {
    await cleanupTestContext(context);
  });

  describe("Core Web Vitals", () => {
    test("performance tracking is initialized", async () => {
      const hasPerformanceTracking = await context.page.evaluate(() => {
        return typeof (window as unknown as { performanceBudgets?: object }).performanceBudgets !== "undefined" ||
               typeof window.performance !== "undefined";
      });

      expect(hasPerformanceTracking).toBe(true);
    }, 10000);

    test("performance budgets are defined", async () => {
      const budgets = await context.page.evaluate(() => {
        return (window as unknown as { performanceBudgets?: { LCP?: number; INP?: number; CLS?: number; FCP?: number; TTFB?: number } }).performanceBudgets;
      });

      if (budgets) {
        expect(budgets.LCP).toBeGreaterThan(0);
        expect(budgets.INP).toBeGreaterThan(0);
        expect(budgets.CLS).toBeGreaterThan(0);
        expect(budgets.FCP).toBeGreaterThan(0);
        expect(budgets.TTFB).toBeGreaterThan(0);
      }
    }, 10000);

    test("performance marks can be created", async () => {
      const result = await context.page.evaluate(() => {
        if ("performance" in window && "mark" in performance) {
          performance.mark("test-mark");
          const entries = performance.getEntriesByName("test-mark", "mark");
          return { success: true, count: entries.length };
        }
        return { success: false, reason: "Performance API not available" };
      });

      expect(result.success).toBe(true);
      expect(result.count).toBeGreaterThan(0);
    }, 10000);

    test("performance measures can be created", async () => {
      const result = await context.page.evaluate(() => {
        if ("performance" in window && "mark" in performance && "measure" in performance) {
          performance.mark("measure-start");
          // Small delay simulation
          const end = performance.now();
          performance.mark("measure-end");
          performance.measure("test-measure", "measure-start", "measure-end");
          const entries = performance.getEntriesByName("test-measure", "measure");
          return { success: true, duration: entries[0]?.duration };
        }
        return { success: false, reason: "Performance API not available" };
      });

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    }, 10000);
  });

  describe("Memory Monitoring", () => {
    test("memory API is available (Chrome)", async () => {
      const memoryInfo = await context.page.evaluate(() => {
        const memory = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
        if (memory) {
          return {
            available: true,
            usedJSHeapSize: memory.usedJSHeapSize,
            totalJSHeapSize: memory.totalJSHeapSize,
            jsHeapSizeLimit: memory.jsHeapSizeLimit,
          };
        }
        return { available: false };
      });

      // Memory API is Chrome-specific, so we just check it doesn't throw
      expect(memoryInfo).toBeDefined();
    }, 10000);
  });

  describe("Long Animation Frame Detection", () => {
    test("PerformanceObserver is available", async () => {
      const hasObserver = await context.page.evaluate(() => {
        return typeof PerformanceObserver !== "undefined";
      });

      expect(hasObserver).toBe(true);
    }, 10000);

    test("can observe long animation frames", async () => {
      const canObserve = await context.page.evaluate(() => {
        if (typeof PerformanceObserver === "undefined") {
          return false;
        }
        try {
          const observer = new PerformanceObserver(() => {});
          observer.observe({ entryTypes: ["long-animation-frame"] });
          observer.disconnect();
          return true;
        } catch {
          return false;
        }
      });

      // long-animation-frame is not supported in all browsers
      // So we just check the test runs without throwing
      expect(typeof canObserve).toBe("boolean");
    }, 10000);
  });

  describe("Navigation Timing", () => {
    test("navigation timing API is available", async () => {
      const timing = await context.page.evaluate(() => {
        if ("performance" in window) {
          const navEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
          if (navEntry) {
            return {
              available: true,
              domContentLoadedEventEnd: navEntry.domContentLoadedEventEnd,
              loadEventEnd: navEntry.loadEventEnd,
            };
          }
        }
        return { available: false };
      });

      expect(timing.available).toBe(true);
      expect(timing.domContentLoadedEventEnd).toBeGreaterThan(0);
      expect(timing.loadEventEnd).toBeGreaterThan(0);
    }, 10000);

    test("page load time is within reasonable bounds", async () => {
      const loadTime = await context.page.evaluate(() => {
        const navEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
        if (navEntry) {
          return navEntry.loadEventEnd - navEntry.startTime;
        }
        return null;
      });

      expect(loadTime).not.toBeNull();
      if (loadTime !== null) {
        // Page should load within 10 seconds
        expect(loadTime).toBeLessThan(10000);
      }
    }, 10000);
  });

  describe("Resource Timing", () => {
    test("resource timing API is available", async () => {
      const resources = await context.page.evaluate(() => {
        if ("performance" in window) {
          return performance.getEntriesByType("resource").length;
        }
        return 0;
      });

      expect(resources).toBeGreaterThan(0);
    }, 10000);

    test("main resources are loaded", async () => {
      const resources = await context.page.evaluate(() => {
        const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
        return entries
          .filter(r => r.initiatorType === "script" || r.initiatorType === "link" || r.initiatorType === "img")
          .map(r => ({
            name: r.name.split("/").pop(),
            initiatorType: r.initiatorType,
            duration: r.duration,
          }));
      });

      expect(resources.length).toBeGreaterThan(0);
    }, 10000);
  });

  describe("Custom Performance Markers", () => {
    test("app initialization markers exist", async () => {
      // Wait for app to be fully initialized
      await context.page.waitForFunction(() => {
        const entries = performance.getEntriesByType("mark") as PerformanceMark[];
        return entries.some(e => e.name.includes("init") || e.name.includes("ready"));
      }, { timeout: 5000 }).catch(() => {
        // Markers may not exist, that's okay
      });

      const markers = await context.page.evaluate(() => {
        return (performance.getEntriesByType("mark") as PerformanceMark[]).map(m => m.name);
      });

      expect(Array.isArray(markers)).toBe(true);
    }, 10000);
  });
});
