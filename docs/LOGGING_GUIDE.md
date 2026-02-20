# Error Tracking and Logging System

## Overview

Comprehensive error tracking and logging system for converttoit.com with:
- Structured logging with levels (debug, info, warn, error, critical)
- Client-side error aggregation and batching
- Privacy-first (automatic PII redaction)
- Offline support (queue errors)
- Conversion success/failure metrics
- Health check monitoring

## Architecture

### Client-Side (`src/logging.ts`)

```
Logger (singleton)
├── Log buffer (max 100 entries)
├── Metrics tracking
├── Batch timer (30s flush interval)
├── Offline queue support
└── Global error handlers
```

### Server-Side (`cloudflare/worker/index.mjs`)

- POST `/_ops/logs` - Client error reporting endpoint
- Built-in rate limiting (50 requests/60s)
- CORS support
- Metrics aggregation

## Usage

### Basic Logging

```typescript
import { log } from "./logging.js";

// Basic logging
log.debug("category", "message");
log.info("category", "message");
log.warn("category", "message");
log.error("category", "message", errorOrContext);
log.critical("category", "message", error, context);

// With context
log.info("conversion", "Starting conversion", {
  inputFormat: "png",
  outputFormat: "jpg",
  fileCount: 5
});

// With error
log.error("handler", "Initialization failed", error, {
  handlerName: "FFmpeg"
});
```

### Tracking Conversions

```typescript
// Track conversion attempt
log.trackConversion.attempt("png", "jpg", fileCount, totalSize);

// Track success
log.trackConversion.success(
  "png", 
  "jpg", 
  durationMs, 
  fileCount, 
  totalSize, 
  "FFmpeg" // handler name (optional)
);

// Track failure
log.trackConversion.failure("png", "jpg", "no_route_found", fileCount);
```

### Tracking Handler Events

```typescript
log.trackHandler("FFmpeg", true); // success
log.trackHandler("ImageMagick", false); // failed

log.trackWasmFailure("sqlite3.wasm", error);
```

### User Interactions

```typescript
log.trackInteraction("button_click");
log.trackInteraction("format_select", true);
log.trackInteraction("download_failed", false, error);
```

### Getting Metrics

```typescript
const metrics = log.getMetrics();
// {
//   conversionsAttempted: 10,
//   conversionsSucceeded: 8,
//   conversionsFailed: 2,
//   handlersInitialized: 5,
//   handlersFailed: 0,
//   ...
// }
```

## Testing

### Manual Testing (Development)

```javascript
// In browser console
window.__logger.getMetrics();        // View metrics
window.__logger.getSessionId();      // View session ID
window.__logger.flush();              // Force flush logs

// Trigger test errors
throw new Error("Test error");        // Unhandled error
Promise.reject("test");               // Unhandled rejection
```

### Test Scenarios

1. **Conversion Tracking**
   - Convert a file successfully
   - Try invalid conversion path
   - Cancel mid-conversion

2. **Error Reporting**
   - Test with network disabled (offline queue)
   - Trigger various error types

3. **Metrics Verification**
   ```bash
   # View Cloudflare Worker logs
   wrangler tail --format pretty
   ```

## Log Viewing

### Cloudflare Worker Logs

```bash
# Tail logs in real-time
wrangler tail

# View logs for specific worker
wrangler tail converttoit-site

# Filter by log level
wrangler tail | grep "client_error"
```

### Metrics Dashboard

Access metrics at:
- `/_ops/health` - Health check with metrics
- `/_ops/metrics` - Detailed metrics (requires auth)

## Alerting Setup

### Cloudflare Analytics

1. Go to Workers & Pages > your worker
2. Enable Observability (already enabled)
3. Set up alerts for:
   - Error rate > 5%
   - Response time > 1s
   - Rate limit triggers

### Log-Based Alerts

Monitor for these patterns:
- `"level":"critical"` - Immediate alert
- `"errorType":"wasm_load_failure"` - Investigate WASM issues
- `"conversionsFailed"` increasing - Conversion problems

## Privacy

### PII Redaction

The following patterns are automatically redacted:
- Email addresses → `[EMAIL]`
- SSN patterns → `[SSN]`
- Credit card numbers → `[CREDIT_CARD]`
- Phone numbers → `[PHONE]`
- Tokens/keys → `[REDACTED]`

### Data Retention

- Client-side: Max 100 log entries in buffer
- Session storage: Cleared after successful flush
- Server-side: Cloudflare Workers Analytics retention

## Configuration

### Environment Variables

```toml
# wrangler.toml
[vars]
ENVIRONMENT = "production"
APP_VERSION = "1.0.0"  # Auto-populated

# Optional: Add to environment
OPS_LOG_TOKEN = "your-token-here"  # For protected ops endpoints
OPS_METRICS_TOKEN = "your-metrics-token"  # Required for /_ops/metrics scraping
```

### Tuning Parameters

```typescript
// In src/logging.ts
const MAX_LOG_ENTRIES = 100;        // Buffer size
const BATCH_SEND_INTERVAL = 30000;  // 30 seconds
const MAX_BATCH_SIZE = 50;          // Batch size
```

## Troubleshooting

### Logs Not Appearing

1. Check network tab for `/_ops/logs` requests
2. Verify CORS headers
3. Check rate limit status
4. Look for browser console errors

### High Error Rate

1. Check specific error categories in logs
2. Verify WASM modules are loading
3. Check handler initialization failures
4. Review conversion paths for issues

### Memory Issues

- Log buffer automatically limits to 100 entries
- Conversion metrics accumulate indefinitely (consider periodic reset)
- Use `log.getMetrics()` to monitor
