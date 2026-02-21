/**
 * PWA Service Worker Registration and Management
 * Handles service worker registration, updates, offline status, and install prompts
 */

import { debugInfo, debugLog, debugWarn } from "./debug";

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

function isAutomationEnvironment(): boolean {
  return Boolean(navigator.webdriver) || /\bHeadlessChrome\b/i.test(navigator.userAgent);
}

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
    debugWarn("[PWA] Service workers not supported");
    return false;
  }

  if (isAutomationEnvironment()) {
    debugInfo("[PWA] Skipping service worker registration in automated browser");
    return false;
  }

  try {
    registration = await navigator.serviceWorker.register(SW_PATH, {
      scope: "/",
      updateViaCache: "imports",
    });

    debugLog("[PWA] Service worker registered:", registration.scope);

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
  notification.setAttribute("role", "alert");
  notification.setAttribute("aria-live", "polite");

  const content = document.createElement("div");
  content.className = "pwa-notification-content";

  const icon = document.createElement("span");
  icon.className = "pwa-notification-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "🔄";

  const textDiv = document.createElement("div");
  textDiv.className = "pwa-notification-text";

  const strong = document.createElement("strong");
  strong.textContent = "New version available";

  const span = document.createElement("span");
  span.textContent = "Refresh to get the latest features";

  textDiv.appendChild(strong);
  textDiv.appendChild(span);

  const updateButton = document.createElement("button");
  updateButton.id = "pwa-update-button";
  updateButton.className = "pwa-notification-button";
  updateButton.setAttribute("aria-label", "Update to new version now");
  updateButton.textContent = "Update";

  const dismissButton = document.createElement("button");
  dismissButton.id = "pwa-update-dismiss";
  dismissButton.className = "pwa-notification-dismiss";
  dismissButton.setAttribute("aria-label", "Dismiss update notification");
  dismissButton.textContent = "✕";

  content.appendChild(icon);
  content.appendChild(textDiv);
  content.appendChild(updateButton);
  content.appendChild(dismissButton);
  notification.appendChild(content);

  document.body.appendChild(notification);

  // Trigger animation
  requestAnimationFrame(() => {
    notification.classList.add("visible");
  });

  updateButton.addEventListener("click", () => {
    activateUpdate();
  });

  dismissButton.addEventListener("click", () => {
    notification.classList.remove("visible");
    setTimeout(() => notification.remove(), 300);
  });

  // Auto-dismiss after 30 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.classList.remove("visible");
      setTimeout(() => notification.remove(), 300);
    }
  }, 30000);
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
  notification.setAttribute("role", "status");
  notification.setAttribute("aria-live", "polite");

  const content = document.createElement("div");
  content.className = "pwa-notification-content";

  const icon = document.createElement("span");
  icon.className = "pwa-notification-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "📤";

  const textDiv = document.createElement("div");
  textDiv.className = "pwa-notification-text";

  const strong = document.createElement("strong");
  strong.textContent = "Sync complete";

  const span = document.createElement("span");
  span.textContent = "Your actions have been synced";

  textDiv.appendChild(strong);
  textDiv.appendChild(span);

  const dismissButton = document.createElement("button");
  dismissButton.id = "pwa-sync-dismiss";
  dismissButton.className = "pwa-notification-dismiss";
  dismissButton.setAttribute("aria-label", "Dismiss sync notification");
  dismissButton.textContent = "✕";

  content.appendChild(icon);
  content.appendChild(textDiv);
  content.appendChild(dismissButton);
  notification.appendChild(content);

  document.body.appendChild(notification);

  // Trigger animation
  requestAnimationFrame(() => {
    notification.classList.add("visible");
  });

  dismissButton.addEventListener("click", () => {
    notification.classList.remove("visible");
    setTimeout(() => notification.remove(), 300);
  });

  setTimeout(() => {
    if (notification.parentElement) {
      notification.classList.remove("visible");
      setTimeout(() => notification.remove(), 300);
    }
  }, 5000);
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
    indicator.setAttribute("role", "status");
    indicator.setAttribute("aria-live", "polite");

    const icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "📡";

    const text = document.createElement("span");
    text.textContent = "You're offline - some features may be limited";

    indicator.appendChild(icon);
    indicator.appendChild(text);
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
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.textContent = "You're back online";
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("visible");
  });

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
    notification.setAttribute("role", "alert");
    notification.setAttribute("aria-live", "polite");
    notification.textContent = "App installed successfully";
    document.body.appendChild(notification);

    requestAnimationFrame(() => {
      notification.classList.add("visible");
    });

    setTimeout(() => {
      notification.classList.remove("visible");
      setTimeout(() => notification.remove(), 300);
    }, 3000);

    // Remove install prompt if still visible
    const installPrompt = document.getElementById("pwa-install-prompt");
    if (installPrompt) {
      installPrompt.remove();
    }
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
  prompt.setAttribute("role", "dialog");
  prompt.setAttribute("aria-label", "Install ConvertToIt app");
  prompt.setAttribute("aria-live", "polite");

  const content = document.createElement("div");
  content.className = "pwa-notification-content";

  const icon = document.createElement("span");
  icon.className = "pwa-notification-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "📲";

  const textDiv = document.createElement("div");
  textDiv.className = "pwa-notification-text";

  const strong = document.createElement("strong");
  strong.textContent = "Install ConvertToIt";

  const span = document.createElement("span");
  span.textContent = "Install for offline access and better experience";

  textDiv.appendChild(strong);
  textDiv.appendChild(span);

  const installButton = document.createElement("button");
  installButton.id = "pwa-install-button";
  installButton.className = "pwa-notification-button";
  installButton.setAttribute("aria-label", "Install app now");
  installButton.textContent = "Install";

  const dismissButton = document.createElement("button");
  dismissButton.id = "pwa-install-dismiss";
  dismissButton.className = "pwa-notification-dismiss";
  dismissButton.setAttribute("aria-label", "Dismiss install prompt");
  dismissButton.textContent = "✕";

  content.appendChild(icon);
  content.appendChild(textDiv);
  content.appendChild(installButton);
  content.appendChild(dismissButton);
  prompt.appendChild(content);

  document.body.appendChild(prompt);

  // Trigger animation
  requestAnimationFrame(() => {
    prompt.classList.add("visible");
  });

  installButton.addEventListener("click", async () => {
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

  dismissButton.addEventListener("click", () => {
    setInstallPromptShown(true);
    prompt.classList.remove("visible");
    setTimeout(() => prompt.remove(), 300);
  });
}

/**
 * Show offline page when app is offline and user tries to navigate
 */
function showOfflinePage(): void {
  const existing = document.getElementById("offline-page");
  if (existing) return;

  const offlinePage = document.createElement("div");
  offlinePage.id = "offline-page";
  offlinePage.className = "offline-page";
  offlinePage.setAttribute("role", "alert");
  offlinePage.setAttribute("aria-live", "polite");

  const content = document.createElement("div");
  content.className = "offline-content";

  const icon = document.createElement("div");
  icon.className = "offline-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "📡";

  const heading = document.createElement("h2");
  heading.textContent = "You're Offline";

  const para1 = document.createElement("p");
  para1.textContent = "Check your internet connection. Some features may be unavailable until you reconnect.";

  const para2 = document.createElement("p");
  para2.className = "offline-note";
  para2.textContent = "Previously cached conversions and basic tools may still work.";

  const retryButton = document.createElement("button");
  retryButton.id = "offline-retry";
  retryButton.className = "offline-retry-button";
  retryButton.setAttribute("aria-label", "Retry connection");
  retryButton.textContent = "Try Again";

  content.appendChild(icon);
  content.appendChild(heading);
  content.appendChild(para1);
  content.appendChild(para2);
  content.appendChild(retryButton);
  offlinePage.appendChild(content);

  document.body.appendChild(offlinePage);

  retryButton.addEventListener("click", () => {
    if (navigator.onLine) {
      offlinePage.remove();
    } else {
      // Shake animation to indicate still offline
      offlinePage.classList.add("shake");
      setTimeout(() => offlinePage.classList.remove("shake"), 500);
    }
  });

  // Auto-remove when back online
  const removeOfflinePage = () => {
    if (navigator.onLine) {
      offlinePage.remove();
      window.removeEventListener("online", removeOfflinePage);
    }
  };
  window.addEventListener("online", removeOfflinePage);
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
  (window as unknown as Record<string, unknown>).pwa = {
    getStatus: getPWAStatus,
    checkUpdate: checkForUpdate,
    activateUpdate: activateUpdate,
    clearCache: clearCache,
    getVersion: getSWVersion,
    showInstall: showInstallPrompt,
    showOffline: showOfflinePage,
  };
}
