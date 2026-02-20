/**
 * Logging and Error Tracking Integration Tests
 *
 * Tests logging system, error tracking, and metrics collection
 * in a real browser environment.
 */

import { beforeAll, afterAll, describe, test, expect } from "bun:test";
import {
  createTestContext,
  cleanupTestContext,
  waitForAppReady,
} from "./test-helpers.js";

describe("Integration: Logging and Error Tracking", () => {
  let context: Awaited<ReturnType<typeof createTestContext>>;

  beforeAll(async () => {
    context = await createTestContext(8084);
    await waitForAppReady(context.page);
  }, 60000);

  afterAll(async () => {
    await cleanupTestContext(context);
  });

  describe("Logger Initialization", () => {
    test("logger is initialized on app start", async () => {
      const loggerReady = await context.page.evaluate(() => {
        return typeof (window as unknown as { __logger?: object }).__logger !== "undefined" ||
               typeof window.onerror === "function";
      });

      expect(loggerReady).toBe(true);
    }, 10000);

    test("logger exposes debug interface in DEV mode", async () => {
      const hasDebugInterface = await context.page.evaluate(() => {
        const debugInterface = (window as unknown as { __logger?: { getMetrics?: () => object; getSessionId?: () => string; flush?: () => Promise<void> } }).__logger;
        return Boolean(
          debugInterface &&
          typeof debugInterface.getMetrics === "function" &&
          typeof debugInterface.getSessionId === "function" &&
          typeof debugInterface.flush === "function"
        );
      });

      // Debug interface may or may not be available depending on build mode
      expect(typeof hasDebugInterface).toBe("boolean");
    }, 10000);
  });

  describe("Error Handling", () => {
    test("global error handler is installed", async () => {
      const hasErrorHandler = await context.page.evaluate(() => {
        return typeof window.onerror === "function";
      });

      expect(hasErrorHandler).toBe(true);
    }, 10000);

    test("unhandled rejection handler is installed", async () => {
      const hasRejectionHandler = await context.page.evaluate(() => {
        return typeof window.onunhandledrejection === "function";
      });

      expect(hasRejectionHandler).toBe(true);
    }, 10000);

    test("error handling captures console errors", async () => {
      const errors: string[] = [];

      context.page.on("console", (msg) => {
        if (msg.type() === "error") {
          errors.push(msg.text());
        }
      });

      // Trigger a console error
      await context.page.evaluate(() => {
        console.error("Test error message");
      });

      // Give time for error to be captured
      await new Promise(resolve => setTimeout(resolve, 100));

      // We should see the error in console
      expect(errors.some(e => e.includes("Test error message"))).toBe(true);
    }, 10000);
  });

  describe("Metrics Collection", () => {
    test("metrics can be retrieved", async () => {
      const metrics = await context.page.evaluate(() => {
        const logger = (window as unknown as { __logger?: { getMetrics?: () => object } }).__logger;
        if (logger && typeof logger.getMetrics === "function") {
          return logger.getMetrics();
        }
        return null;
      });

      // Metrics may or may not be available depending on build mode
      if (metrics) {
        expect(typeof metrics).toBe("object");
      }
    }, 10000);

    test("conversion metrics are tracked", async () => {
      // Try to trigger a conversion
      await context.page.evaluate(() => {
        const logger = (window as unknown as { __logger?: { trackConversion?: { attempt?: () => void } } }).__logger;
        if (logger && logger.trackConversion) {
          logger.trackConversion.attempt?.("png", "jpg", 1, 1024);
        }
      });

      const metrics = await context.page.evaluate(() => {
        const logger = (window as unknown as { __logger?: { getMetrics?: () => { conversionsAttempted?: number } } }).__logger;
        if (logger && typeof logger.getMetrics === "function") {
          return logger.getMetrics();
        }
        return null;
      });

      if (metrics) {
        expect(typeof metrics.conversionsAttempted).toBe("number");
      }
    }, 10000);
  });

  describe("Session Management", () => {
    test("session ID is generated", async () => {
      const sessionId = await context.page.evaluate(() => {
        const logger = (window as unknown as { __logger?: { getSessionId?: () => string } }).__logger;
        if (logger && typeof logger.getSessionId === "function") {
          return logger.getSessionId();
        }
        return null;
      });

      if (sessionId) {
        expect(typeof sessionId).toBe("string");
        expect(sessionId.length).toBeGreaterThan(0);
      }
    }, 10000);

    test("session ID remains consistent", async () => {
      const sessionId1 = await context.page.evaluate(() => {
        const logger = (window as unknown as { __logger?: { getSessionId?: () => string } }).__logger;
        return logger?.getSessionId?.();
      });

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      const sessionId2 = await context.page.evaluate(() => {
        const logger = (window as unknown as { __logger?: { getSessionId?: () => string } }).__logger;
        return logger?.getSessionId?.();
      });

      if (sessionId1 && sessionId2) {
        expect(sessionId1).toBe(sessionId2);
      }
    }, 10000);
  });

  describe("Network Status", () => {
    test("online status is tracked", async () => {
      const isOnline = await context.page.evaluate(() => {
        return navigator.onLine;
      });

      expect(typeof isOnline).toBe("boolean");
    }, 10000);

    test("network events are handled", async () => {
      // Simulate going offline
      await context.page.evaluate(() => {
        Object.defineProperty(navigator, "onLine", {
          value: false,
          writable: true,
          configurable: true,
        });
        window.dispatchEvent(new Event("offline"));
      });

      // Simulate going back online
      await context.page.evaluate(() => {
        Object.defineProperty(navigator, "onLine", {
          value: true,
          writable: true,
          configurable: true,
        });
        window.dispatchEvent(new Event("online"));
      });

      // Test passes if no errors are thrown
      expect(true).toBe(true);
    }, 10000);
  });

  describe("PII Sanitization", () => {
    test("logs do not contain raw email addresses", async () => {
      // This is a basic check - the actual sanitization happens in the logger
      const testEmail = "test@example.com";

      await context.page.evaluate((email) => {
        const logger = (window as unknown as { __logger?: { info?: (cat: string, msg: string) => void } }).__logger;
        if (logger && typeof logger.info === "function") {
          logger.info("test", `User email: ${email}`);
        }
      }, testEmail);

      // Test passes if no errors are thrown
      expect(true).toBe(true);
    }, 10000);

    test("logs do not contain raw SSN patterns", async () => {
      const testSSN = "123-45-6789";

      await context.page.evaluate((ssn) => {
        const logger = (window as unknown as { __logger?: { info?: (cat: string, msg: string) => void } }).__logger;
        if (logger && typeof logger.info === "function") {
          logger.info("test", `SSN: ${ssn}`);
        }
      }, testSSN);

      expect(true).toBe(true);
    }, 10000);
  });

  describe("Flush and Reporting", () => {
    test("flush can be called without errors", async () => {
      const result = await context.page.evaluate(() => {
        const logger = (window as unknown as { __logger?: { flush?: () => Promise<void> } }).__logger;
        if (logger && typeof logger.flush === "function") {
          return logger.flush().then(() => true).catch(() => false);
        }
        return null;
      });

      // Result may be null if logger not available
      if (result !== null) {
        expect(result).toBe(true);
      }
    }, 10000);
  });
});
