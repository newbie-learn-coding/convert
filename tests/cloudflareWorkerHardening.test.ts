import { describe, expect, test } from "bun:test";
import worker from "../cloudflare/worker/index.mjs";

type AssetsBinding = { fetch: (request: Request) => Promise<Response> | Response };
type GlobalLimiterCall = {
  name: string;
  scope: string;
  clientId: string;
  limit: number;
  windowSeconds: number;
};

// Mock the caches API for Cloudflare Workers
globalThis.caches = {
  default: {
    match: async () => null,
    put: async () => {}
  }
} as unknown as CacheStorage;

function createEnv(overrides: Partial<Record<string, unknown>> = {}) {
  const assets: AssetsBinding = {
    fetch: () => new Response("asset-ok", { headers: { "cache-control": "public, max-age=60" } })
  };

  return {
    ENVIRONMENT: "production",
    APP_VERSION: "1.2.3",
    BUILD_SHA: "abc123",
    ASSETS: assets,
    ...overrides
  };
}

function createTelemetryPayload() {
  return {
    sessionId: "session-12345",
    appVersion: "1.2.3",
    entries: [
      {
        level: "info",
        message: "frontend log",
        timestamp: new Date().toISOString(),
        context: { category: "test" }
      }
    ],
    metrics: {
      conversionsSucceeded: 1
    }
  };
}

function createMockGlobalLimiterBinding() {
  const counters = new Map<string, { windowStart: number; count: number }>();
  const calls: GlobalLimiterCall[] = [];

  return {
    calls,
    binding: {
      getByName: (name: string) => ({
        consume: async ({ scope, clientId, limit, windowSeconds, now = Date.now() }: {
          scope: string;
          clientId: string;
          limit: number;
          windowSeconds: number;
          now?: number;
        }) => {
          calls.push({ name, scope, clientId, limit, windowSeconds });

          const safeWindowSeconds = Math.max(1, windowSeconds);
          const windowMs = safeWindowSeconds * 1000;
          const windowStart = Math.floor(now / windowMs) * windowMs;
          const key = `${scope}:${clientId}`;
          const entry = counters.get(key);
          const currentCount = entry && entry.windowStart === windowStart ? entry.count : 0;

          if (currentCount >= limit) {
            return {
              allowed: false,
              remaining: 0,
              resetAt: windowStart + windowMs,
              limit,
              windowSeconds: safeWindowSeconds,
              source: "global:durable_object"
            };
          }

          const nextCount = currentCount + 1;
          counters.set(key, { windowStart, count: nextCount });
          return {
            allowed: true,
            remaining: Math.max(0, limit - nextCount),
            resetAt: windowStart + windowMs,
            limit,
            windowSeconds: safeWindowSeconds,
            source: "global:durable_object"
          };
        }
      })
    }
  };
}

async function withSuppressedConsole(callback: () => Promise<void>) {
  const originalLog = console.log;
  const originalError = console.error;
  console.log = () => {};
  console.error = () => {};

  try {
    await callback();
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

describe("Cloudflare worker hardening", () => {
  test("redirects .app host to canonical .com host", async () => {
    const response = await worker.fetch(
      new Request("https://converttoit.app/format/png-to-jpg/?q=1"),
      createEnv()
    );

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://converttoit.com/format/png-to-jpg/?q=1");
  });

  test("redirects www host to canonical apex host", async () => {
    const response = await worker.fetch(new Request("https://www.converttoit.com/compare/"), createEnv());

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://converttoit.com/compare/");
  });

  test("adds noindex + security headers to ops responses", async () => {
    const response = await worker.fetch(new Request("https://converttoit.com/_ops/health"), createEnv());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });

  test("returns 405 for unsupported methods on /_ops routes", async () => {
    const response = await worker.fetch(new Request("https://converttoit.com/_ops/health", { method: "POST" }), createEnv());
    const body = await response.json();

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, HEAD");
    expect(body.error).toBe("method_not_allowed");
  });

  test("uses shared isolate-level ops limiter across requests", async () => {
    const env = createEnv();
    let lastResponse: Response | null = null;

    for (let index = 0; index < 101; index++) {
      lastResponse = await worker.fetch(
        new Request("https://converttoit.com/_ops/health", {
          headers: {
            "cf-connecting-ip": "203.0.113.101"
          }
        }),
        env
      );
    }

    expect(lastResponse).not.toBeNull();
    expect(lastResponse?.status).toBe(429);
    const body = await lastResponse!.json();
    expect(body.error).toBe("rate_limited");
  });

  test("uses durable object global limiter for /_ops when feature flag enabled", async () => {
    const mockGlobalLimiter = createMockGlobalLimiterBinding();
    const env = createEnv({
      RATE_LIMIT_GLOBAL_ENABLED: "true",
      RATE_LIMIT_GLOBAL_PROVIDER: "durable_object",
      RATE_LIMIT_GLOBAL_OPS_REQUESTS: "2",
      GLOBAL_RATE_LIMITER: mockGlobalLimiter.binding
    });

    const request = () =>
      new Request("https://converttoit.com/_ops/health", {
        headers: {
          "cf-connecting-ip": "203.0.113.210"
        }
      });

    const first = await worker.fetch(request(), env);
    const second = await worker.fetch(request(), env);
    const third = await worker.fetch(request(), env);
    const thirdBody = await third.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(thirdBody.source).toBe("global:durable_object");
    expect(third.headers.get("x-ratelimit-source")).toBe("global:durable_object");
    expect(mockGlobalLimiter.calls.length).toBe(3);
    expect(mockGlobalLimiter.calls[0]?.scope).toBe("ops");
  });

  test("falls back to isolate limiter when global limiter flag is enabled but DO binding is missing", async () => {
    const env = createEnv({
      RATE_LIMIT_GLOBAL_ENABLED: "true",
      RATE_LIMIT_GLOBAL_PROVIDER: "durable_object"
    });
    let lastResponse: Response | null = null;

    for (let index = 0; index < 101; index++) {
      lastResponse = await worker.fetch(
        new Request("https://converttoit.com/_ops/health", {
          headers: {
            "cf-connecting-ip": "203.0.113.211"
          }
        }),
        env
      );
    }

    expect(lastResponse).not.toBeNull();
    expect(lastResponse?.status).toBe(429);
    expect(lastResponse?.headers.get("x-ratelimit-source")).toBe("isolate");
  });

  test("enforces OPS_LOG_TOKEN on log-ping", async () => {
    const env = createEnv({ OPS_LOG_TOKEN: "super-secret-token" });
    const unauthorized = await worker.fetch(new Request("https://converttoit.com/_ops/log-ping"), env);
    const queryTokenAttempt = await worker.fetch(
      new Request("https://converttoit.com/_ops/log-ping?token=super-secret-token"),
      env
    );
    const authorized = await worker.fetch(
      new Request("https://converttoit.com/_ops/log-ping", {
        headers: { "x-ops-token": "super-secret-token" }
      }),
      env
    );

    expect(unauthorized.status).toBe(401);
    expect(queryTokenAttempt.status).toBe(401);
    expect(authorized.status).toBe(200);
  });

  test("requires configured metrics token and returns Prometheus format", async () => {
    const withoutToken = await worker.fetch(new Request("https://converttoit.com/_ops/metrics"), createEnv());
    const missingTokenBody = await withoutToken.json();
    expect(withoutToken.status).toBe(503);
    expect(missingTokenBody.error).toBe("metrics_token_missing");

    const env = createEnv({ OPS_METRICS_TOKEN: "metrics-secret-token" });
    await worker.fetch(new Request("https://converttoit.com/_ops/health"), env);

    const unauthorized = await worker.fetch(new Request("https://converttoit.com/_ops/metrics"), env);
    expect(unauthorized.status).toBe(401);

    const authorized = await worker.fetch(
      new Request("https://converttoit.com/_ops/metrics", {
        headers: { "x-ops-token": "metrics-secret-token" }
      }),
      env
    );
    const metricsText = await authorized.text();

    expect(authorized.status).toBe(200);
    expect(authorized.headers.get("content-type")).toContain("text/plain");
    expect(metricsText).toContain("converttoit_ops_requests_total");
    expect(metricsText).toContain("converttoit_ops_request_duration_seconds_bucket");
    expect(metricsText).toContain('endpoint="/_ops/health"');
  });

  test("supports json schema output for metrics endpoint", async () => {
    const env = createEnv({ OPS_METRICS_TOKEN: "metrics-json-token" });
    await worker.fetch(new Request("https://converttoit.com/_ops/version"), env);

    const response = await worker.fetch(
      new Request("https://converttoit.com/_ops/metrics?format=json", {
        headers: { "x-ops-token": "metrics-json-token" }
      }),
      env
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.schemaVersion).toBe("2026-02-20");
    expect(body.sloTargets.availability).toBe(0.999);
    expect(Array.isArray(body.requests)).toBe(true);
  });

  test("sanitizes and bounds correlation id", async () => {
    const noisyCorrelationId = "\nvery-long-value!!!__".repeat(20);
    const response = await worker.fetch(
      new Request(`https://converttoit.com/_ops/log-ping?id=${encodeURIComponent(noisyCorrelationId)}`),
      createEnv()
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(typeof body.correlationId).toBe("string");
    expect(body.correlationId.length).toBeLessThanOrEqual(64);
    expect(/^[A-Za-z0-9._:-]+$/.test(body.correlationId)).toBe(true);
  });

  test("accepts telemetry route alias and keeps noindex headers", async () => {
    const response = await worker.fetch(
      new Request("https://converttoit.com/_ops/logging", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://converttoit.com",
          "cf-connecting-ip": "198.51.100.23"
        },
        body: JSON.stringify(createTelemetryPayload())
      }),
      createEnv()
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  test("blocks cross-origin telemetry posts", async () => {
    const response = await worker.fetch(
      new Request("https://converttoit.com/_ops/logs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://malicious.example",
          "cf-connecting-ip": "198.51.100.24"
        },
        body: JSON.stringify(createTelemetryPayload())
      }),
      createEnv()
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("forbidden_origin");
  });

  test("uses shared isolate-level telemetry limiter across requests", async () => {
    const env = createEnv();
    let lastResponse: Response | null = null;

    await withSuppressedConsole(async () => {
      for (let index = 0; index < 51; index++) {
        lastResponse = await worker.fetch(
          new Request("https://converttoit.com/_ops/logs", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              origin: "https://converttoit.com",
              "cf-connecting-ip": "198.51.100.50"
            },
            body: JSON.stringify(createTelemetryPayload())
          }),
          env
        );
      }
    });

    expect(lastResponse).not.toBeNull();
    expect(lastResponse?.status).toBe(429);
    const body = await lastResponse!.json();
    expect(body.error).toBe("rate_limited");
    expect(lastResponse!.headers.get("x-ratelimit-limit")).toBe("50");
  });

  test("does not apply global limiter to telemetry unless telemetry flag is enabled", async () => {
    const mockGlobalLimiter = createMockGlobalLimiterBinding();
    const env = createEnv({
      RATE_LIMIT_GLOBAL_ENABLED: "true",
      RATE_LIMIT_GLOBAL_PROVIDER: "durable_object",
      RATE_LIMIT_GLOBAL_OPS_REQUESTS: "1",
      GLOBAL_RATE_LIMITER: mockGlobalLimiter.binding
    });

    const response = await worker.fetch(
      new Request("https://converttoit.com/_ops/logs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://converttoit.com",
          "cf-connecting-ip": "198.51.100.251"
        },
        body: JSON.stringify(createTelemetryPayload())
      }),
      env
    );

    expect(response.status).toBe(200);
    expect(mockGlobalLimiter.calls.length).toBe(0);
  });

  test("can enable global telemetry limiter via dedicated feature flag", async () => {
    const mockGlobalLimiter = createMockGlobalLimiterBinding();
    const env = createEnv({
      RATE_LIMIT_GLOBAL_ENABLED: "true",
      RATE_LIMIT_GLOBAL_PROVIDER: "durable_object",
      RATE_LIMIT_GLOBAL_TELEMETRY_ENABLED: "true",
      RATE_LIMIT_GLOBAL_TELEMETRY_REQUESTS: "1",
      GLOBAL_RATE_LIMITER: mockGlobalLimiter.binding
    });

    const request = () =>
      new Request("https://converttoit.com/_ops/logging", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://converttoit.com",
          "cf-connecting-ip": "198.51.100.252"
        },
        body: JSON.stringify(createTelemetryPayload())
      });

    const first = await worker.fetch(request(), env);
    const second = await worker.fetch(request(), env);
    const secondBody = await second.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(secondBody.source).toBe("global:durable_object");
    expect(second.headers.get("x-ratelimit-source")).toBe("global:durable_object");
    expect(mockGlobalLimiter.calls[0]?.scope).toBe("telemetry");
  });

  test("returns empty body for HEAD ops requests", async () => {
    const response = await worker.fetch(new Request("https://converttoit.com/_ops/version", { method: "HEAD" }), createEnv());
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toBe("");
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  test("preserves existing asset security headers and fills missing defaults", async () => {
    const env = createEnv({
      ASSETS: {
        fetch: () =>
          new Response("ok", {
            headers: {
              "x-frame-options": "SAMEORIGIN"
            }
          })
      }
    });

    const response = await worker.fetch(
      new Request("https://converttoit.com/style.css"),
      env,
      {}
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });
});
