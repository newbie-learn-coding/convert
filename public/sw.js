/**
 * Convert To It Service Worker
 * Cache-first strategy for static assets, network-first for dynamic content
 * Supports offline conversion for common formats
 */

const CACHE_VERSION = "v2";
const CACHE_PREFIX = "converttoit-";

// Cache configuration
const CONFIG = {
  PRECACHE_CACHE: `${CACHE_PREFIX}precache-${CACHE_VERSION}`,
  RUNTIME_CACHE: `${CACHE_PREFIX}runtime-${CACHE_VERSION}`,
  WASM_CACHE: `${CACHE_PREFIX}wasm-${CACHE_VERSION}`,
  MAX_CACHE_SIZE: 100 * 1024 * 1024, // 100MB
  CACHE_EXPIRATION_MS: 30 * 24 * 60 * 60 * 1000, // 30 days
  // Cache strategies with priorities
  CACHE_PRIORITIES: {
    CRITICAL: 1, // App shell, core JS/CSS
    IMPORTANT: 2, // WASM modules
    NORMAL: 3, // Images, fonts
    LOW: 4, // Other assets
  },
};

// Core assets to pre-cache - app shell and critical files
const PRECACHE_ASSETS = [
  "/",
  "/cache.json",
  "/apple-touch-icon.png",
  "/favicon.svg",
  "/favicon.ico",
];

// Common WASM modules for offline conversion
const WASM_ASSETS = [
  "/wasm/reflo_bg.wasm",
  "/wasm/magick.wasm",
  "/wasm/libopenmpt.wasm",
];

// Routes that require network-first (API, dynamic content)
const NETWORK_FIRST_ROUTES = [
  "/cache.json",
];

// Install event - pre-cache critical assets
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker:", CACHE_VERSION);

  event.waitUntil(
    (async () => {
      const cache = await caches.open(CONFIG.PRECACHE_CACHE);
      try {
        await Promise.allSettled(
          PRECACHE_ASSETS.map(url =>
            cache.add(new Request(url, { cache: "reload" })).catch(e =>
              console.warn("[SW] Failed to pre-cache:", url, e.message)
            )
          )
        );
        console.log("[SW] Pre-cached core assets");
      } catch (error) {
        console.warn("[SW] Some assets failed to pre-cache:", error);
      }
      // Pre-cache WASM modules separately
      try {
        const wasmCache = await caches.open(CONFIG.WASM_CACHE);
        await wasmCache.addAll(WASM_ASSETS.map(url => new Request(url, { cache: "reload" })));
        console.log("[SW] Pre-cached WASM modules");
      } catch (error) {
        console.warn("[SW] Some WASM modules failed to pre-cache:", error);
      }
    })()
  );

  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker:", CACHE_VERSION);

  event.waitUntil(
    (async () => {
      // Delete old caches
      const cacheNames = await caches.keys();
      const oldCaches = cacheNames.filter(name => {
        return name.startsWith(CACHE_PREFIX) && !name.includes(CACHE_VERSION);
      });

      await Promise.all(
        oldCaches.map(name => {
          console.log("[SW] Deleting old cache:", name);
          return caches.delete(name);
        })
      );

      // Take control of all clients
      await self.clients.claim();
    })()
  );
});

// Helper: Determine cache strategy based on request
function getStrategy(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Static assets (JS, CSS, WASM) - cache first
  if (/\.(?:js|css|wasm|svg|ico|png|jpg|jpeg|webp|woff2?|ttf|otf)$/.test(pathname)) {
    return "cacheFirst";
  }

  // Network-first routes
  if (NETWORK_FIRST_ROUTES.some(route => pathname === route)) {
    return "networkFirst";
  }

  // HTML pages - stale while revalidate
  if (pathname.endsWith("/") || pathname.endsWith(".html")) {
    return "staleWhileRevalidate";
  }

  // Default to network first for other requests
  return "networkFirst";
}

// Helper: Cache-first strategy with stale-while-revalidate for non-critical assets
async function cacheFirst(request, cacheName = CONFIG.RUNTIME_CACHE, options = {}) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Return cached immediately if available
  if (cached) {
    // For non-critical assets, refresh cache in background (stale-while-revalidate)
    if (options.staleWhileRevalidate) {
      fetch(request).then((response) => {
        if (response.ok && request.method === "GET") {
          putResponse(cache, request, response.clone());
        }
      }).catch(() => {});
    }
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok && request.method === "GET") {
      await putResponse(cache, request, response.clone());
    }
    return response;
  } catch (error) {
    // Return a custom offline response for HTML
    if (request.headers.get("accept")?.includes("text/html")) {
      return new Response(
        `<!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Offline - Convert To It</title>
          <style>
            body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
            .offline { text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 400px; }
            h1 { color: #1C77FF; margin: 0 0 1rem 0; }
            p { color: #666; line-height: 1.6; }
            .icon { font-size: 4rem; margin-bottom: 1rem; }
          </style>
        </head>
        <body>
          <div class="offline">
            <div class="icon">📡</div>
            <h1>You're Offline</h1>
            <p>Check your internet connection. Some features may be unavailable until you reconnect.</p>
            <p>Previously cached conversions and basic tools may still work.</p>
          </div>
        </body>
        </html>`,
        {
          status: 503,
          statusText: "Service Unavailable",
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
      );
    }
    throw error;
  }
}

// Helper: Network-first strategy with timeout
async function networkFirst(request, cacheName = CONFIG.RUNTIME_CACHE, timeout = 5000) {
  const cache = await caches.open(cacheName);

  // Create a timeout promise
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Network timeout")), timeout);
  });

  try {
    // Race between fetch and timeout
    const response = await Promise.race([
      fetch(request),
      timeoutPromise
    ]);

    if (response.ok && request.method === "GET") {
      await putResponse(cache, request, response.clone());
    }
    return response;
  } catch (error) {
    // Network failed or timed out - try cache
    const cached = await cache.match(request);
    if (cached) {
      console.log("[SW] Serving from cache due to network failure:", request.url);
      return cached;
    }
    throw error;
  }
}

// Helper: Stale-while-revalidate strategy
async function staleWhileRevalidate(request, cacheName = CONFIG.RUNTIME_CACHE) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Fetch in background and update cache
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok && request.method === "GET") {
      putResponse(cache, request, response.clone());
    }
    return response;
  }).catch(() => null);

  // Return cached version immediately, or wait for network if no cache
  return cached || fetchPromise;
}

// Helper: Store response with cache size management and metadata
async function putResponse(cache, request, response) {
  // Add cache timestamp for expiration tracking
  const headers = new Headers(response.headers);
  headers.set("sw-cache-time", Date.now().toString());

  const enhancedResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers,
  });

  // Check cache size before adding
  await enforceCacheSizeLimit(cache);
  await cache.put(request, enhancedResponse);
}

// Helper: Enforce cache size limit
async function enforceCacheSizeLimit(cache) {
  const keys = await cache.keys();
  let totalSize = 0;

  // Calculate total cache size
  for (const request of keys) {
    const response = await cache.match(request);
    if (response) {
      const blob = await response.blob();
      totalSize += blob.size;
    }
  }

  // If over limit, remove oldest entries
  if (totalSize > CONFIG.MAX_CACHE_SIZE) {
    console.log("[SW] Cache size limit reached, cleaning up...");
    const sortedKeys = [...keys].reverse(); // Remove oldest first

    for (const request of sortedKeys) {
      if (totalSize <= CONFIG.MAX_CACHE_SIZE * 0.8) break; // Leave 20% headroom

      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        totalSize -= blob.size;
      }
      await cache.delete(request);
    }
  }
}

// Fetch event - route requests based on strategy
self.addEventListener("fetch", (event) => {
  // Only handle GET requests
  if (event.request.method !== "GET") return;

  // Skip non-HTTP requests
  if (!event.request.url.startsWith("http")) return;

  // Skip cross-origin requests — let the browser handle them directly
  try {
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;
  } catch {
    return;
  }

  const strategy = getStrategy(event.request);

  event.respondWith(
    (async () => {
      try {
        switch (strategy) {
          case "cacheFirst": {
            // Use stale-while-revalidate for non-critical assets
            const isCritical = PRECACHE_ASSETS.some(url => event.request.url.includes(url));
            return await cacheFirst(event.request, CONFIG.PRECACHE_CACHE, {
              staleWhileRevalidate: !isCritical
            });
          }
          case "networkFirst":
            return await networkFirst(event.request, CONFIG.RUNTIME_CACHE, 5000);
          case "staleWhileRevalidate":
            return await staleWhileRevalidate(event.request, CONFIG.RUNTIME_CACHE);
          default:
            return await networkFirst(event.request, CONFIG.RUNTIME_CACHE, 5000);
        }
      } catch (error) {
        console.error("[SW] Fetch failed:", error);
        // Return offline response for navigation requests
        if (event.request.mode === "navigate") {
          const cache = await caches.open(CONFIG.PRECACHE_CACHE);
          const offlineResponse = await cache.match("/");
          if (offlineResponse) return offlineResponse;
        }
        throw error;
      }
    })()
  );
});

// Background sync for failed conversions (basic implementation)
self.addEventListener("sync", (event) => {
  if (event.tag === "conversion-retry") {
    event.waitUntil(
      (async () => {
        // Notify clients about sync event
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
          client.postMessage({
            type: "BACKGROUND_SYNC",
            tag: event.tag,
          });
        });
      })()
    );
  }
});

// Handle messages from clients
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data && event.data.type === "GET_VERSION") {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
  if (event.data && event.data.type === "CLEAR_CACHE") {
    event.waitUntil(
      (async () => {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(name => caches.delete(name))
        );
        event.ports[0].postMessage({ cleared: true });
      })()
    );
  }
});

// Clean up expired cache entries periodically
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "cache-cleanup") {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CONFIG.RUNTIME_CACHE);
        const keys = await cache.keys();
        const now = Date.now();

        for (const request of keys) {
          const response = await cache.match(request);
          if (response) {
            const cacheTime = response.headers.get("sw-cache-time");
            if (cacheTime && (now - parseInt(cacheTime)) > CONFIG.CACHE_EXPIRATION_MS) {
              await cache.delete(request);
            }
          }
        }
      })()
    );
  }
});
