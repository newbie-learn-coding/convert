const CANONICAL_ORIGIN = "https://converttoit.com";
const REDIRECT_SOURCE_HOSTS = new Set([
  "converttoit.app",
  "www.converttoit.app",
  "www.converttoit.com"
]);

const CACHE_CONFIG = {
  STATIC_ASSETS: {
    browserTTL: 31536000,
    edgeTTL: 31536000,
    staleWhileRevalidate: 86400,
    immutable: true
  },
  HTML: {
    browserTTL: 0,
    edgeTTL: 300,
    staleWhileRevalidate: 60
  },
  PSEO_PAGES: {
    browserTTL: 3600,
    edgeTTL: 86400,
    staleWhileRevalidate: 86400
  },
  WASM: {
    browserTTL: 604800,
    edgeTTL: 604800,
    staleWhileRevalidate: 86400
  },
  API: {
    browserTTL: 0,
    edgeTTL: 60,
    staleWhileRevalidate: 30
  }
};

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-robots-tag": "noindex, nofollow, noarchive"
};

const CACHE_CONTROL_DIRECTIVES = {
  staticAssets: `public, max-age=${CACHE_CONFIG.STATIC_ASSETS.browserTTL}, s-maxage=${CACHE_CONFIG.STATIC_ASSETS.edgeTTL}, stale-while-revalidate=${CACHE_CONFIG.STATIC_ASSETS.staleWhileRevalidate}, immutable`,
  html: `public, max-age=${CACHE_CONFIG.HTML.browserTTL}, s-maxage=${CACHE_CONFIG.HTML.edgeTTL}, stale-while-revalidate=${CACHE_CONFIG.HTML.staleWhileRevalidate}, must-revalidate`,
  pseoPages: `public, max-age=${CACHE_CONFIG.PSEO_PAGES.browserTTL}, s-maxage=${CACHE_CONFIG.PSEO_PAGES.edgeTTL}, stale-while-revalidate=${CACHE_CONFIG.PSEO_PAGES.staleWhileRevalidate}`,
  wasm: `public, max-age=${CACHE_CONFIG.WASM.browserTTL}, s-maxage=${CACHE_CONFIG.WASM.edgeTTL}, stale-while-revalidate=${CACHE_CONFIG.WASM.staleWhileRevalidate}`,
  api: `public, max-age=${CACHE_CONFIG.API.browserTTL}, s-maxage=${CACHE_CONFIG.API.edgeTTL}, stale-while-revalidate=${CACHE_CONFIG.API.staleWhileRevalidate}`,
  noCache: "no-store, no-cache, must-revalidate, private"
};

const RATE_LIMIT_CONFIG = {
  requests: 100,
  window: 60
};

const TELEMETRY_RATE_LIMIT_CONFIG = {
  requests: 50,
  window: 60
};

const ERROR_TRACKING = {
  maxErrorsPerWindow: 50,
  windowMs: 60000,
  sampledErrors: []
};

const PERFORMANCE_THRESHOLDS = {
  slowRequestMs: 1000,
  criticalSlowMs: 3000
};

const DEFAULT_SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "x-xss-protection": "1; mode=block",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy":
    "accelerometer=(), autoplay=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()",
  "x-permitted-cross-domain-policies": "none",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "strict-transport-security": "max-age=31536000; includeSubDomains; preload"
};

const OPS_ALLOWED_METHODS = new Set(["GET", "HEAD"]);
const LOGGING_ALLOWED_METHODS = new Set(["POST", "OPTIONS"]);
const TELEMETRY_ROUTE_PATHS = new Set(["/_ops/logs", "/_ops/logging"]);
const MAX_CORRELATION_ID_LENGTH = 64;
const CORRELATION_ID_SAFE_CHARS = /[^A-Za-z0-9._:-]/g;
const RATE_LIMITER_CLEANUP_SAMPLE_RATE = 0.01;

const METRICS_PREFIX = "cf_worker_";

function mergeDefaultHeaders(headers, defaults) {
  for (const [key, value] of Object.entries(defaults)) {
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  }
}

function getCacheControlForPath(pathname) {
  if (pathname.startsWith("/assets/")) {
    return CACHE_CONTROL_DIRECTIVES.staticAssets;
  }
  if (pathname.startsWith("/icons/")) {
    return CACHE_CONTROL_DIRECTIVES.staticAssets;
  }
  if (pathname.startsWith("/wasm/")) {
    return CACHE_CONTROL_DIRECTIVES.wasm;
  }
  if (pathname.startsWith("/format/") || pathname.startsWith("/compare/")) {
    return CACHE_CONTROL_DIRECTIVES.pseoPages;
  }
  if (pathname.endsWith(".html") || pathname === "/") {
    return CACHE_CONTROL_DIRECTIVES.html;
  }
  if (pathname.match(/\.(js|css)$/)) {
    return CACHE_CONTROL_DIRECTIVES.staticAssets;
  }
  if (pathname.match(/\.(ico|svg|png|webp|jpg|jpeg)$/)) {
    return CACHE_CONTROL_DIRECTIVES.pseoPages;
  }
  if (pathname === "/robots.txt" || pathname === "/sitemap.xml") {
    return `public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400`;
  }
  return CACHE_CONTROL_DIRECTIVES.html;
}

function recordMetric(env, name, value, tags = {}) {
  if (!env.METRICS) return;
  try {
    const metricName = `${METRICS_PREFIX}${name}`;
    const tagString = Object.entries(tags)
      .map(([k, v]) => `${k}="${v}"`)
      .join(",");
    env.METRICS.write(`# TYPE ${metricName} counter\n${metricName}{${tagString}} ${value}\n`);
  } catch (e) {
    // Silently fail metrics to avoid impacting requests
  }
}

function logError(env, error, context = {}) {
  try {
    const errorPayload = {
      event: "worker_error",
      timestamp: new Date().toISOString(),
      error: {
        message: error.message?.slice(0, 200) || "unknown",
        name: error.name || "Error",
        stack: error.stack?.split("\n")[0]?.slice(0, 100) || null
      },
      context: {
        ...context,
        environment: env.ENVIRONMENT || "unknown"
      }
    };
    console.error(JSON.stringify(errorPayload));
  } catch (e) {
    // Fallback logging
    console.error("[worker] Error logging failed:", error.message);
  }
}

function logPerformance(env, duration, pathname, status, context = {}) {
  try {
    const isSlow = duration > PERFORMANCE_THRESHOLDS.slowRequestMs;
    const isCritical = duration > PERFORMANCE_THRESHOLDS.criticalSlowMs;

    if (isSlow || isCritical) {
      const perfPayload = {
        event: isCritical ? "performance_critical" : "performance_slow",
        timestamp: new Date().toISOString(),
        duration,
        pathname: pathname?.slice(0, 100) || "unknown",
        status,
        threshold: isCritical ? PERFORMANCE_THRESHOLDS.criticalSlowMs : PERFORMANCE_THRESHOLDS.slowRequestMs,
        context: {
          ...context,
          environment: env.ENVIRONMENT || "unknown"
        }
      };
      console.warn(JSON.stringify(perfPayload));
    }
  } catch (e) {
    // Silently fail performance logging
  }
}

function withCacheHeaders(response, pathname, options = {}) {
  const headers = new Headers(response.headers);
  const existingCacheControl = headers.get("cache-control");

  if (options.skipCacheHeader || (existingCacheControl && !options.overrideCache)) {
    return response;
  }

  const cacheControl = getCacheControlForPath(pathname);
  headers.set("cache-control", cacheControl);

  const url = new URL(pathname, "https://example.com");
  const ext = url.pathname.split(".").pop();

  if (["js", "css", "wasm", "png", "jpg", "jpeg", "webp", "svg", "ico"].includes(ext)) {
    const etag = response.headers.get("etag");
    if (!etag) {
      const weakEtag = `W/"${response.headers.get("content-length") || "0"}"`;
      headers.set("etag", weakEtag);
    }
  }

  headers.set("vary", "Accept-Encoding");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function withHeaders(response, defaults = {}) {
  const headers = new Headers(response.headers);
  mergeDefaultHeaders(headers, defaults);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

class RateLimiter {
  constructor(limit, windowSeconds) {
    this.limit = limit;
    this.windowMs = windowSeconds * 1000;
    this.requests = new Map();
  }

  check(clientId, now = Date.now()) {
    const clientData = this.requests.get(clientId);
    if (!clientData) {
      this.requests.set(clientId, { count: 1, windowStart: now });
      return { allowed: true, remaining: this.limit - 1 };
    }

    if (now - clientData.windowStart > this.windowMs) {
      clientData.count = 1;
      clientData.windowStart = now;
      this.requests.set(clientId, clientData);
      return { allowed: true, remaining: this.limit - 1 };
    }

    if (clientData.count >= this.limit) {
      return { allowed: false, remaining: 0, resetAt: clientData.windowStart + this.windowMs };
    }

    clientData.count++;
    this.requests.set(clientId, clientData);
    return { allowed: true, remaining: this.limit - clientData.count };
  }

  cleanup(now = Date.now()) {
    const cutoff = now - this.windowMs * 2;
    for (const [clientId, data] of this.requests.entries()) {
      if (data.windowStart < cutoff) {
        this.requests.delete(clientId);
      }
    }
  }
}

const SHARED_RATE_LIMITERS = {
  ops: new RateLimiter(RATE_LIMIT_CONFIG.requests, RATE_LIMIT_CONFIG.window),
  telemetry: new RateLimiter(TELEMETRY_RATE_LIMIT_CONFIG.requests, TELEMETRY_RATE_LIMIT_CONFIG.window)
};

function maybeCleanupRateLimiters(now = Date.now()) {
  if (Math.random() >= RATE_LIMITER_CLEANUP_SAMPLE_RATE) {
    return;
  }

  SHARED_RATE_LIMITERS.ops.cleanup(now);
  SHARED_RATE_LIMITERS.telemetry.cleanup(now);
}

function getClientIdentifier(request) {
  const cf = request.cf;
  if (cf?.colo) {
    return `${request.headers.get("cf-connecting-ip") || "unknown"}_${cf.colo}`;
  }
  return request.headers.get("cf-connecting-ip") || "unknown";
}

function getCanonicalRedirectResponse(request, env) {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
  const shouldRedirectHost = REDIRECT_SOURCE_HOSTS.has(host);
  const shouldUpgradeCanonicalHost = host === "converttoit.com" && url.protocol === "http:";

  if (!shouldRedirectHost && !shouldUpgradeCanonicalHost) {
    return null;
  }

  recordMetric(env, "redirect", 1, {
    from: host,
    type: shouldRedirectHost ? "canonical" : "https_upgrade"
  });

  const canonicalUrl = new URL(CANONICAL_ORIGIN);
  canonicalUrl.pathname = url.pathname;
  canonicalUrl.search = url.search;
  canonicalUrl.hash = url.hash;

  return withHeaders(Response.redirect(canonicalUrl.toString(), 301), {
    ...DEFAULT_SECURITY_HEADERS,
    "cache-control": "public, max-age=86400, immutable",
    "x-redirected-from": host
  });
}

function jsonResponse(payload, init = {}, requestMethod = "GET") {
  const headers = new Headers(init.headers || {});
  mergeDefaultHeaders(headers, JSON_HEADERS);
  mergeDefaultHeaders(headers, DEFAULT_SECURITY_HEADERS);

  const body = requestMethod === "HEAD" ? null : JSON.stringify(payload);
  return new Response(body, {
    ...init,
    headers
  });
}

function readVersion(env) {
  return {
    service: "converttoit.com",
    environment: env.ENVIRONMENT || "unknown",
    appVersion: env.APP_VERSION || "unknown",
    buildSha: env.BUILD_SHA || "unknown"
  };
}

function requireOpsToken(request, env) {
  const expected = env.OPS_LOG_TOKEN;
  if (!expected) {
    return true;
  }

  const headerToken = request.headers.get("x-ops-token");
  return headerToken === expected;
}

function makeRequestId(request) {
  return request.headers.get("cf-ray") || crypto.randomUUID();
}

function sanitizeCorrelationId(rawValue) {
  if (!rawValue || typeof rawValue !== "string") {
    return null;
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.replace(CORRELATION_ID_SAFE_CHARS, "-").slice(0, MAX_CORRELATION_ID_LENGTH);
}

/**
 * Sanitizes metrics object to ensure it only contains safe numeric values
 * @param metrics The raw metrics object
 * @returns Sanitized metrics object
 */
function sanitizeMetrics(metrics) {
  if (!metrics || typeof metrics !== "object") {
    return {};
  }

  const sanitized = {};
  const allowedKeys = ["conversionsSucceeded", "conversionsFailed", "handlersFailed", "wasmLoadsFailed"];

  for (const key of allowedKeys) {
    if (typeof metrics[key] === "number" && Number.isFinite(metrics[key])) {
      sanitized[key] = Math.max(0, Math.floor(metrics[key]));
    }
  }

  return sanitized;
}

function ensureOpsMethod(request, requestId) {
  if (OPS_ALLOWED_METHODS.has(request.method)) {
    return null;
  }

  return jsonResponse({
    error: "method_not_allowed",
    requestId
  }, {
    status: 405,
    headers: {
      allow: "GET, HEAD"
    }
  }, request.method);
}

function isAllowedTelemetryRequest(request) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const normalizedOrigin = new URL(origin).origin;
      if (normalizedOrigin !== CANONICAL_ORIGIN) {
        return false;
      }
    } catch (error) {
      return false;
    }
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "same-site" && fetchSite !== "none") {
    return false;
  }

  return true;
}

async function handleClientLogRoute(request, env, pathname, rateLimiter) {
  if (!TELEMETRY_ROUTE_PATHS.has(pathname)) {
    return null;
  }

  const requestId = makeRequestId(request);

  if (!LOGGING_ALLOWED_METHODS.has(request.method)) {
    return jsonResponse({
      error: "method_not_allowed",
      requestId
    }, {
      status: 405,
      headers: {
        allow: "POST, OPTIONS"
      }
    }, request.method);
  }

  if (!isAllowedTelemetryRequest(request)) {
    return jsonResponse({
      error: "forbidden_origin",
      requestId
    }, { status: 403 }, request.method);
  }

  if (request.method === "OPTIONS") {
    const preflightHeaders = new Headers({
      "access-control-allow-origin": CANONICAL_ORIGIN,
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "86400"
    });
    mergeDefaultHeaders(preflightHeaders, JSON_HEADERS);
    mergeDefaultHeaders(preflightHeaders, DEFAULT_SECURITY_HEADERS);

    return new Response(null, {
      status: 204,
      headers: preflightHeaders
    });
  }

  const clientId = getClientIdentifier(request);
  const rateLimitResult = rateLimiter.check(clientId);
  if (!rateLimitResult.allowed) {
    const retryAfter = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000);
    recordMetric(env, "rate_limit_exceeded", 1, { endpoint: pathname });
    return jsonResponse({
      error: "rate_limited",
      requestId,
      retryAfter
    }, {
      status: 429,
      headers: {
        "retry-after": retryAfter.toString(),
        "x-ratelimit-limit": TELEMETRY_RATE_LIMIT_CONFIG.requests.toString(),
        "x-ratelimit-remaining": "0"
      }
    }, request.method);
  }

  try {
    const payload = await request.json();

    // Validate required fields
    if (!payload.sessionId || !payload.entries || !Array.isArray(payload.entries)) {
      return jsonResponse({
        error: "invalid_payload",
        requestId
      }, { status: 400 });
    }

    // Validate payload size limits
    if (payload.entries.length > 100) {
      return jsonResponse({
        error: "too_many_entries",
        requestId,
        message: "Maximum 100 entries allowed per request"
      }, { status: 413 });
    }

    // Sanitize and validate sessionId
    const sanitizedSessionId = String(payload.sessionId).replace(/[^a-zA-Z0-9_-]/g, "").substring(0, 32);
    if (!sanitizedSessionId || sanitizedSessionId.length < 8) {
      return jsonResponse({
        error: "invalid_session_id",
        requestId
      }, { status: 400 });
    }

    // Validate appVersion if provided
    const sanitizedAppVersion = payload.appVersion
      ? String(payload.appVersion).replace(/[^a-zA-Z0-9._-]/g, "").substring(0, 32)
      : "unknown";

    // Log the structured error report
    const logLine = {
      event: "client_error_report",
      timestamp: new Date().toISOString(),
      requestId,
      sessionId: sanitizedSessionId.substring(0, 16), // Truncate for privacy
      appVersion: sanitizedAppVersion,
      environment: env.ENVIRONMENT || "unknown",
      entryCount: payload.entries.length,
      metrics: sanitizeMetrics(payload.metrics),
      colo: request.cf?.colo || "unknown",
      country: request.cf?.country || "unknown",
      telemetryPath: pathname
    };

    console.log(JSON.stringify(logLine));

    // Record metrics from the report
    if (payload.metrics && typeof payload.metrics === "object") {
      const metrics = payload.metrics;
      if (typeof metrics.conversionsSucceeded === "number" && metrics.conversionsSucceeded > 0) {
        recordMetric(env, "conversion_success", Math.min(metrics.conversionsSucceeded, 1000));
      }
      if (typeof metrics.conversionsFailed === "number" && metrics.conversionsFailed > 0) {
        recordMetric(env, "conversion_failure", Math.min(metrics.conversionsFailed, 1000));
      }
      if (typeof metrics.handlersFailed === "number" && metrics.handlersFailed > 0) {
        recordMetric(env, "handler_init_failure", Math.min(metrics.handlersFailed, 100));
      }
      if (typeof metrics.wasmLoadsFailed === "number" && metrics.wasmLoadsFailed > 0) {
        recordMetric(env, "wasm_load_failure", Math.min(metrics.wasmLoadsFailed, 100));
      }
    }

    // Log individual critical/warn entries
    for (const entry of payload.entries.slice(0, 20)) {
      if (!entry || typeof entry !== "object") continue;

      const level = String(entry.level || "").toLowerCase();
      if (level === "critical" || level === "error") {
        const sanitizedMessage = entry.message
          ? String(entry.message).substring(0, 200).replace(/[\x00-\x1F\x7F]/g, "")
          : "";
        const sanitizedCategory = entry.context?.category
          ? String(entry.context.category).replace(/[^a-zA-Z0-9_-]/g, "").substring(0, 50)
          : "unknown";

        console.error(JSON.stringify({
          event: "client_error",
          level: level,
          category: sanitizedCategory,
          message: sanitizedMessage,
          timestamp: entry.timestamp
        }));
      }
    }

    return jsonResponse({
      ok: true,
      requestId,
      processed: Math.min(payload.entries.length, 100)
    });
  } catch (parseError) {
    return jsonResponse({
      error: "invalid_json",
      requestId,
      message: "Invalid JSON payload"
    }, { status: 400 });
  }
}

async function handleOpsRoute(request, env, pathname, rateLimiter) {
  if (!pathname.startsWith("/_ops/")) {
    return null;
  }

  const requestId = makeRequestId(request);
  const clientId = getClientIdentifier(request);
  const rateLimitResult = rateLimiter.check(clientId);

  if (!rateLimitResult.allowed) {
    recordMetric(env, "rate_limit_exceeded", 1, { endpoint: pathname });
    return jsonResponse({
      error: "rate_limited",
      requestId,
      retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)
    }, {
      status: 429,
      headers: {
        "retry-after": Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString(),
        "x-ratelimit-limit": RATE_LIMIT_CONFIG.requests.toString(),
        "x-ratelimit-remaining": "0"
      }
    }, request.method);
  }

  const invalidMethodResponse = ensureOpsMethod(request, requestId);
  if (invalidMethodResponse) {
    return invalidMethodResponse;
  }

  if (pathname === "/_ops/health") {
    recordMetric(env, "health_check", 1, { status: "ok" });
    return jsonResponse({
      status: "ok",
      timestamp: new Date().toISOString(),
      requestId,
      rateLimit: {
        limit: RATE_LIMIT_CONFIG.requests,
        remaining: rateLimitResult.remaining
      },
      ...readVersion(env)
    }, {}, request.method);
  }

  if (pathname === "/_ops/version") {
    return jsonResponse({
      timestamp: new Date().toISOString(),
      requestId,
      ...readVersion(env)
    }, {}, request.method);
  }

  if (pathname === "/_ops/metrics") {
    if (!requireOpsToken(request, env)) {
      return jsonResponse({
        error: "unauthorized",
        requestId
      }, { status: 401 }, request.method);
    }

    return jsonResponse({
      timestamp: new Date().toISOString(),
      requestId,
      metrics: {
        rateLimit: {
          limit: RATE_LIMIT_CONFIG.requests,
          window: RATE_LIMIT_CONFIG.window
        }
      }
    }, {}, request.method);
  }

  if (pathname === "/_ops/log-ping") {
    if (!requireOpsToken(request, env)) {
      return jsonResponse({
        error: "unauthorized",
        requestId
      }, { status: 401 }, request.method);
    }

    const url = new URL(request.url);
    const correlationId =
      sanitizeCorrelationId(request.headers.get("x-correlation-id")) ||
      sanitizeCorrelationId(url.searchParams.get("id")) ||
      crypto.randomUUID();

    const logPayload = {
      event: "ops.log_ping",
      timestamp: new Date().toISOString(),
      requestId,
      correlationId,
      environment: env.ENVIRONMENT || "unknown"
    };

    console.log(JSON.stringify(logPayload));
    recordMetric(env, "log_ping", 1, { environment: env.ENVIRONMENT || "unknown" });

    return jsonResponse({
      ok: true,
      ...logPayload
    }, {}, request.method);
  }

  return jsonResponse({
    error: "not_found",
    requestId
  }, { status: 404 }, request.method);
}

export default {
  async fetch(request, env, ctx) {
    const startTime = Date.now();
    maybeCleanupRateLimiters(startTime);

    const url = new URL(request.url);
    const pathname = url.pathname;
    const cf = request.cf;
    const requestId = makeRequestId(request);

    try {
      const redirectResponse = getCanonicalRedirectResponse(request, env);
      if (redirectResponse) {
        return redirectResponse;
      }

      // Handle client logging endpoint separately
      const logResponse = await handleClientLogRoute(request, env, pathname, SHARED_RATE_LIMITERS.telemetry);
      if (logResponse) {
        const duration = Date.now() - startTime;
        recordMetric(env, "response_time_ms", duration, {
          endpoint: pathname,
          type: "log"
        });
        logPerformance(env, duration, pathname, logResponse.status, { type: "log" });
        return logResponse;
      }

      const opsResponse = await handleOpsRoute(request, env, pathname, SHARED_RATE_LIMITERS.ops);
      if (opsResponse) {
        const duration = Date.now() - startTime;
        recordMetric(env, "response_time_ms", duration, {
          endpoint: pathname,
          type: "ops"
        });
        logPerformance(env, duration, pathname, opsResponse.status, { type: "ops" });
        return opsResponse;
      }

      if (!env.ASSETS || typeof env.ASSETS.fetch !== "function") {
        recordMetric(env, "error", 1, { type: "no_assets_binding" });
        const error = new Error("ASSETS binding is not configured");
        logError(env, error, { requestId, pathname, type: "config" });
        return withHeaders(
          new Response("Service temporarily unavailable", { status: 503 }),
          DEFAULT_SECURITY_HEADERS
        );
      }

      const cacheKey = new Request(request.url, {
        headers: request.headers,
        method: request.method
      });

      const cachedResponse = await caches.default.match(cacheKey);
      if (cachedResponse) {
        recordMetric(env, "cache_hit", 1, {
          path_type: getPathType(pathname),
          colo: cf?.colo || "unknown"
        });
        const duration = Date.now() - startTime;
        recordMetric(env, "response_time_ms", duration, {
          type: "asset",
          cached: "true"
        });

        const response = withCacheHeaders(cachedResponse, pathname, { skipCacheHeader: true });
        const finalResponse = withHeaders(response, DEFAULT_SECURITY_HEADERS);
        finalResponse.headers.set("x-cf-cache-status", "HIT");
        finalResponse.headers.set("x-response-time", `${duration}ms`);
        return finalResponse;
      }

      recordMetric(env, "cache_miss", 1, {
        path_type: getPathType(pathname),
        colo: cf?.colo || "unknown"
      });

      const assetResponse = await env.ASSETS.fetch(request);

      // Handle 404s gracefully
      if (assetResponse.status === 404) {
        recordMetric(env, "not_found", 1, { path_type: getPathType(pathname) });
        const notFoundResponse = new Response("Not Found", {
          status: 404,
          headers: { "content-type": "text/plain" }
        });
        return withHeaders(notFoundResponse, DEFAULT_SECURITY_HEADERS);
      }

      // Handle 5xx errors from origin
      if (assetResponse.status >= 500) {
        recordMetric(env, "origin_error", 1, {
          status: assetResponse.status.toString(),
          path_type: getPathType(pathname)
        });
        const error = new Error(`Origin returned ${assetResponse.status}`);
        logError(env, error, { requestId, pathname, status: assetResponse.status });
      }

      if (assetResponse.status === 200 && ctx?.waitUntil) {
        ctx.waitUntil(
          (async () => {
            try {
              const responseToCache = assetResponse.clone();
              await caches.default.put(cacheKey, responseToCache);
            } catch (cacheError) {
              logError(env, cacheError, { requestId, pathname, type: "cache_write" });
            }
          })()
        );
      } else if (assetResponse.status === 200) {
        // Cache in background when ctx.waitUntil is not available (e.g., in tests)
        (async () => {
          try {
            const responseToCache = assetResponse.clone();
            await caches.default.put(cacheKey, responseToCache);
          } catch (cacheError) {
            // Silently fail cache writes in background
          }
        })();
      }

      const responseWithCache = withCacheHeaders(assetResponse, pathname);
      const finalResponse = withHeaders(responseWithCache, DEFAULT_SECURITY_HEADERS);

      finalResponse.headers.set("x-cf-edge-colo", cf?.colo || "unknown");
      finalResponse.headers.set("x-cf-cache-status", "MISS");
      finalResponse.headers.set("x-request-id", requestId);
      const duration = Date.now() - startTime;
      finalResponse.headers.set("x-response-time", `${duration}ms`);

      recordMetric(env, "response_time_ms", duration, {
        type: "asset",
        cached: "false",
        status: assetResponse.status.toString()
      });
      logPerformance(env, duration, pathname, assetResponse.status, { type: "asset" });

      return finalResponse;
    } catch (error) {
      const duration = Date.now() - startTime;
      recordMetric(env, "error", 1, {
        type: "asset_fetch_error",
        message: error.message?.slice(0, 50) || "unknown"
      });
      logError(env, error, { requestId, pathname, duration });

      // Return user-friendly error
      const errorResponse = new Response(
        JSON.stringify({
          error: "Service temporarily unavailable",
          requestId,
          timestamp: new Date().toISOString()
        }),
        {
          status: 503,
          headers: { "content-type": "application/json" }
        }
      );
      return withHeaders(errorResponse, DEFAULT_SECURITY_HEADERS);
    }
  }
};

function getPathType(pathname) {
  if (pathname.startsWith("/assets/")) return "static_asset";
  if (pathname.startsWith("/wasm/")) return "wasm";
  if (pathname.startsWith("/format/")) return "pseo_format";
  if (pathname.startsWith("/compare/")) return "pseo_compare";
  if (pathname.startsWith("/_ops/")) return "ops";
  if (pathname.endsWith(".html")) return "html";
  return "other";
}
