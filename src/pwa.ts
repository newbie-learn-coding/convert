/**
 * PWA Service Worker Registration and Management
 * Handles service worker registration, updates, and offline status
 */

export interface PWAStatus {
  supported: boolean;
  registered: boolean;
  controlled: boolean;
  online: boolean;
  updateAvailable: boolean;
}

export interface ServiceWorkerMessage {
  type: "SKIP_WAITING" | "GET_VERSION" | "CLEAR_CACHE";
}

const SW_PATH = "/sw.js";

let registration: ServiceWorkerRegistration | null = null;
let deferredPrompt: (Event & { prompt?: () => Promise<void>; userChoice?: Promise<{ outcome: "accepted" | "dismissed" }> }) | null = null;

/**
 * Check if service workers are supported
 */
export function isSWSupported(): boolean {
  return "serviceWorker" in navigator;
}

/**
 * Register the service worker
 */
export async function registerServiceWorker(): Promise<boolean> {
  if (!isSWSupported()) {
    console.warn("[PWA] Service workers not supported");
    return false;
  }

  try {
    registration = await navigator.serviceWorker.register(SW_PATH, {
      scope: "/",
      updateViaCache: "imports",
    });

    console.log("[PWA] Service worker registered:", registration.scope);

    // Handle updates
    registration.addEventListener("updatefound", () => {
      const newWorker = registration?.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          // New version available
          showUpdateNotification();
        }
      });
    });

    // Listen for controller changes (update applied)
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "BACKGROUND_SYNC") {
        showSyncNotification();
      }
    });

    return true;
  } catch (error) {
    console.error("[PWA] Service worker registration failed:", error);
    return false;
  }
}

/**
 * Get current PWA status
 */
export async function getPWAStatus(): Promise<PWAStatus> {
  return {
    supported: isSWSupported(),
    registered: !!registration,
    controlled: !!navigator.serviceWorker.controller,
    online: navigator.onLine,
    updateAvailable: await checkForUpdate(),
  };
}

/**
 * Check for service worker updates
 */
export async function checkForUpdate(): Promise<boolean> {
  if (!registration) return false;

  try {
    await registration.update();
    return !!registration.waiting;
  } catch {
    return false;
  }
}

/**
 * Skip waiting and activate new service worker
 */
export async function activateUpdate(): Promise<void> {
  const waiting = registration?.waiting;
  if (waiting) {
    waiting.postMessage({ type: "SKIP_WAITING" });
  }
}

/**
 * Clear all caches
 */
export async function clearCache(): Promise<boolean> {
  if (!registration) return false;

  return new Promise((resolve) => {
    const messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = (event) => {
      resolve(event.data?.cleared ?? false);
    };

    navigator.serviceWorker.controller?.postMessage(
      { type: "CLEAR_CACHE" },
      [messageChannel.port2]
    );
  });
}

/**
 * Get service worker version
 */
export async function getSWVersion(): Promise<string | null> {
  if (!navigator.serviceWorker.controller) return null;

  return new Promise((resolve) => {
    const messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = (event) => {
      resolve(event.data?.version ?? null);
    };

    navigator.serviceWorker.controller?.postMessage(
      { type: "GET_VERSION" },
      [messageChannel.port2]
    );
  });
}

/**
 * Show update notification to user
 */
function showUpdateNotification(): void {
  // Remove existing notification
  const existing = document.getElementById("pwa-update-notification");
  if (existing) existing.remove();

  const notification = document.createElement("div");
  notification.id = "pwa-update-notification";
  notification.className = "pwa-notification";
  notification.innerHTML = `
    <div class="pwa-notification-content">
      <span class="pwa-notification-icon">🔄</span>
      <div class="pwa-notification-text">
        <strong>New version available</strong>
        <span>Refresh to get the latest features</span>
      </div>
      <button id="pwa-update-button" class="pwa-notification-button">Update</button>
      <button id="pwa-update-dismiss" class="pwa-notification-dismiss" aria-label="Dismiss">✕</button>
    </div>
  `;

  document.body.appendChild(notification);

  document.getElementById("pwa-update-button")?.addEventListener("click", () => {
    activateUpdate();
  });

  document.getElementById("pwa-update-dismiss")?.addEventListener("click", () => {
    notification.remove();
  });
}

/**
 * Show background sync notification
 */
function showSyncNotification(): void {
  // Remove existing notification
  const existing = document.getElementById("pwa-sync-notification");
  if (existing) existing.remove();

  const notification = document.createElement("div");
  notification.id = "pwa-sync-notification";
  notification.className = "pwa-notification pwa-notification-info";
  notification.innerHTML = `
    <div class="pwa-notification-content">
      <span class="pwa-notification-icon">📤</span>
      <div class="pwa-notification-text">
        <strong>Sync complete</strong>
        <span>Your actions have been synced</span>
      </div>
      <button id="pwa-sync-dismiss" class="pwa-notification-dismiss" aria-label="Dismiss">✕</button>
    </div>
  `;

  document.body.appendChild(notification);

  document.getElementById("pwa-sync-dismiss")?.addEventListener("click", () => {
    notification.remove();
  });

  setTimeout(() => notification.remove(), 5000);
}

/**
 * Show offline status indicator
 */
export function showOfflineIndicator(): void {
  let indicator = document.getElementById("pwa-offline-indicator");
  if (!indicator) {
    indicator = document.createElement("div");
    indicator.id = "pwa-offline-indicator";
    indicator.className = "pwa-offline-indicator";
    indicator.textContent = "You're offline - some features may be limited";
    document.body.appendChild(indicator);
  }
  indicator.classList.add("visible");
}

/**
 * Hide offline status indicator
 */
export function hideOfflineIndicator(): void {
  const indicator = document.getElementById("pwa-offline-indicator");
  if (indicator) {
    indicator.classList.remove("visible");
  }
}

/**
 * Setup online/offline event listeners
 */
export function setupConnectivityListeners(): void {
  window.addEventListener("online", () => {
    hideOfflineIndicator();
    showOnlineToast();
  });

  window.addEventListener("offline", () => {
    showOfflineIndicator();
  });

  // Set initial state
  if (!navigator.onLine) {
    showOfflineIndicator();
  }
}

/**
 * Show toast when connection is restored
 */
function showOnlineToast(): void {
  const toast = document.createElement("div");
  toast.className = "pwa-toast";
  toast.textContent = "You're back online";
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("visible");
  }, 10);

  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Setup install prompt handler
 */
export function setupInstallPrompt(): void {
  if (!("beforeinstallprompt" in window)) return;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // Show install suggestion after some delay
    setTimeout(() => {
      if (!getInstallPromptShown()) {
        showInstallPrompt();
      }
    }, 30000); // 30 seconds
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    setInstallPromptShown(true);

    // Show installed notification
    const notification = document.createElement("div");
    notification.className = "pwa-toast";
    notification.textContent = "App installed successfully";
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add("visible");
    }, 10);

    setTimeout(() => {
      notification.classList.remove("visible");
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  });
}

/**
 * Check if install prompt was shown before
 */
function getInstallPromptShown(): boolean {
  return localStorage.getItem("pwa-install-prompt-shown") === "true";
}

/**
 * Mark install prompt as shown
 */
function setInstallPromptShown(shown: boolean): void {
  localStorage.setItem("pwa-install-prompt-shown", String(shown));
}

/**
 * Show install prompt UI
 */
function showInstallPrompt(): void {
  // Remove existing
  const existing = document.getElementById("pwa-install-prompt");
  if (existing) existing.remove();

  const prompt = document.createElement("div");
  prompt.id = "pwa-install-prompt";
  prompt.className = "pwa-notification";
  prompt.innerHTML = `
    <div class="pwa-notification-content">
      <span class="pwa-notification-icon">📲</span>
      <div class="pwa-notification-text">
        <strong>Install ConvertToIt</strong>
        <span>Install for offline access and better experience</span>
      </div>
      <button id="pwa-install-button" class="pwa-notification-button">Install</button>
      <button id="pwa-install-dismiss" class="pwa-notification-dismiss" aria-label="Dismiss">✕</button>
    </div>
  `;

  document.body.appendChild(prompt);

  document.getElementById("pwa-install-button")?.addEventListener("click", async () => {
    if (!deferredPrompt?.prompt) return;

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice?.outcome === "accepted") {
        setInstallPromptShown(true);
      }
    } catch (e) {
      console.error("[PWA] Install prompt error:", e);
    }

    deferredPrompt = null;
    const installPromptEl = document.getElementById("pwa-install-prompt");
    if (installPromptEl) installPromptEl.remove();
  });

  document.getElementById("pwa-install-dismiss")?.addEventListener("click", () => {
    setInstallPromptShown(true);
    prompt.remove();
  });
}

/**
 * Initialize PWA functionality
 */
export async function initPWA(): Promise<void> {
  // Register service worker
  await registerServiceWorker();

  // Setup connectivity listeners
  setupConnectivityListeners();

  // Setup install prompt
  setupInstallPrompt();

  // Expose to window for debugging
  (window as any).pwa = {
    getStatus: getPWAStatus,
    checkUpdate: checkForUpdate,
    activateUpdate: activateUpdate,
    clearCache: clearCache,
    getVersion: getSWVersion,
    showInstall: showInstallPrompt,
  };
}
