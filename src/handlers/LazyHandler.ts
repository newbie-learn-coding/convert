import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";

/**
 * Configuration for lazy handler initialization.
 */
interface LazyHandlerConfig {
  /** Maximum time in milliseconds to wait for initialization (default: 10000) */
  timeout?: number;
  /** Maximum number of retry attempts for transient failures (default: 2) */
  maxRetries?: number;
  /** Delay between retries in milliseconds (default: 1000) */
  retryDelay?: number;
}

/**
 * Wrap a promise with timeout protection.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, handlerName: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      const id = setTimeout(() => {
        reject(new Error(`[LazyHandler] "${handlerName}" initialization timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      promise.finally(() => clearTimeout(id));
    })
  ]);
}

/**
 * Sleep for a specified duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wraps a handler behind a dynamic import so its dependencies are only
 * fetched when the user actually needs that conversion path.
 *
 * Enhanced with timeout protection, retry logic, and comprehensive error handling.
 */
export function lazyHandler(
  meta: {
    name: string;
    supportedFormats: FileFormat[];
    supportAnyInput?: boolean;
  },
  loader: () => Promise<{ default: new () => FormatHandler }>,
  config?: LazyHandlerConfig,
): FormatHandler {
  let instance: FormatHandler | null = null;
  let initPromise: Promise<void> | null = null;
  const {
    timeout = 10000,
    maxRetries = 2,
    retryDelay = 1000
  } = config ?? {};

  return {
    name: meta.name,
    supportedFormats: meta.supportedFormats,
    supportAnyInput: meta.supportAnyInput,
    ready: false,

    async init() {
      // Return existing promise if initialization is in progress
      if (initPromise) {
        await initPromise;
        return;
      }

      // Return immediately if already initialized
      if (instance) {
        return;
      }

      // Create initialization promise
      initPromise = (async () => {
        let lastError: unknown;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const startTime = performance.now();

            // Load the module with timeout protection
            const mod = await withTimeout(loader(), timeout, meta.name);
            instance = new mod.default();

            // Initialize the instance with timeout protection
            await withTimeout(instance.init(), timeout, meta.name);

            const duration = performance.now() - startTime;
            console.log(`[LazyHandler] Initialized "${meta.name}" in ${duration.toFixed(0)}ms`);

            this.ready = instance.ready;
            if (instance.supportedFormats) {
              this.supportedFormats = instance.supportedFormats;
            }
            return;
          } catch (error) {
            lastError = error;
            const isLastAttempt = attempt >= maxRetries;

            if (!isLastAttempt) {
              // Exponential backoff for retries
              const delay = retryDelay * Math.pow(2, attempt);
              console.warn(
                `[LazyHandler] "${meta.name}" initialization failed (attempt ${attempt + 1}/${maxRetries + 1}), ` +
                `retrying in ${delay}ms...`
              );
              await sleep(delay);
            }
          }
        }

        // All retries exhausted
        const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
        console.error(
          `[LazyHandler] Failed to initialize "${meta.name}" after ${maxRetries + 1} attempts: ${errorMessage}`
        );
        throw new Error(`Failed to initialize handler "${meta.name}": ${errorMessage}`);
      })();

      try {
        await initPromise;
      } finally {
        // Clear promise on completion or failure to allow retry
        initPromise = null;
      }
    },

    async doConvert(
      inputFiles: FileData[],
      inputFormat: FileFormat,
      outputFormat: FileFormat,
      args?: string[],
    ): Promise<FileData[]> {
      if (!instance) {
        await this.init();
      }

      if (!instance) {
        throw new Error(`Handler "${meta.name}" failed to initialize and cannot perform conversion`);
      }

      return instance.doConvert(inputFiles, inputFormat, outputFormat, args);
    },
  };
}
