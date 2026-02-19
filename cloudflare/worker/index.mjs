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

const DEFAULT_SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy":
    "accelerometer=(), autoplay=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()",
  "x-permitted-cross-domain-policies": "none",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin"
};

const OPS_ALLOWED_METHODS = new Set(["GET", "HEAD"]);
const LOGGING_ALLOWED_METHODS = new Set(["POST", "OPTIONS"]);
const MAX_CORRELATION_ID_LENGTH = 64;
const CORRELATION_ID_SAFE_CHARS = /[^A-Za-z0-9._:-]/g;

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

async function handleClientLogRoute(request, env, pathname, rateLimiter) {
  if (pathname === "/_ops/logs") {
    const requestId = makeRequestId(request);
    const clientId = getClientIdentifier(request);

    // Rate limit logs separately
    const logRateLimit = new RateLimiter(50, 60);
    const rateLimitResult = logRateLimit.check(clientId);

    if (!rateLimitResult.allowed) {
      recordMetric(env, "rate_limit_exceeded", 1, { endpoint: "logs" });
      return jsonResponse({
        error: "rate_limited",
        requestId
      }, { status: 429 });
    }

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": CANONICAL_ORIGIN,
          "access-control-allow-methods": "POST",
          "access-control-allow-headers": "content-type",
          "access-control-max-age": "86400"
        }
      });
    }

    if (request.method !== "POST") {
      return jsonResponse({
        error: "method_not_allowed",
        requestId
      }, { status: 405 });
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

      // Log the structured error report
      const logLine = {
        event: "client_error_report",
        timestamp: new Date().toISOString(),
        requestId,
        sessionId: payload.sessionId.substring(0, 16), // Truncate for privacy
        appVersion: payload.appVersion || "unknown",
        environment: env.ENVIRONMENT || "unknown",
        entryCount: payload.entries.length,
        metrics: payload.metrics || {},
        colo: request.cf?.colo || "unknown",
        country: request.cf?.country || "unknown"
      };

      console.log(JSON.stringify(logLine));

      // Record metrics from the report
      if (payload.metrics) {
        if (payload.metrics.conversionsSucceeded > 0) {
          recordMetric(env, "conversion_success", payload.metrics.conversionsSucceeded);
        }
        if (payload.metrics.conversionsFailed > 0) {
          recordMetric(env, "conversion_failure", payload.metrics.conversionsFailed);
        }
        if (payload.metrics.handlersFailed > 0) {
          recordMetric(env, "handler_init_failure", payload.metrics.handlersFailed);
        }
        if (payload.metrics.wasmLoadsFailed > 0) {
          recordMetric(env, "wasm_load_failure", payload.metrics.wasmLoadsFailed);
        }
      }

      // Log individual critical/warn entries
      for (const entry of payload.entries.slice(0, 20)) {
        if (entry.level === "critical" || entry.level === "error") {
          console.error(JSON.stringify({
            event: "client_error",
            level: entry.level,
            category: entry.context?.category || "unknown",
            message: entry.message?.substring(0, 200),
            timestamp: entry.timestamp
          }));
        }
      }

      return jsonResponse({
        ok: true,
        requestId,
        processed: payload.entries.length
      });
    } catch (parseError) {
      return jsonResponse({
        error: "invalid_json",
        requestId,
        message: parseError.message?.substring(0, 100)
      }, { status: 400 });
    }
  }

  return null;
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
    const rateLimiter = new RateLimiter(RATE_LIMIT_CONFIG.requests, RATE_LIMIT_CONFIG.window);

    const redirectResponse = getCanonicalRedirectResponse(request, env);
    if (redirectResponse) {
      return redirectResponse;
    }

    const url = new URL(request.url);
    const pathname = url.pathname;
    const cf = request.cf;

    // Handle client logging endpoint separately
    const logResponse = await handleClientLogRoute(request, env, pathname, rateLimiter);
    if (logResponse) {
      recordMetric(env, "response_time_ms", Date.now() - startTime, {
        endpoint: pathname,
        type: "log"
      });
      return logResponse;
    }

    const opsResponse = await handleOpsRoute(request, env, pathname, rateLimiter);
    if (opsResponse) {
      recordMetric(env, "response_time_ms", Date.now() - startTime, {
        endpoint: pathname,
        type: "ops"
      });
      return opsResponse;
    }

    if (!env.ASSETS || typeof env.ASSETS.fetch !== "function") {
      recordMetric(env, "error", 1, { type: "no_assets_binding" });
      return withHeaders(
        new Response("ASSETS binding is not configured", { status: 500 }),
        DEFAULT_SECURITY_HEADERS
      );
    }

    try {
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
        recordMetric(env, "response_time_ms", Date.now() - startTime, {
          type: "asset",
          cached: "true"
        });

        const response = withCacheHeaders(cachedResponse, pathname, { skipCacheHeader: true });
        return withHeaders(response, DEFAULT_SECURITY_HEADERS);
      }

      recordMetric(env, "cache_miss", 1, {
        path_type: getPathType(pathname),
        colo: cf?.colo || "unknown"
      });

      const assetResponse = await env.ASSETS.fetch(request);

      if (assetResponse.status === 200 && ctx?.waitUntil) {
        ctx.waitUntil(
          (async () => {
            const responseToCache = assetResponse.clone();
            await caches.default.put(cacheKey, responseToCache);
          })()
        );
      } else if (assetResponse.status === 200) {
        // Cache in background when ctx.waitUntil is not available (e.g., in tests)
        (async () => {
          const responseToCache = assetResponse.clone();
          await caches.default.put(cacheKey, responseToCache);
        })();
      }

      const responseWithCache = withCacheHeaders(assetResponse, pathname);
      const finalResponse = withHeaders(responseWithCache, DEFAULT_SECURITY_HEADERS);

      finalResponse.headers.set("x-cf-edge-colo", cf?.colo || "unknown");
      finalResponse.headers.set("x-cf-cache-status", "MISS");
      finalResponse.headers.set("x-response-time", `${Date.now() - startTime}ms`);

      recordMetric(env, "response_time_ms", Date.now() - startTime, {
        type: "asset",
        cached: "false",
        status: assetResponse.status.toString()
      });

      return finalResponse;
    } catch (error) {
      recordMetric(env, "error", 1, {
        type: "asset_fetch_error",
        message: error.message?.slice(0, 50) || "unknown"
      });
      return withHeaders(
        new Response("Error fetching asset", { status: 502 }),
        DEFAULT_SECURITY_HEADERS
      );
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
