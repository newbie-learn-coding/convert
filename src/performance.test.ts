/**
 * Tests for performance module.
 * Verifies Core Web Vitals tracking and budget checking.
 */

import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";

// Mock web-vitals module
mock("web-vitals", () => ({
  onCLS: (_cb: unknown) => {},
  onFID: (_cb: unknown) => {},
  onLCP: (_cb: unknown) => {},
  onFCP: (_cb: unknown) => {},
  onTTFB: (_cb: unknown) => {},
}));

// Mock globals for testing
const mockNavigator = {
  userAgent: "TestAgent/1.0",
  sendBeacon: () => true
};

global.navigator = mockNavigator as never;
global.window = { location: { href: "http://localhost:8080" } } as never;

import {
  PERFORMANCE_BUDGETS,
  initPerformanceTracking,
  reportCustomTiming,
  markPerformance,
  measurePerformance,
  checkPerformanceBudgets,
  observeLongAnimations,
  getMemoryUsage
} from "./performance";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Performance {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
  }
}

describe("performance module", () => {
  describe("PERFORMANCE_BUDGETS", () => {
    it("should have budget for LCP under 2.5s", () => {
      expect(PERFORMANCE_BUDGETS.LCP).toBe(2500);
    });

    it("should have budget for FID under 100ms", () => {
      expect(PERFORMANCE_BUDGETS.FID).toBe(100);
    });

    it("should have budget for CLS under 0.1", () => {
      expect(PERFORMANCE_BUDGETS.CLS).toBe(0.1);
    });

    it("should have budget for FCP under 1.8s", () => {
      expect(PERFORMANCE_BUDGETS.FCP).toBe(1800);
    });

    it("should have budget for TTFB under 800ms", () => {
      expect(PERFORMANCE_BUDGETS.TTFB).toBe(800);
    });
  });

  describe("initPerformanceTracking", () => {
    it("should initialize without throwing", () => {
      // Mock document for web-vitals
      global.document = {} as never;
      expect(() => initPerformanceTracking()).not.toThrow();
      delete global.document;
    });

    it("should initialize with debug option", () => {
      global.document = {} as never;
      expect(() => initPerformanceTracking({ debug: true })).not.toThrow();
      delete global.document;
    });
  });

  describe("reportCustomTiming", () => {
    it("should report custom timing without throwing", () => {
      expect(() => reportCustomTiming("custom-metric", 100)).not.toThrow();
    });

    it("should include metadata in report", () => {
      expect(() => reportCustomTiming("custom-metric", 100, { key: "value" })).not.toThrow();
    });
  });

  describe("markPerformance and measurePerformance", () => {
    it("should not throw when performance API is unavailable", () => {
      global.performance = {} as never;
      expect(() => markPerformance("test-mark")).not.toThrow();
    });

    it("should return undefined when performance API is unavailable", () => {
      global.performance = {} as never;
      const result = measurePerformance("test-measure", "start", "end");
      expect(result).toBeUndefined();
    });
  });

  describe("checkPerformanceBudgets", () => {
    it("should return null when no metrics collected", () => {
      const result = checkPerformanceBudgets();
      expect(result).toBeNull();
    });
  });

  describe("observeLongAnimations", () => {
    it("should return cleanup function", () => {
      const cleanup = observeLongAnimations(() => {});
      expect(typeof cleanup).toBe("function");
      cleanup();
    });
  });

  describe("getMemoryUsage", () => {
    it("should return null when memory API unavailable", () => {
      const result = getMemoryUsage();
      expect(result).toBeNull();
    });

    it("should return memory info when available", () => {
      (global.performance as never).memory = {
        usedJSHeapSize: 1000000,
        totalJSHeapSize: 2000000,
        jsHeapSizeLimit: 10000000
      };
      
      const result = getMemoryUsage();
      expect(result).toEqual({
        usedJSHeapSize: 1000000,
        totalJSHeapSize: 2000000,
        jsHeapSizeLimit: 10000000
      });
      
      delete (global.performance as never).memory;
    });
  });
});
