/**
 * Comprehensive error tracking and logging system for converttoit.com
 * Privacy-first, production-ready observability with offline support
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export type LogLevel = "debug" | "info" | "warn" | "error" | "critical";

export interface LogContext {
  [key: string]: string | number | boolean | null | undefined;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface ErrorReport {
  sessionId: string;
  timestamp: string;
  appVersion: string;
  userAgent: string;
  url: string;
  entries: LogEntry[];
  metrics: ErrorMetrics;
  environment: EnvironmentInfo;
}

export interface ErrorMetrics {
  conversionsAttempted: number;
  conversionsSucceeded: number;
  conversionsFailed: number;
  handlersInitialized: number;
  handlersFailed: number;
  wasmLoadsFailed: number;
  userInteractions: number;
  userInteractionErrors: number;
}

export interface EnvironmentInfo {
  browser?: string;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  language: string;
  cookieEnabled: boolean;
  onLine: boolean;
  screen: {
    width: number;
    height: number;
    colorDepth: number;
  };
  viewport: {
    width: number;
    height: number;
  };
}

export interface ConversionMetric {
  inputFormat: string;
  outputFormat: string;
  success: boolean;
  duration: number;
  fileCount: number;
  totalSize: number;
  handlerName?: string;
  errorType?: string;
}

// ============================================================================
// Constants
// ============================================================================

export const LOG_ENDPOINT = "/_ops/logs";
const MAX_LOG_ENTRIES = 100;
const MAX_ERROR_STACK_LENGTH = 1000;
const BATCH_SEND_INTERVAL = 30000; // 30 seconds
const MAX_BATCH_SIZE = 50;

// Patterns for PII redaction (privacy-first)
const PII_PATTERNS = [
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: "[EMAIL]" },
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[SSN]" },
  { pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, replacement: "[CREDIT_CARD]" },
  { pattern: /\b\d{3}-\d{3}-\d{4}\b/g, replacement: "[PHONE]" },
  { pattern: /token["\s:]+["']?[A-Za-z0-9._-]+["']?/gi, replacement: "token:[REDACTED]" },
  { pattern: /password["\s:]+["']?[A-Za-z0-9._-]+["']?/gi, replacement: "password:[REDACTED]" },
];

// ============================================================================
// Session ID Generator
// ============================================================================

function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${random}`;
}

// ============================================================================
// PII Sanitizer
// ============================================================================

function sanitizeString(input: string): string {
  let sanitized = input;
  
  for (const { pattern, replacement } of PII_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  
  return sanitized;
}

function sanitizeError(error: Error): { name: string; message: string; stack?: string } {
  return {
    name: sanitizeString(error.name),
    message: sanitizeString(error.message),
    stack: error.stack 
      ? sanitizeString(error.stack.substring(0, MAX_ERROR_STACK_LENGTH))
      : undefined
  };
}

function sanitizeContext(context?: LogContext): LogContext | undefined {
  if (!context) return undefined;
  
  const sanitized: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    if (value === null || value === undefined) {
      sanitized[key] = value;
    } else if (typeof value === "string") {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === "number" || typeof value === "boolean") {
      sanitized[key] = value;
    } else {
      sanitized[key] = "[REDACTED]";
    }
  }
  return sanitized;
}

// ============================================================================
// Environment Info Collector
// ============================================================================

function getEnvironmentInfo(): EnvironmentInfo {
  const screen = window.screen;
  const navigator_info = navigator;
  
  // Detect browser from user agent
  const ua = navigator_info.userAgent;
  let browser = "unknown";
  if (ua.includes("Firefox")) browser = "firefox";
  else if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "chrome";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "safari";
  else if (ua.includes("Edg")) browser = "edge";
  
  return {
    browser,
    deviceMemory: (navigator_info as unknown as { deviceMemory?: number }).deviceMemory,
    hardwareConcurrency: navigator_info.hardwareConcurrency,
    language: navigator_info.language,
    cookieEnabled: navigator_info.cookieEnabled,
    onLine: navigator_info.onLine,
    screen: {
      width: screen.width,
      height: screen.height,
      colorDepth: screen.colorDepth
    },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    }
  };
}

// ============================================================================
// Main Logger Class
// ============================================================================

class Logger {
  private sessionId: string;
  private logBuffer: LogEntry[] = [];
  private metrics: ErrorMetrics;
  private conversionMetrics: ConversionMetric[] = [];
  private sendTimer: ReturnType<typeof setTimeout> | null = null;
  private isOnline: boolean = navigator.onLine;
  private pendingFlush: boolean = false;
  private appVersion: string;
  
  constructor() {
    this.sessionId = generateSessionId();
    this.appVersion = (window as unknown as { APP_VERSION?: string }).APP_VERSION || "unknown";
    this.metrics = this.createEmptyMetrics();
    this.setupEventListeners();
    this.startBatchTimer();
  }
  
  private createEmptyMetrics(): ErrorMetrics {
    return {
      conversionsAttempted: 0,
      conversionsSucceeded: 0,
      conversionsFailed: 0,
      handlersInitialized: 0,
      handlersFailed: 0,
      wasmLoadsFailed: 0,
      userInteractions: 0,
      userInteractionErrors: 0
    };
  }
  
  private setupEventListeners(): void {
    // Track online/offline status
    window.addEventListener("online", () => {
      this.isOnline = true;
      this.info("connection", "Device came online");
      if (this.pendingFlush) {
        this.flush();
      }
    });
    
    window.addEventListener("offline", () => {
      this.isOnline = false;
      this.warn("connection", "Device went offline");
    });
    
    // Track visibility changes for better batching
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.flush();
      }
    });
    
    // Flush on page unload
    window.addEventListener("beforeunload", () => {
      this.flushSync();
    });
    
    // Persist buffer to sessionStorage for recovery across reloads
    try {
      const saved = sessionStorage.getItem("logBuffer");
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as LogEntry[];
          if (Array.isArray(parsed) && parsed.length < MAX_LOG_ENTRIES) {
            this.logBuffer = parsed;
          }
        } catch {
          // Ignore parse errors
        }
        sessionStorage.removeItem("logBuffer");
      }
    } catch {
      // sessionStorage might not be available
    }
  }
  
  private startBatchTimer(): void {
    if (this.sendTimer) {
      clearInterval(this.sendTimer);
    }
    this.sendTimer = setInterval(() => {
      this.flush();
    }, BATCH_SEND_INTERVAL);
  }
  
  private addLog(level: LogLevel, category: string, message: string, context?: LogContext, error?: Error): void {
    const entry: LogEntry = {
      level,
      message: sanitizeString(message),
      timestamp: new Date().toISOString(),
      context: sanitizeContext({
        category,
        ...context
      })
    };
    
    if (error) {
      entry.error = sanitizeError(error);
    }
    
    this.logBuffer.push(entry);
    
    // Keep buffer size in check
    if (this.logBuffer.length > MAX_LOG_ENTRIES) {
      this.logBuffer = this.logBuffer.slice(-MAX_LOG_ENTRIES);
    }
    
    // Persist to sessionStorage for crash recovery
    try {
      sessionStorage.setItem("logBuffer", JSON.stringify(this.logBuffer));
    } catch {
      // Ignore storage errors
    }
    
    // Immediate flush for critical errors
    if (level === "critical" && this.isOnline) {
      this.flush();
    }
  }
  
  public debug(category: string, message: string, context?: LogContext): void {
    this.addLog("debug", category, message, context);
  }
  
  public info(category: string, message: string, context?: LogContext): void {
    this.addLog("info", category, message, context);
  }
  
  public warn(category: string, message: string, context?: LogContext): void {
    this.addLog("warn", category, message, context);
  }
  
  public error(category: string, message: string, errorOrContext?: Error | LogContext, context?: LogContext): void {
    if (errorOrContext instanceof Error) {
      this.addLog("error", category, message, context, errorOrContext);
    } else {
      this.addLog("error", category, message, errorOrContext);
    }
  }
  
  public critical(category: string, message: string, error?: Error, context?: LogContext): void {
    this.addLog("critical", category, message, context, error);
  }
  
  // ============================================================================
  // Metrics Tracking
  // ============================================================================

  public trackConversionAttempt(_inputFormat: string, _outputFormat: string, _fileCount: number, _totalSize: number): void {
    this.metrics.conversionsAttempted++;
  }
  
  public trackConversionSuccess(inputFormat: string, outputFormat: string, duration: number, fileCount: number, totalSize: number, handlerName?: string): void {
    this.metrics.conversionsSucceeded++;
    this.conversionMetrics.push({
      inputFormat,
      outputFormat,
      success: true,
      duration,
      fileCount,
      totalSize,
      handlerName
    });
    this.info("conversion", `Success: ${inputFormat} → ${outputFormat}`, { 
      duration, 
      fileCount, 
      handlerName 
    });
  }
  
  public trackConversionFailure(inputFormat: string, outputFormat: string, errorType: string, fileCount?: number): void {
    this.metrics.conversionsFailed++;
    this.conversionMetrics.push({
      inputFormat,
      outputFormat,
      success: false,
      duration: 0,
      fileCount: fileCount || 0,
      totalSize: 0,
      errorType
    });
    this.error("conversion", `Failed: ${inputFormat} → ${outputFormat}`, { errorType, fileCount });
  }
  
  public trackHandlerInit(handlerName: string, success: boolean): void {
    if (success) {
      this.metrics.handlersInitialized++;
      this.debug("handler", `Initialized: ${handlerName}`);
    } else {
      this.metrics.handlersFailed++;
      this.error("handler", `Initialization failed: ${handlerName}`);
    }
  }
  
  public trackWasmLoadFailure(moduleName: string, error: Error): void {
    this.metrics.wasmLoadsFailed++;
    this.error("wasm", `WASM load failed: ${moduleName}`, error);
  }
  
  public trackUserInteraction(action: string, success: boolean = true, error?: Error): void {
    this.metrics.userInteractions++;
    if (!success) {
      this.metrics.userInteractionErrors++;
      this.error("interaction", `Action failed: ${action}`, error);
    }
  }
  
  public getMetrics(): Readonly<ErrorMetrics> {
    return { ...this.metrics };
  }

  public getSessionId(): string {
    return this.sessionId;
  }
  
  public getConversionMetrics(): Readonly<ConversionMetric[]> {
    return [...this.conversionMetrics];
  }
  
  // ============================================================================
  // Reporting
  // ============================================================================
  
  private buildReport(): ErrorReport {
    return {
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      appVersion: this.appVersion,
      userAgent: navigator.userAgent,
      url: window.location.href,
      entries: [...this.logBuffer],
      metrics: { ...this.metrics },
      environment: getEnvironmentInfo()
    };
  }
  
  private async sendReport(report: ErrorReport): Promise<boolean> {
    if (!this.isOnline) {
      this.pendingFlush = true;
      return false;
    }
    
    try {
      const response = await fetch(LOG_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(report),
        keepalive: true
      });
      
      if (response.ok) {
        this.logBuffer = [];
        this.pendingFlush = false;
        try {
          sessionStorage.removeItem("logBuffer");
        } catch {
          // Ignore
        }
        return true;
      }
      
      return false;
    } catch (error) {
      this.warn("network", "Failed to send error report", { 
        error: error instanceof Error ? error.message : String(error) 
      });
      this.pendingFlush = true;
      return false;
    }
  }
  
  public async flush(): Promise<void> {
    if (this.logBuffer.length === 0) {
      return;
    }
    
    const batchToSend = this.logBuffer.slice(0, MAX_BATCH_SIZE);
    const report = this.buildReport();
    report.entries = batchToSend;
    
    const success = await this.sendReport(report);
    
    if (success && batchToSend.length === this.logBuffer.length) {
      this.logBuffer = [];
    } else if (success) {
      this.logBuffer = this.logBuffer.slice(batchToSend.length);
    }
  }
  
  private flushSync(): void {
    if (this.logBuffer.length === 0 || !this.isOnline) {
      return;
    }
    
    const report = this.buildReport();
    
    // Use sendBeacon for reliable delivery during page unload
    if ("sendBeacon" in navigator) {
      const blob = new Blob([JSON.stringify(report)], { type: "application/json" });
      navigator.sendBeacon(LOG_ENDPOINT, blob);
      this.logBuffer = [];
    }
  }
  
  public destroy(): void {
    if (this.sendTimer) {
      clearInterval(this.sendTimer);
      this.sendTimer = null;
    }
    this.flushSync();
  }
}

// ============================================================================
// Global Error Handlers
// ============================================================================

class GlobalErrorHandler {
  private logger: Logger;
  private originalOnError: OnErrorEventHandler | null = null;
  private originalOnUnhandledRejection: ((event: PromiseRejectionEvent) => void) | null = null;
  
  constructor(logger: Logger) {
    this.logger = logger;
    this.install();
  }
  
  private install(): void {
    // Track unhandled errors
    this.originalOnError = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
      this.logger.critical("unhandled", String(message), error || undefined, {
        source,
        lineno,
        colno
      });
      
      if (this.originalOnError) {
        return this.originalOnError(message, source, lineno, colno, error);
      }
      return false;
    };
    
    // Track unhandled promise rejections
    this.originalOnUnhandledRejection = window.onunhandledrejection;
    window.onunhandledrejection = (event) => {
      this.logger.critical("promise", "Unhandled promise rejection", event.reason instanceof Error ? event.reason : undefined, {
        reason: String(event.reason)
      });
      
      if (this.originalOnUnhandledRejection) {
        this.originalOnUnhandledRejection(event);
      }
    };
    
    // Track resource loading errors
    window.addEventListener("error", (event) => {
      if (event.target !== window) {
        const target = event.target as HTMLElement;
        this.logger.error("resource", `Failed to load: ${target.tagName}`, {
          tagName: target.tagName,
          src: (target as HTMLImageElement | HTMLScriptElement).src || ""
        });
      }
    }, true);
  }
  
  public destroy(): void {
    if (this.originalOnError) {
      window.onerror = this.originalOnError;
    }
    if (this.originalOnUnhandledRejection) {
      window.onunhandledrejection = this.originalOnUnhandledRejection;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let loggerInstance: Logger | null = null;

export function initLogging(): Logger {
  if (!loggerInstance) {
    loggerInstance = new Logger();
    void new GlobalErrorHandler(loggerInstance);

    // Log initialization
    loggerInstance.info("system", "Logging initialized", {
      sessionId: loggerInstance.getSessionId()
    });

    // Expose limited debug interface to window
    if (import.meta.env?.DEV) {
      (window as unknown as { __logger: unknown }).__logger = {
        getMetrics: () => loggerInstance?.getMetrics(),
        getSessionId: () => loggerInstance?.getSessionId() ?? "none",
        flush: () => loggerInstance?.flush()
      };
    }
  }
  return loggerInstance;
}

export function getLogger(): Logger | null {
  return loggerInstance;
}

// Export convenience functions for direct access
export const log = {
  debug: (category: string, message: string, context?: LogContext) => 
    loggerInstance?.debug(category, message, context),
  
  info: (category: string, message: string, context?: LogContext) => 
    loggerInstance?.info(category, message, context),
  
  warn: (category: string, message: string, context?: LogContext) => 
    loggerInstance?.warn(category, message, context),
  
  error: (category: string, message: string, errorOrContext?: Error | LogContext, context?: LogContext) => 
    loggerInstance?.error(category, message, errorOrContext, context),
  
  critical: (category: string, message: string, error?: Error, context?: LogContext) => 
    loggerInstance?.critical(category, message, error, context),
  
  trackConversion: {
    attempt: (inputFormat: string, outputFormat: string, fileCount: number, totalSize: number) =>
      loggerInstance?.trackConversionAttempt(inputFormat, outputFormat, fileCount, totalSize),
    
    success: (inputFormat: string, outputFormat: string, duration: number, fileCount: number, totalSize: number, handlerName?: string) =>
      loggerInstance?.trackConversionSuccess(inputFormat, outputFormat, duration, fileCount, totalSize, handlerName),
    
    failure: (inputFormat: string, outputFormat: string, errorType: string, fileCount?: number) =>
      loggerInstance?.trackConversionFailure(inputFormat, outputFormat, errorType, fileCount)
  },
  
  trackHandler: (name: string, success: boolean) =>
    loggerInstance?.trackHandlerInit(name, success),
  
  trackWasmFailure: (moduleName: string, error: Error) =>
    loggerInstance?.trackWasmLoadFailure(moduleName, error),
  
  trackInteraction: (action: string, success?: boolean, error?: Error) =>
    loggerInstance?.trackUserInteraction(action, success, error),
  
  getMetrics: () => loggerInstance?.getMetrics(),

  getSessionId: () => loggerInstance?.getSessionId(),
  
  flush: () => loggerInstance?.flush()
};
