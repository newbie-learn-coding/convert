/**
 * Core Web Vitals monitoring and reporting module.
 * Tracks LCP, INP, CLS, FCP, TTFB with analytics reporting.
 */

import {
  onCLS,
  onINP,
  onLCP,
  onFCP,
  onTTFB,
  type Metric,
  type CLSMetric,
  type INPMetric,
  type LCPMetric,
  type FCPMetric,
  type TTFBMetric
} from "web-vitals";
import { LOG_ENDPOINT, getLogger } from "./logging.js";

/**
 * Performance budget thresholds based on Core Web Vitals "Good" targets.
 */
export const PERFORMANCE_BUDGETS = {
  LCP: 2500,  // Largest Contentful Paint: < 2.5s
  INP: 200,   // Interaction to Next Paint: < 200ms
  CLS: 0.1,   // Cumulative Layout Shift: < 0.1
  FCP: 1800,  // First Contentful Paint: < 1.8s
  TTFB: 800   // Time to First Byte: < 800ms
} as const;

/**
 * Rating categories for performance metrics.
 */
type MetricRating = "good" | "needs-improvement" | "poor";

/**
 * Enriched metric with rating and additional context.
 */
export interface EnrichedMetric extends Metric {
  rating: MetricRating;
  budget: number;
  passed: boolean;
}

/**
 * Analytics payload for reporting metrics.
 */
export interface AnalyticsPayload {
  metrics: Record<string, EnrichedMetric>;
  context: {
    userAgent: string;
    url: string;
    timestamp: number;
    connection?: {
      effectiveType?: string;
      rtt?: number;
      downlink?: number;
    };
  };
  overall: {
    passed: boolean;
    failedMetrics: string[];
  };
}

interface CustomTimingPayload {
  name: string;
  value: number;
  metadata?: Record<string, unknown>;
  timestamp: number;
  url: string;
}

interface WorkerLogEntry {
  level: "info" | "warn";
  message: string;
  timestamp: string;
  context: Record<string, string | number | boolean>;
}

interface WorkerLogPayload {
  sessionId: string;
  timestamp: string;
  entries: WorkerLogEntry[];
}

const DEFAULT_PERFORMANCE_ENDPOINT = LOG_ENDPOINT;
const PERFORMANCE_SESSION_KEY = "__perfTelemetrySessionId";
let runtimePerformanceEndpoint = DEFAULT_PERFORMANCE_ENDPOINT;

/**
 * Determine the rating category for a metric based on its value.
 */
function getRating(name: string, value: number): MetricRating {
  switch (name) {
    case "LCP":
      if (value <= 2500) return "good";
      if (value <= 4000) return "needs-improvement";
      return "poor";
    case "INP":
      if (value <= 200) return "good";
      if (value <= 500) return "needs-improvement";
      return "poor";
    case "CLS":
      if (value <= 0.1) return "good";
      if (value <= 0.25) return "needs-improvement";
      return "poor";
    case "FCP":
      if (value <= 1800) return "good";
      if (value <= 3000) return "needs-improvement";
      return "poor";
    case "TTFB":
      if (value <= 800) return "good";
      if (value <= 1800) return "needs-improvement";
      return "poor";
    default:
      return "good";
  }
}

/**
 * Get the performance budget threshold for a metric.
 */
function getBudget(name: string): number {
  return PERFORMANCE_BUDGETS[name as keyof typeof PERFORMANCE_BUDGETS] ?? 0;
}

/**
 * Enrich a raw metric with rating and budget information.
 */
function enrichMetric(metric: Metric): EnrichedMetric {
  const budget = getBudget(metric.name);
  const rating = getRating(metric.name, metric.value);
  const passed = metric.value <= budget;

  return {
    ...metric,
    rating,
    budget,
    passed
  };
}

/**
 * Get network connection information if available.
 */
function getConnectionInfo(): AnalyticsPayload["context"]["connection"] {
  if ("connection" in navigator) {
    const conn = (navigator as unknown as { connection: { effectiveType?: string; rtt?: number; downlink?: number } }).connection;
    return {
      effectiveType: conn.effectiveType,
      rtt: conn.rtt,
      downlink: conn.downlink
    };
  }
  return undefined;
}

function normalizeReportEndpoint(endpoint?: string): string {
  if (!endpoint) return DEFAULT_PERFORMANCE_ENDPOINT;
  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) return endpoint;
  return endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
}

function isWorkerLoggingEndpoint(endpoint: string): boolean {
  try {
    const normalized = new URL(endpoint, window.location.origin);
    return normalized.pathname === LOG_ENDPOINT;
  } catch {
    return endpoint === LOG_ENDPOINT;
  }
}

function createFallbackSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 12);
  return `perf-${timestamp}-${random}`;
}

function getTelemetrySessionId(): string {
  const logger = getLogger();
  const loggerSessionId = logger?.getSessionId();
  if (loggerSessionId) {
    return loggerSessionId;
  }

  try {
    const saved = sessionStorage.getItem(PERFORMANCE_SESSION_KEY);
    if (saved && saved.length >= 8) {
      return saved;
    }

    const generated = createFallbackSessionId();
    sessionStorage.setItem(PERFORMANCE_SESSION_KEY, generated);
    return generated;
  } catch {
    return createFallbackSessionId();
  }
}

function getMetricValue(
  metrics: AnalyticsPayload["metrics"],
  name: keyof typeof PERFORMANCE_BUDGETS
): number | null {
  const metric = metrics[name];
  if (!metric || !Number.isFinite(metric.value)) return null;
  if (name === "CLS") return Number(metric.value.toFixed(3));
  return Number(metric.value.toFixed(0));
}

function buildCoreVitalsLogEntry(payload: AnalyticsPayload): WorkerLogEntry {
  return {
    level: payload.overall.passed ? "info" : "warn",
    message: "core_web_vitals",
    timestamp: new Date(payload.context.timestamp).toISOString(),
    context: {
      category: "performance",
      event: "core_web_vitals",
      passed: payload.overall.passed,
      failedMetrics: payload.overall.failedMetrics.join(",") || "none",
      metricCount: Object.keys(payload.metrics).length,
      lcp: getMetricValue(payload.metrics, "LCP") ?? -1,
      inp: getMetricValue(payload.metrics, "INP") ?? -1,
      cls: getMetricValue(payload.metrics, "CLS") ?? -1,
      fcp: getMetricValue(payload.metrics, "FCP") ?? -1,
      ttfb: getMetricValue(payload.metrics, "TTFB") ?? -1,
      path: window.location.pathname
    }
  };
}

function buildCustomTimingLogEntry(payload: CustomTimingPayload): WorkerLogEntry {
  return {
    level: "info",
    message: "custom_timing",
    timestamp: new Date(payload.timestamp).toISOString(),
    context: {
      category: "performance",
      event: "custom_timing",
      metric: payload.name.slice(0, 100),
      durationMs: Number(payload.value.toFixed(2)),
      path: window.location.pathname,
      hasMetadata: Boolean(payload.metadata)
    }
  };
}

function toWorkerLogPayload(entries: WorkerLogEntry[]): WorkerLogPayload {
  return {
    sessionId: getTelemetrySessionId(),
    timestamp: new Date().toISOString(),
    entries
  };
}

function sendTelemetry(endpoint: string, body: unknown): void {
  const serialized = JSON.stringify(body);
  const payloadBlob = new Blob([serialized], { type: "application/json" });

  if ("sendBeacon" in navigator) {
    try {
      const sent = navigator.sendBeacon(endpoint, payloadBlob);
      if (sent) return;
    } catch {
      // Fallback to fetch below
    }
  }

  if (typeof fetch !== "function") {
    return;
  }

  fetch(endpoint, {
    method: "POST",
    body: serialized,
    keepalive: true,
    headers: {
      "Content-Type": "application/json"
    }
  }).catch((error) => {
    console.warn("[Performance] Failed to report metrics:", error);
  });
}

/**
 * Report metrics to analytics endpoint.
 * Uses sendBeacon for reliable delivery even on page unload.
 */
function reportToAnalytics(payload: AnalyticsPayload, endpoint: string): void {
  if (isWorkerLoggingEndpoint(endpoint)) {
    sendTelemetry(endpoint, toWorkerLogPayload([buildCoreVitalsLogEntry(payload)]));
  } else {
    sendTelemetry(endpoint, payload);
  }

  // Log to console in development for debugging
  if (import.meta.env?.DEV) {
    console.table(
      Object.entries(payload.metrics).map(([name, metric]) => ({
        metric: name,
        value: `${metric.value.toFixed(0)}ms`,
        rating: metric.rating,
        budget: `${metric.budget}ms`
      }))
    );
  }
}

/**
 * Metrics collector that aggregates all Core Web Vitals.
 */
class MetricsCollector {
  private metrics = new Map<string, EnrichedMetric>();
  private expectedMetrics = 5;
  private reportTimeout: ReturnType<typeof setTimeout> | null = null;
  private maxWaitTime = 10000; // 10 seconds max wait
  private endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
    // Set a timeout to report whatever we have after maxWaitTime
    this.reportTimeout = setTimeout(() => {
      this.flush();
    }, this.maxWaitTime);
  }

  /**
   * Add a metric to the collection.
   */
  add(metric: Metric): void {
    const enriched = enrichMetric(metric);
    this.metrics.set(metric.name, enriched);

    // Clear the timeout since we received a metric
    if (this.reportTimeout) {
      clearTimeout(this.reportTimeout);
      this.reportTimeout = null;
    }

    // Report when all metrics are collected
    if (this.metrics.size >= this.expectedMetrics) {
      this.flush();
    } else {
      // Set a new timeout for remaining metrics
      this.reportTimeout = setTimeout(() => {
        this.flush();
      }, 2000);
    }
  }

  /**
   * Flush collected metrics to analytics.
   */
  private flush(): void {
    if (this.reportTimeout) {
      clearTimeout(this.reportTimeout);
      this.reportTimeout = null;
    }

    if (this.metrics.size === 0) return;

    const metricsEntries = Object.fromEntries(this.metrics);
    const failedMetrics = Object.values(metricsEntries)
      .filter((m) => !m.passed)
      .map((m) => m.name);

    const payload: AnalyticsPayload = {
      metrics: metricsEntries,
      context: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: Date.now(),
        connection: getConnectionInfo()
      },
      overall: {
        passed: failedMetrics.length === 0,
        failedMetrics
      }
    };

    reportToAnalytics(payload, this.endpoint);
    (window as unknown as { _performanceMetrics?: AnalyticsPayload })._performanceMetrics = payload;

    // Emit custom event for potential custom integrations
    window.dispatchEvent(new CustomEvent("performance:metrics", {
      detail: payload
    }));
  }
}

/**
 * Initialize Core Web Vitals tracking.
 * Call this early in the application lifecycle.
 */
export function initPerformanceTracking(options?: {
  reportEndpoint?: string;
  debug?: boolean;
  enabled?: boolean;
}): void {
  if (options?.enabled === false) {
    return;
  }

  runtimePerformanceEndpoint = normalizeReportEndpoint(options?.reportEndpoint);
  const collector = new MetricsCollector(runtimePerformanceEndpoint);

  // Track all Core Web Vitals
  onLCP((metric: LCPMetric) => collector.add(metric));
  onINP((metric: INPMetric) => collector.add(metric));
  onCLS((metric: CLSMetric) => collector.add(metric));
  onFCP((metric: FCPMetric) => collector.add(metric));
  onTTFB((metric: TTFBMetric) => collector.add(metric));

  // Expose budget checking globally for debugging
  if (import.meta.env?.DEV || options?.debug) {
    (window as unknown as { performanceBudgets: typeof PERFORMANCE_BUDGETS }).performanceBudgets = PERFORMANCE_BUDGETS;
  }
}

/**
 * Manually report a performance event.
 * Useful for custom timing measurements.
 */
export function reportCustomTiming(name: string, duration: number, metadata?: Record<string, unknown>): void {
  const payload: CustomTimingPayload = {
    name,
    value: duration,
    metadata,
    timestamp: Date.now(),
    url: window.location.href
  };

  if (isWorkerLoggingEndpoint(runtimePerformanceEndpoint)) {
    sendTelemetry(runtimePerformanceEndpoint, toWorkerLogPayload([buildCustomTimingLogEntry(payload)]));
    return;
  }

  sendTelemetry(runtimePerformanceEndpoint, { type: "custom", ...payload });
}

/**
 * Check if the current page passes performance budgets.
 * Returns null if metrics haven't been collected yet.
 */
export function checkPerformanceBudgets(): { passed: boolean; metrics: Record<string, boolean> } | null {
  const event = (window as unknown as { _performanceMetrics?: AnalyticsPayload })._performanceMetrics;
  if (!event) return null;

  const metrics: Record<string, boolean> = {};
  let passed = true;

  for (const [name, metric] of Object.entries(event.metrics)) {
    metrics[name] = metric.passed;
    if (!metric.passed) passed = false;
  }

  return { passed, metrics };
}

/**
 * Mark a performance milestone using the Performance API.
 */
export function markPerformance(name: string): void {
  if ("performance" in window && "mark" in performance) {
    performance.mark(name);
  }
}

/**
 * Measure time between two performance marks.
 */
export function measurePerformance(name: string, startMark: string, endMark: string): number | undefined {
  if ("performance" in window && "measure" in performance) {
    try {
      performance.measure(name, startMark, endMark);
      const entries = performance.getEntriesByName(name, "measure");
      if (entries.length > 0) {
        return entries[0].duration;
      }
    } catch {
      // Marks may not exist yet
    }
  }
  return undefined;
}

/**
 * Observe Long Animation Frames for detecting jank.
 * Returns a cleanup function.
 */
export function observeLongAnimations(callback: (duration: number) => void): () => void {
  if (!("PerformanceObserver" in window)) {
    return () => {};
  }

  let observer: PerformanceObserver | null = null;

  try {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) { // Long animation frame: > 50ms
          callback(entry.duration);
        }
      }
    });

    observer.observe({ entryTypes: ["long-animation-frame"] });
  } catch {
    // long-animation-frame not supported in all browsers
  }

  return () => {
    observer?.disconnect();
  };
}

/**
 * Get current memory usage if available (Chrome-specific).
 */
export function getMemoryUsage(): {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
} | null {
  const memory = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  return memory ?? null;
}

/**
 * Resource loading performance observer.
 * Tracks long tasks and resource loading times.
 */
export function observeResourceLoading(callback?: (entries: PerformanceEntry[]) => void): () => void {
  if (!("PerformanceObserver" in window)) {
    return () => {};
  }

  let observer: PerformanceObserver | null = null;

  try {
    observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      callback?.(entries);

      // Log slow resources in development
      if (import.meta.env?.DEV) {
        for (const entry of entries) {
          if (entry.duration > 1000) {
            console.warn(`[Performance] Slow resource: ${entry.name} took ${entry.duration.toFixed(0)}ms`);
          }
        }
      }
    });

    observer.observe({ entryTypes: ["resource"] });
  } catch {
    // Resource timing not supported
  }

  return () => {
    observer?.disconnect();
  };
}

/**
 * Measure interaction latency for specific events.
 * Useful for tracking click handlers and input responses.
 */
export function measureInteractionLatency(
  element: EventTarget,
  eventType: string,
  threshold = 100
): () => void {
  const startMark = `interaction-${eventType}-start`;
  const endMark = `interaction-${eventType}-end`;
  const measureName = `interaction-${eventType}`;

  const handler = (event: Event) => {
    performance.mark(startMark);

    // Use setTimeout to measure after event processing
    setTimeout(() => {
      performance.mark(endMark);
      performance.measure(measureName, startMark, endMark);

      const entries = performance.getEntriesByName(measureName, "measure");
      const duration = entries[entries.length - 1]?.duration;

      if (duration && duration > threshold) {
        console.warn(`[Performance] Slow ${eventType} handler: ${duration.toFixed(0)}ms`, event.target);
      }

      // Cleanup old entries
      performance.clearMarks(startMark);
      performance.clearMarks(endMark);
      if (entries.length > 10) {
        performance.clearMeasures(measureName);
      }
    }, 0);
  };

  element.addEventListener(eventType, handler);

  return () => {
    element.removeEventListener(eventType, handler);
  };
}

/**
 * Preload critical resources with priority hints.
 */
export function preloadResource(
  href: string,
  as: "script" | "style" | "font" | "image" | "fetch",
  options?: { type?: string; crossorigin?: boolean; priority?: "high" | "low" | "auto" }
): void {
  const link = document.createElement("link");
  link.rel = "preload";
  link.href = href;
  link.as = as;

  if (options?.type) link.type = options.type;
  if (options?.crossorigin) link.crossOrigin = "anonymous";
  if (options?.priority && "fetchPriority" in link) {
    (link as HTMLLinkElement & { fetchPriority: string }).fetchPriority = options.priority;
  }

  document.head.appendChild(link);
}

/**
 * Prefetch resources for future navigation.
 */
export function prefetchResource(href: string): void {
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = href;
  document.head.appendChild(link);
}

/**
 * Initialize comprehensive performance monitoring.
 * Call this for detailed performance tracking beyond Core Web Vitals.
 */
export function initDetailedPerformanceMonitoring(): () => void {
  const cleanupFns: Array<() => void> = [];

  // Observe long animations
  cleanupFns.push(observeLongAnimations((duration) => {
    if (import.meta.env?.DEV) {
      console.warn(`[Performance] Long animation frame: ${duration.toFixed(0)}ms`);
    }
  }));

  // Observe resource loading
  cleanupFns.push(observeResourceLoading());

  // Measure scroll performance
  let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
  const scrollHandler = () => {
    performance.mark("scroll-start");
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      performance.mark("scroll-end");
      performance.measure("scroll-duration", "scroll-start", "scroll-end");
      const entries = performance.getEntriesByName("scroll-duration", "measure");
      const duration = entries[entries.length - 1]?.duration;
      if (duration && duration > 16) { // Target 60fps = 16ms per frame
        console.warn(`[Performance] Scroll jank detected: ${duration.toFixed(1)}ms`);
      }
    }, 100);
  };
  window.addEventListener("scroll", scrollHandler, { passive: true });
  cleanupFns.push(() => window.removeEventListener("scroll", scrollHandler));

  return () => {
    cleanupFns.forEach(fn => fn());
  };
}
