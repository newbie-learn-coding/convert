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
  IMAGES: {
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

const OPS_NO_CACHE_HEADERS = {
  "cache-control": "no-store",
  "x-robots-tag": "noindex, nofollow, noarchive"
};

const CACHE_CONTROL_DIRECTIVES = {
  staticAssets: `public, max-age=${CACHE_CONFIG.STATIC_ASSETS.browserTTL}, s-maxage=${CACHE_CONFIG.STATIC_ASSETS.edgeTTL}, stale-while-revalidate=${CACHE_CONFIG.STATIC_ASSETS.staleWhileRevalidate}, immutable`,
  html: `public, max-age=${CACHE_CONFIG.HTML.browserTTL}, s-maxage=${CACHE_CONFIG.HTML.edgeTTL}, stale-while-revalidate=${CACHE_CONFIG.HTML.staleWhileRevalidate}, must-revalidate`,
  images: `public, max-age=${CACHE_CONFIG.IMAGES.browserTTL}, s-maxage=${CACHE_CONFIG.IMAGES.edgeTTL}, stale-while-revalidate=${CACHE_CONFIG.IMAGES.staleWhileRevalidate}`,
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

const GLOBAL_RATE_LIMIT_PROVIDER = {
  durableObject: "durable_object",
  kv: "kv"
};

const GLOBAL_RATE_LIMIT_DO_NAME = "global-rate-limiter-v1";
const GLOBAL_RATE_LIMIT_CLIENT_ID_MAX_LENGTH = 120;
const GLOBAL_RATE_LIMIT_SCOPE_OPS = "ops";
const GLOBAL_RATE_LIMIT_SCOPE_TELEMETRY = "telemetry";
const GLOBAL_RATE_LIMIT_MODE = {
  off: "off",
  shadow: "shadow",
  enforce: "enforce"
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
const OPS_METRICS_PREFIX = "converttoit_ops_";
const OPS_LATENCY_BUCKETS_SECONDS = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];
const OPS_SLO_TARGETS = {
  availability: 0.999,
  latencyP95Seconds: 0.3,
  errorRate: 0.01,
  rateLimitedRate: 0.02
};
const OPS_METRICS_SCHEMA_VERSION = "2026-02-20";

const OPS_OBSERVABILITY = {
  startedAtMs: Date.now(),
  requestsTotal: new Map(),
  durationCountByEndpoint: new Map(),
  durationSumByEndpoint: new Map(),
  durationBucketByEndpoint: new Map(),
  rejectionsTotal: new Map(),
  shadowRateLimitedTotal: new Map()
};

function mergeDefaultHeaders(headers, defaults) {
  for (const [key, value] of Object.entries(defaults)) {
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  }
}

function mapIncrement(map, key, delta = 1) {
  map.set(key, (map.get(key) || 0) + delta);
}

function escapePrometheusLabelValue(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/"/g, "\\\"");
}

function formatPrometheusLabels(labels = {}) {
  const entries = Object.entries(labels);
  if (!entries.length) {
    return "";
  }

  return `{${entries.map(([key, value]) => `${key}="${escapePrometheusLabelValue(value)}"`).join(",")}}`;
}

function normalizeOpsEndpoint(pathname) {
  if (!pathname.startsWith("/_ops/")) {
    return "/_ops/_non_ops";
  }

  if (pathname === "/_ops/logging") {
    return "/_ops/logging";
  }

  if (
    pathname === "/_ops/health" ||
    pathname === "/_ops/version" ||
    pathname === "/_ops/metrics" ||
    pathname === "/_ops/log-ping" ||
    pathname === "/_ops/logs"
  ) {
    return pathname;
  }

  return "/_ops/_unknown";
}

function getStatusClass(statusCode) {
  return `${Math.floor(statusCode / 100)}xx`;
}

function recordOpsRejection(pathname, reason) {
  if (!pathname.startsWith("/_ops/")) {
    return;
  }

  const endpoint = normalizeOpsEndpoint(pathname);
  const key = `${endpoint}\u0000${reason}`;
  mapIncrement(OPS_OBSERVABILITY.rejectionsTotal, key, 1);
}

function recordOpsShadowRateLimit(pathname, scope) {
  if (!pathname.startsWith("/_ops/")) {
    return;
  }

  const endpoint = normalizeOpsEndpoint(pathname);
  const key = `${endpoint}\u0000${scope}`;
  mapIncrement(OPS_OBSERVABILITY.shadowRateLimitedTotal, key, 1);
}

function recordOpsRequest(pathname, method, statusCode, durationMs) {
  if (!pathname.startsWith("/_ops/")) {
    return;
  }

  const endpoint = normalizeOpsEndpoint(pathname);
  const normalizedMethod = String(method || "GET").toUpperCase();
  const safeStatusCode = Number.isFinite(statusCode) ? statusCode : 500;
  const statusClass = getStatusClass(safeStatusCode);
  const requestKey = `${endpoint}\u0000${normalizedMethod}\u0000${safeStatusCode}\u0000${statusClass}`;
  mapIncrement(OPS_OBSERVABILITY.requestsTotal, requestKey, 1);

  const durationSeconds = Math.max(durationMs, 0) / 1000;
  mapIncrement(OPS_OBSERVABILITY.durationCountByEndpoint, endpoint, 1);
  mapIncrement(OPS_OBSERVABILITY.durationSumByEndpoint, endpoint, durationSeconds);

  for (const bucket of OPS_LATENCY_BUCKETS_SECONDS) {
    if (durationSeconds <= bucket) {
      const bucketKey = `${endpoint}\u0000${bucket}`;
      mapIncrement(OPS_OBSERVABILITY.durationBucketByEndpoint, bucketKey, 1);
    }
  }

  if (safeStatusCode >= 500) {
    recordOpsRejection(pathname, "server_error");
  }
}

function buildOpsMetricsSnapshot(env) {
  const endpoints = new Set([
    ...OPS_OBSERVABILITY.durationCountByEndpoint.keys(),
    ...Array.from(OPS_OBSERVABILITY.requestsTotal.keys()).map((key) => key.split("\u0000", 1)[0]),
    ...Array.from(OPS_OBSERVABILITY.rejectionsTotal.keys()).map((key) => key.split("\u0000", 1)[0]),
    ...Array.from(OPS_OBSERVABILITY.shadowRateLimitedTotal.keys()).map((key) => key.split("\u0000", 1)[0])
  ]);

  const requests = [];
  for (const [key, value] of OPS_OBSERVABILITY.requestsTotal.entries()) {
    const [endpoint, method, statusCode, statusClass] = key.split("\u0000");
    requests.push({
      endpoint,
      method,
      statusCode,
      statusClass,
      total: value
    });
  }

  const latency = [];
  for (const endpoint of endpoints) {
    const count = OPS_OBSERVABILITY.durationCountByEndpoint.get(endpoint) || 0;
    if (count === 0) {
      continue;
    }

    const buckets = OPS_LATENCY_BUCKETS_SECONDS.map((le) => ({
      le,
      count: OPS_OBSERVABILITY.durationBucketByEndpoint.get(`${endpoint}\u0000${le}`) || 0
    }));

    latency.push({
      endpoint,
      count,
      sumSeconds: OPS_OBSERVABILITY.durationSumByEndpoint.get(endpoint) || 0,
      buckets
    });
  }

  const rejections = [];
  for (const [key, value] of OPS_OBSERVABILITY.rejectionsTotal.entries()) {
    const [endpoint, reason] = key.split("\u0000");
    rejections.push({
      endpoint,
      reason,
      total: value
    });
  }

  const shadowRateLimited = [];
  for (const [key, value] of OPS_OBSERVABILITY.shadowRateLimitedTotal.entries()) {
    const [endpoint, scope] = key.split("\u0000");
    shadowRateLimited.push({
      endpoint,
      scope,
      total: value
    });
  }

  return {
    schemaVersion: OPS_METRICS_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    processStartTimeSeconds: Math.floor(OPS_OBSERVABILITY.startedAtMs / 1000),
    uptimeSeconds: Math.max(0, Math.floor((Date.now() - OPS_OBSERVABILITY.startedAtMs) / 1000)),
    service: readVersion(env),
    sloTargets: OPS_SLO_TARGETS,
    rateLimiter: {
      ops: {
        limit: RATE_LIMIT_CONFIG.requests,
        windowSeconds: RATE_LIMIT_CONFIG.window,
        activeClients: SHARED_RATE_LIMITERS.ops.requests.size
      },
      telemetry: {
        limit: TELEMETRY_RATE_LIMIT_CONFIG.requests,
        windowSeconds: TELEMETRY_RATE_LIMIT_CONFIG.window,
        activeClients: SHARED_RATE_LIMITERS.telemetry.requests.size
      }
    },
    requests,
    latency,
    rejections,
    shadowRateLimited
  };
}

function buildOpsPrometheusMetrics(env) {
  const snapshot = buildOpsMetricsSnapshot(env);
  const lines = [];
  const addMetric = (name, labels, value) => {
    lines.push(`${name}${formatPrometheusLabels(labels)} ${value}`);
  };

  lines.push(`# HELP ${OPS_METRICS_PREFIX}process_start_time_seconds Worker isolate start time.`);
  lines.push(`# TYPE ${OPS_METRICS_PREFIX}process_start_time_seconds gauge`);
  addMetric(`${OPS_METRICS_PREFIX}process_start_time_seconds`, {}, snapshot.processStartTimeSeconds);

  lines.push(`# HELP ${OPS_METRICS_PREFIX}uptime_seconds Worker isolate uptime in seconds.`);
  lines.push(`# TYPE ${OPS_METRICS_PREFIX}uptime_seconds gauge`);
  addMetric(`${OPS_METRICS_PREFIX}uptime_seconds`, {}, snapshot.uptimeSeconds);

  lines.push(`# HELP ${OPS_METRICS_PREFIX}build_info Build metadata for ops endpoints.`);
  lines.push(`# TYPE ${OPS_METRICS_PREFIX}build_info gauge`);
  addMetric(`${OPS_METRICS_PREFIX}build_info`, {
    service: snapshot.service.service,
    environment: snapshot.service.environment,
    app_version: snapshot.service.appVersion,
    build_sha: snapshot.service.buildSha
  }, 1);

  lines.push(`# HELP ${OPS_METRICS_PREFIX}slo_target_ratio SLO target ratios for /_ops.`);
  lines.push(`# TYPE ${OPS_METRICS_PREFIX}slo_target_ratio gauge`);
  addMetric(`${OPS_METRICS_PREFIX}slo_target_ratio`, { objective: "availability" }, snapshot.sloTargets.availability);
  addMetric(`${OPS_METRICS_PREFIX}slo_target_ratio`, { objective: "latency_p95" }, snapshot.sloTargets.latencyP95Seconds);
  addMetric(`${OPS_METRICS_PREFIX}slo_target_ratio`, { objective: "error_rate" }, snapshot.sloTargets.errorRate);
  addMetric(`${OPS_METRICS_PREFIX}slo_target_ratio`, { objective: "rate_limited_rate" }, snapshot.sloTargets.rateLimitedRate);

  lines.push(`# HELP ${OPS_METRICS_PREFIX}rate_limit_limit Rate limiter limits for /_ops traffic.`);
  lines.push(`# TYPE ${OPS_METRICS_PREFIX}rate_limit_limit gauge`);
  addMetric(`${OPS_METRICS_PREFIX}rate_limit_limit`, { scope: "ops" }, snapshot.rateLimiter.ops.limit);
  addMetric(`${OPS_METRICS_PREFIX}rate_limit_limit`, { scope: "telemetry" }, snapshot.rateLimiter.telemetry.limit);

  lines.push(`# HELP ${OPS_METRICS_PREFIX}rate_limit_window_seconds Rate limiter windows in seconds.`);
  lines.push(`# TYPE ${OPS_METRICS_PREFIX}rate_limit_window_seconds gauge`);
  addMetric(`${OPS_METRICS_PREFIX}rate_limit_window_seconds`, { scope: "ops" }, snapshot.rateLimiter.ops.windowSeconds);
  addMetric(`${OPS_METRICS_PREFIX}rate_limit_window_seconds`, { scope: "telemetry" }, snapshot.rateLimiter.telemetry.windowSeconds);

  lines.push(`# HELP ${OPS_METRICS_PREFIX}rate_limiter_active_clients Active clients tracked in in-memory rate limiters.`);
  lines.push(`# TYPE ${OPS_METRICS_PREFIX}rate_limiter_active_clients gauge`);
  addMetric(`${OPS_METRICS_PREFIX}rate_limiter_active_clients`, { scope: "ops" }, snapshot.rateLimiter.ops.activeClients);
  addMetric(`${OPS_METRICS_PREFIX}rate_limiter_active_clients`, { scope: "telemetry" }, snapshot.rateLimiter.telemetry.activeClients);

  lines.push(`# HELP ${OPS_METRICS_PREFIX}requests_total Total requests observed on /_ops endpoints.`);
  lines.push(`# TYPE ${OPS_METRICS_PREFIX}requests_total counter`);
  for (const sample of snapshot.requests) {
    addMetric(`${OPS_METRICS_PREFIX}requests_total`, {
      endpoint: sample.endpoint,
      method: sample.method,
      status_code: sample.statusCode,
      status_class: sample.statusClass
    }, sample.total);
  }

  lines.push(`# HELP ${OPS_METRICS_PREFIX}request_duration_seconds Request duration histogram for /_ops endpoints.`);
  lines.push(`# TYPE ${OPS_METRICS_PREFIX}request_duration_seconds histogram`);
  for (const sample of snapshot.latency) {
    for (const bucket of sample.buckets) {
      addMetric(`${OPS_METRICS_PREFIX}request_duration_seconds_bucket`, {
        endpoint: sample.endpoint,
        le: bucket.le
      }, bucket.count);
    }
    addMetric(`${OPS_METRICS_PREFIX}request_duration_seconds_bucket`, {
      endpoint: sample.endpoint,
      le: "+Inf"
    }, sample.count);
    addMetric(`${OPS_METRICS_PREFIX}request_duration_seconds_sum`, {
      endpoint: sample.endpoint
    }, sample.sumSeconds.toFixed(6));
    addMetric(`${OPS_METRICS_PREFIX}request_duration_seconds_count`, {
      endpoint: sample.endpoint
    }, sample.count);
  }

  lines.push(`# HELP ${OPS_METRICS_PREFIX}rejections_total Rejected /_ops requests by reason.`);
  lines.push(`# TYPE ${OPS_METRICS_PREFIX}rejections_total counter`);
  for (const sample of snapshot.rejections) {
    addMetric(`${OPS_METRICS_PREFIX}rejections_total`, {
      endpoint: sample.endpoint,
      reason: sample.reason
    }, sample.total);
  }

  lines.push(`# HELP ${OPS_METRICS_PREFIX}shadow_rate_limited_total Requests that would have been rate limited under shadow mode.`);
  lines.push(`# TYPE ${OPS_METRICS_PREFIX}shadow_rate_limited_total counter`);
  for (const sample of snapshot.shadowRateLimited || []) {
    addMetric(`${OPS_METRICS_PREFIX}shadow_rate_limited_total`, {
      endpoint: sample.endpoint,
      scope: sample.scope
    }, sample.total);
  }

  return `${lines.join("\n")}\n`;
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
  if (pathname.endsWith(".html") || pathname === "/") {
    return CACHE_CONTROL_DIRECTIVES.html;
  }
  if (pathname.match(/\.(js|css)$/)) {
    return CACHE_CONTROL_DIRECTIVES.staticAssets;
  }
  if (pathname.match(/\.(ico|svg|png|webp|jpg|jpeg)$/)) {
    return CACHE_CONTROL_DIRECTIVES.images;
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

function parseBooleanFlag(value, defaultValue = false) {
  if (typeof value !== "string") {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

function parsePositiveInteger(value, fallback, min = 1, max = 1_000_000) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return fallback;
  }

  return parsed;
}

function sanitizeLimiterClientId(value) {
  if (typeof value !== "string") {
    return "unknown";
  }

  const cleaned = value.replace(CORRELATION_ID_SAFE_CHARS, "-").slice(0, GLOBAL_RATE_LIMIT_CLIENT_ID_MAX_LENGTH);
  return cleaned || "unknown";
}

function normalizeGlobalProvider(rawValue) {
  if (typeof rawValue !== "string") {
    return GLOBAL_RATE_LIMIT_PROVIDER.durableObject;
  }

  const normalized = rawValue.trim().toLowerCase();
  if (normalized === GLOBAL_RATE_LIMIT_PROVIDER.kv) {
    return GLOBAL_RATE_LIMIT_PROVIDER.kv;
  }
  return GLOBAL_RATE_LIMIT_PROVIDER.durableObject;
}

function normalizeGlobalMode(rawValue, enabledFlag) {
  if (typeof rawValue === "string") {
    const normalized = rawValue.trim().toLowerCase();
    if (normalized === GLOBAL_RATE_LIMIT_MODE.shadow) return GLOBAL_RATE_LIMIT_MODE.shadow;
    if (normalized === GLOBAL_RATE_LIMIT_MODE.enforce) return GLOBAL_RATE_LIMIT_MODE.enforce;
    if (normalized === GLOBAL_RATE_LIMIT_MODE.off) return GLOBAL_RATE_LIMIT_MODE.off;
  }

  return enabledFlag ? GLOBAL_RATE_LIMIT_MODE.enforce : GLOBAL_RATE_LIMIT_MODE.off;
}

function withTimeout(promise, timeoutMs) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }

  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("timeout")), timeoutMs);
    })
  ]);
}

function getGlobalRateLimitSettings(env) {
  const enabledFlag = parseBooleanFlag(env.RATE_LIMIT_GLOBAL_ENABLED, false);
  const mode = normalizeGlobalMode(env.RATE_LIMIT_GLOBAL_MODE, enabledFlag);
  const enabled = mode !== GLOBAL_RATE_LIMIT_MODE.off;

  return {
    enabled,
    mode,
    provider: normalizeGlobalProvider(env.RATE_LIMIT_GLOBAL_PROVIDER),
    allowKvFallback: parseBooleanFlag(env.RATE_LIMIT_GLOBAL_ALLOW_KV_FALLBACK, false),
    telemetryEnabled: parseBooleanFlag(env.RATE_LIMIT_GLOBAL_TELEMETRY_ENABLED, false),
    durableObjectName:
      typeof env.RATE_LIMIT_GLOBAL_DO_NAME === "string" && env.RATE_LIMIT_GLOBAL_DO_NAME.trim().length > 0
        ? env.RATE_LIMIT_GLOBAL_DO_NAME.trim()
        : GLOBAL_RATE_LIMIT_DO_NAME,
    durableObjectShards: parsePositiveInteger(env.RATE_LIMIT_GLOBAL_DO_SHARDS, 32, 1, 256),
    timeoutMs: parsePositiveInteger(env.RATE_LIMIT_GLOBAL_TIMEOUT_MS, 50, 1, 10_000),
    failOpen: parseBooleanFlag(env.RATE_LIMIT_GLOBAL_FAIL_OPEN, true),
    limits: {
      [GLOBAL_RATE_LIMIT_SCOPE_OPS]: {
        requests: parsePositiveInteger(env.RATE_LIMIT_GLOBAL_OPS_REQUESTS, RATE_LIMIT_CONFIG.requests, 1, 100_000),
        window: parsePositiveInteger(env.RATE_LIMIT_GLOBAL_OPS_WINDOW_SECONDS, RATE_LIMIT_CONFIG.window, 1, 3600)
      },
      [GLOBAL_RATE_LIMIT_SCOPE_TELEMETRY]: {
        requests: parsePositiveInteger(env.RATE_LIMIT_GLOBAL_TELEMETRY_REQUESTS, TELEMETRY_RATE_LIMIT_CONFIG.requests, 1, 100_000),
        window: parsePositiveInteger(env.RATE_LIMIT_GLOBAL_TELEMETRY_WINDOW_SECONDS, TELEMETRY_RATE_LIMIT_CONFIG.window, 1, 3600)
      }
    }
  };
}

export class GlobalRateLimiter {
  constructor(ctx) {
    this.ctx = ctx;
    this.schemaReady = false;
  }

  ensureSchema() {
    if (this.schemaReady) {
      return;
    }

    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS rate_limit_counters (
        scope TEXT NOT NULL,
        client_id TEXT NOT NULL,
        window_start INTEGER NOT NULL,
        count INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (scope, client_id)
      )
    `);
    this.ctx.storage.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_rate_limit_updated_at
      ON rate_limit_counters (updated_at)
    `);

    this.schemaReady = true;
  }

  sanitizeScope(rawScope) {
    if (rawScope === GLOBAL_RATE_LIMIT_SCOPE_TELEMETRY) {
      return GLOBAL_RATE_LIMIT_SCOPE_TELEMETRY;
    }
    return GLOBAL_RATE_LIMIT_SCOPE_OPS;
  }

  async consume(input = {}) {
    this.ensureSchema();

    const now = Number.isFinite(input.now) ? Math.floor(input.now) : Date.now();
    const scope = this.sanitizeScope(input.scope);
    const clientId = sanitizeLimiterClientId(input.clientId);
    const limit = Number.isFinite(input.limit) ? Math.max(1, Math.floor(input.limit)) : RATE_LIMIT_CONFIG.requests;
    const windowSeconds = Number.isFinite(input.windowSeconds) ? Math.max(1, Math.floor(input.windowSeconds)) : RATE_LIMIT_CONFIG.window;

    const windowMs = windowSeconds * 1000;
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const resetAt = windowStart + windowMs;

    const row = this.ctx.storage.sql.exec(
      "SELECT count, window_start FROM rate_limit_counters WHERE scope = ?1 AND client_id = ?2",
      scope,
      clientId
    ).one();

    const rowCount = Number(row?.count) || 0;
    const rowWindowStart = Number(row?.window_start) || 0;
    const currentCount = rowWindowStart === windowStart ? rowCount : 0;

    if (currentCount >= limit) {
      this.maybeCleanup(now, windowMs);
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        limit,
        windowSeconds,
        source: "global:durable_object"
      };
    }

    const nextCount = currentCount + 1;
    this.ctx.storage.sql.exec(
      `
        INSERT INTO rate_limit_counters (scope, client_id, window_start, count, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5)
        ON CONFLICT(scope, client_id) DO UPDATE SET
          window_start = excluded.window_start,
          count = excluded.count,
          updated_at = excluded.updated_at
      `,
      scope,
      clientId,
      windowStart,
      nextCount,
      now
    );

    this.maybeCleanup(now, windowMs);
    return {
      allowed: true,
      remaining: Math.max(0, limit - nextCount),
      resetAt,
      limit,
      windowSeconds,
      source: "global:durable_object"
    };
  }

  maybeCleanup(now, windowMs) {
    if (Math.random() >= RATE_LIMITER_CLEANUP_SAMPLE_RATE) {
      return;
    }

    const cutoff = now - Math.max(windowMs * 2, 60_000);
    this.ctx.storage.sql.exec(
      "DELETE FROM rate_limit_counters WHERE updated_at < ?1",
      cutoff
    );
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

function getGlobalClientIdentifier(request) {
  return request.headers.get("cf-connecting-ip") || "unknown";
}

function fnv1aHash32(input) {
  const str = String(input);
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function getGlobalLimiterShardName(baseName, shards, scope, clientId) {
  const safeShards = Number.isFinite(shards) ? Math.max(1, Math.floor(shards)) : 1;
  if (safeShards === 1) {
    return baseName;
  }

  const hash = fnv1aHash32(`${scope}:${clientId}`);
  const shard = hash % safeShards;
  return `${baseName}-${shard}`;
}

function normalizeGlobalLimiterResult(result, fallbackLimit, fallbackWindow, source) {
  const allowed = result?.allowed !== false;
  const remaining = Number.isFinite(result?.remaining)
    ? Math.max(0, Math.floor(result.remaining))
    : 0;
  const limit = Number.isFinite(result?.limit)
    ? Math.max(1, Math.floor(result.limit))
    : fallbackLimit;
  const windowSeconds = Number.isFinite(result?.windowSeconds)
    ? Math.max(1, Math.floor(result.windowSeconds))
    : fallbackWindow;
  const resetAt = Number.isFinite(result?.resetAt)
    ? Math.floor(result.resetAt)
    : Date.now() + windowSeconds * 1000;

  return {
    allowed,
    remaining,
    limit,
    windowSeconds,
    resetAt,
    source
  };
}

async function checkGlobalRateLimitDO(env, settings, scope, clientId, limitConfig) {
  if (!env.GLOBAL_RATE_LIMITER || typeof env.GLOBAL_RATE_LIMITER.getByName !== "function") {
    return { applied: false, reason: "missing_do_binding" };
  }

  const shardName = getGlobalLimiterShardName(
    settings.durableObjectName,
    settings.durableObjectShards,
    scope,
    clientId
  );
  const stub = env.GLOBAL_RATE_LIMITER.getByName(shardName);
  if (!stub || typeof stub.consume !== "function") {
    return { applied: false, reason: "invalid_do_stub" };
  }

  const result = await withTimeout(stub.consume({
    scope,
    clientId,
    limit: limitConfig.requests,
    windowSeconds: limitConfig.window,
    now: Date.now()
  }), settings.timeoutMs);

  return {
    applied: true,
    ...normalizeGlobalLimiterResult(
      result,
      limitConfig.requests,
      limitConfig.window,
      "global:durable_object"
    )
  };
}

async function checkGlobalRateLimitWithKv(env, scope, clientId, limitConfig) {
  const kv = env.GLOBAL_RATE_LIMIT_KV;
  if (!kv || typeof kv.get !== "function" || typeof kv.put !== "function") {
    return { applied: false, reason: "missing_kv_binding" };
  }

  const now = Date.now();
  const windowMs = limitConfig.window * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const key = `rl:${scope}:${clientId}:${windowStart}`;
  const rawCount = await kv.get(key);
  const currentCount = Number.parseInt(rawCount ?? "0", 10);
  const safeCount = Number.isFinite(currentCount) && currentCount > 0 ? currentCount : 0;

  if (safeCount >= limitConfig.requests) {
    return {
      applied: true,
      allowed: false,
      remaining: 0,
      limit: limitConfig.requests,
      windowSeconds: limitConfig.window,
      resetAt: windowStart + windowMs,
      source: "global:kv"
    };
  }

  const nextCount = safeCount + 1;
  await kv.put(key, String(nextCount), { expirationTtl: Math.max(limitConfig.window * 2, limitConfig.window + 1) });
  return {
    applied: true,
    allowed: true,
    remaining: Math.max(0, limitConfig.requests - nextCount),
    limit: limitConfig.requests,
    windowSeconds: limitConfig.window,
    resetAt: windowStart + windowMs,
    source: "global:kv"
  };
}

async function checkGlobalRateLimit(request, env, scope) {
  const settings = getGlobalRateLimitSettings(env);
  if (!settings.enabled) {
    return { applied: false, reason: "disabled", mode: settings.mode };
  }

  if (scope === GLOBAL_RATE_LIMIT_SCOPE_TELEMETRY && !settings.telemetryEnabled) {
    return { applied: false, reason: "telemetry_not_enabled", mode: settings.mode };
  }

  const limitConfig = settings.limits[scope];
  if (!limitConfig) {
    return { applied: false, reason: "invalid_scope", mode: settings.mode };
  }

  const clientId = sanitizeLimiterClientId(getGlobalClientIdentifier(request));

  try {
    if (settings.provider === GLOBAL_RATE_LIMIT_PROVIDER.kv) {
      if (!settings.allowKvFallback) {
        return { applied: false, reason: "kv_fallback_not_allowed", mode: settings.mode };
      }
      return { ...(await checkGlobalRateLimitWithKv(env, scope, clientId, limitConfig)), mode: settings.mode };
    }

    return { ...(await checkGlobalRateLimitDO(env, settings, scope, clientId, limitConfig)), mode: settings.mode };
  } catch (error) {
    logError(env, error, {
      type: "global_rate_limit_check",
      provider: settings.provider,
      scope
    });
    if (settings.failOpen) {
      return { applied: false, reason: "check_error_fail_open", mode: settings.mode };
    }

    return {
      applied: true,
      allowed: false,
      remaining: 0,
      limit: limitConfig.requests,
      windowSeconds: limitConfig.window,
      resetAt: Date.now() + limitConfig.window * 1000,
      source: "global:unavailable",
      mode: settings.mode
    };
  }
}

function createRateLimitExceededResponse({
  requestId,
  requestMethod,
  limit,
  remaining = 0,
  resetAt,
  source = "isolate"
}) {
  const safeResetAt = Number.isFinite(resetAt) ? resetAt : Date.now() + 1000;
  const retryAfter = Math.max(1, Math.ceil((safeResetAt - Date.now()) / 1000));

  return jsonResponse({
    error: "rate_limited",
    requestId,
    retryAfter,
    source
  }, {
    status: 429,
    headers: {
      "retry-after": retryAfter.toString(),
      "x-ratelimit-limit": String(limit),
      "x-ratelimit-remaining": String(Math.max(0, remaining)),
      "x-ratelimit-source": source
    }
  }, requestMethod);
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

function textResponse(payload, init = {}, requestMethod = "GET") {
  const headers = new Headers(init.headers || {});
  mergeDefaultHeaders(headers, OPS_NO_CACHE_HEADERS);
  mergeDefaultHeaders(headers, DEFAULT_SECURITY_HEADERS);
  mergeDefaultHeaders(headers, {
    "content-type": "text/plain; charset=utf-8"
  });

  const body = requestMethod === "HEAD" ? null : payload;
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

function getOpsMetricsToken(env) {
  const configuredToken = env.OPS_METRICS_TOKEN || env.OPS_LOG_TOKEN;
  if (typeof configuredToken !== "string") {
    return null;
  }

  const trimmed = configuredToken.trim();
  return trimmed || null;
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

function ensureOpsMethod(request, requestId, pathname) {
  if (OPS_ALLOWED_METHODS.has(request.method)) {
    return null;
  }

  recordOpsRejection(pathname, "method_not_allowed");

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
    recordOpsRejection(pathname, "method_not_allowed");
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
    recordOpsRejection(pathname, "forbidden_origin");
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
  const isolateRateLimitResult = rateLimiter.check(clientId);
  if (!isolateRateLimitResult.allowed) {
    recordMetric(env, "rate_limit_exceeded", 1, { endpoint: pathname, source: "isolate" });
    recordOpsRejection(pathname, "rate_limited");
    return createRateLimitExceededResponse({
      requestId,
      requestMethod: request.method,
      limit: TELEMETRY_RATE_LIMIT_CONFIG.requests,
      remaining: 0,
      resetAt: isolateRateLimitResult.resetAt,
      source: "isolate"
    });
  }

  const globalRateLimitResult = await checkGlobalRateLimit(request, env, GLOBAL_RATE_LIMIT_SCOPE_TELEMETRY);
  if (globalRateLimitResult.applied && !globalRateLimitResult.allowed && globalRateLimitResult.mode !== GLOBAL_RATE_LIMIT_MODE.shadow) {
    recordMetric(env, "rate_limit_exceeded", 1, { endpoint: pathname, source: globalRateLimitResult.source });
    recordOpsRejection(pathname, "rate_limited");
    return createRateLimitExceededResponse({
      requestId,
      requestMethod: request.method,
      limit: globalRateLimitResult.limit,
      remaining: globalRateLimitResult.remaining,
      resetAt: globalRateLimitResult.resetAt,
      source: globalRateLimitResult.source
    });
  }
  if (globalRateLimitResult.applied && !globalRateLimitResult.allowed && globalRateLimitResult.mode === GLOBAL_RATE_LIMIT_MODE.shadow) {
    recordOpsShadowRateLimit(pathname, GLOBAL_RATE_LIMIT_SCOPE_TELEMETRY);
  }

  try {
    const payload = await request.json();

    // Validate required fields
    if (!payload.sessionId || !payload.entries || !Array.isArray(payload.entries)) {
      recordOpsRejection(pathname, "invalid_payload");
      return jsonResponse({
        error: "invalid_payload",
        requestId
      }, { status: 400 });
    }

    // Validate payload size limits
    if (payload.entries.length > 100) {
      recordOpsRejection(pathname, "too_many_entries");
      return jsonResponse({
        error: "too_many_entries",
        requestId,
        message: "Maximum 100 entries allowed per request"
      }, { status: 413 });
    }

    // Sanitize and validate sessionId
    const sanitizedSessionId = String(payload.sessionId).replace(/[^a-zA-Z0-9_-]/g, "").substring(0, 32);
    if (!sanitizedSessionId || sanitizedSessionId.length < 8) {
      recordOpsRejection(pathname, "invalid_session_id");
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
    recordOpsRejection(pathname, "invalid_json");
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
  const isolateRateLimitResult = rateLimiter.check(clientId);

  if (!isolateRateLimitResult.allowed) {
    recordMetric(env, "rate_limit_exceeded", 1, { endpoint: pathname, source: "isolate" });
    recordOpsRejection(pathname, "rate_limited");
    return createRateLimitExceededResponse({
      requestId,
      requestMethod: request.method,
      limit: RATE_LIMIT_CONFIG.requests,
      remaining: 0,
      resetAt: isolateRateLimitResult.resetAt,
      source: "isolate"
    });
  }

  const globalRateLimitResult = await checkGlobalRateLimit(request, env, GLOBAL_RATE_LIMIT_SCOPE_OPS);
  if (globalRateLimitResult.applied && !globalRateLimitResult.allowed && globalRateLimitResult.mode !== GLOBAL_RATE_LIMIT_MODE.shadow) {
    recordMetric(env, "rate_limit_exceeded", 1, { endpoint: pathname, source: globalRateLimitResult.source });
    recordOpsRejection(pathname, "rate_limited");
    return createRateLimitExceededResponse({
      requestId,
      requestMethod: request.method,
      limit: globalRateLimitResult.limit,
      remaining: globalRateLimitResult.remaining,
      resetAt: globalRateLimitResult.resetAt,
      source: globalRateLimitResult.source
    });
  }
  if (globalRateLimitResult.applied && !globalRateLimitResult.allowed && globalRateLimitResult.mode === GLOBAL_RATE_LIMIT_MODE.shadow) {
    recordOpsShadowRateLimit(pathname, GLOBAL_RATE_LIMIT_SCOPE_OPS);
  }

  const invalidMethodResponse = ensureOpsMethod(request, requestId, pathname);
  if (invalidMethodResponse) {
    return invalidMethodResponse;
  }

  if (pathname === "/_ops/health") {
    recordMetric(env, "health_check", 1, { status: "ok" });
    const globalEnforced = globalRateLimitResult.applied && globalRateLimitResult.mode === GLOBAL_RATE_LIMIT_MODE.enforce;
    const effectiveLimit = globalEnforced
      ? Math.min(RATE_LIMIT_CONFIG.requests, globalRateLimitResult.limit)
      : RATE_LIMIT_CONFIG.requests;
    return jsonResponse({
      status: "ok",
      timestamp: new Date().toISOString(),
      requestId,
      rateLimit: {
        limit: effectiveLimit,
        remaining: globalEnforced
          ? Math.min(isolateRateLimitResult.remaining, globalRateLimitResult.remaining)
          : isolateRateLimitResult.remaining,
        source: globalEnforced ? globalRateLimitResult.source : "isolate"
      },
      globalRateLimit: globalRateLimitResult.applied
        ? {
          applied: true,
          mode: globalRateLimitResult.mode,
          allowed: globalRateLimitResult.allowed,
          source: globalRateLimitResult.source,
          limit: globalRateLimitResult.limit,
          remaining: globalRateLimitResult.remaining,
          windowSeconds: globalRateLimitResult.windowSeconds,
          resetAt: new Date(globalRateLimitResult.resetAt).toISOString()
        }
        : {
          applied: false,
          mode: globalRateLimitResult.mode,
          reason: globalRateLimitResult.reason
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
    const metricsToken = getOpsMetricsToken(env);
    if (!metricsToken) {
      recordOpsRejection(pathname, "metrics_token_missing");
      return jsonResponse({
        error: "metrics_token_missing",
        requestId,
        message: "Set OPS_METRICS_TOKEN (or OPS_LOG_TOKEN) before scraping /_ops/metrics"
      }, { status: 503 }, request.method);
    }

    if (request.headers.get("x-ops-token") !== metricsToken) {
      recordOpsRejection(pathname, "unauthorized");
      return jsonResponse({
        error: "unauthorized",
        requestId
      }, { status: 401 }, request.method);
    }

    const url = new URL(request.url);
    const format = (url.searchParams.get("format") || "prom").toLowerCase();

    if (format === "json") {
      return jsonResponse(buildOpsMetricsSnapshot(env), {}, request.method);
    }

    if (format !== "prom") {
      recordOpsRejection(pathname, "unsupported_format");
      return jsonResponse({
        error: "unsupported_format",
        requestId,
        supportedFormats: ["prom", "json"]
      }, { status: 400 }, request.method);
    }

    return textResponse(buildOpsPrometheusMetrics(env), {
      headers: {
        "content-type": "text/plain; version=0.0.4; charset=utf-8"
      }
    }, request.method);
  }

  if (pathname === "/_ops/log-ping") {
    if (!requireOpsToken(request, env)) {
      recordOpsRejection(pathname, "unauthorized");
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

  recordOpsRejection(pathname, "not_found");
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
        recordOpsRequest(pathname, request.method, logResponse.status, duration);
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
        recordOpsRequest(pathname, request.method, opsResponse.status, duration);
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
      recordOpsRequest(pathname, request.method, 503, duration);
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
  if (pathname.startsWith("/_ops/")) return "ops";
  if (pathname.endsWith(".html")) return "html";
  return "other";
}
