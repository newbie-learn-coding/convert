/**
 * Core Web Vitals monitoring and reporting module.
 * Tracks LCP, FID, CLS, FCP, TTFB with analytics reporting.
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

/**
 * Report metrics to analytics endpoint.
 * Uses sendBeacon for reliable delivery even on page unload.
 */
function reportToAnalytics(payload: AnalyticsPayload): void {
  const endpoint = "/api/analytics/performance";

  // Use sendBeacon for reliable delivery during page unload
  if ("sendBeacon" in navigator) {
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    navigator.sendBeacon(endpoint, blob);
  } else {
    // Fallback to fetch API
    fetch(endpoint, {
      method: "POST",
      body: JSON.stringify(payload),
      keepalive: true,
      headers: {
        "Content-Type": "application/json"
      }
    }).catch((error) => {
      console.warn("[Performance] Failed to report metrics:", error);
    });
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

  constructor() {
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

    reportToAnalytics(payload);

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
}): void {
  // Skip tracking in some environments if needed
  if (options?.debug === false && !import.meta.env?.DEV) {
    return;
  }

  const collector = new MetricsCollector();

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
  const payload = {
    name,
    value: duration,
    metadata,
    timestamp: Date.now(),
    url: window.location.href
  };

  if ("sendBeacon" in navigator) {
    const blob = new Blob([JSON.stringify({ type: "custom", ...payload })], { type: "application/json" });
    navigator.sendBeacon("/api/analytics/performance", blob);
  }
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
