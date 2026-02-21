function readBoolFromStorage(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function readBoolFromQuery(key: string): boolean {
  try {
    return new URLSearchParams(window.location.search).get(key) === "1";
  } catch {
    return false;
  }
}

/**
 * Debug logging toggle.
 *
 * Enabled when:
 * - Vite dev mode, or
 * - ?debug=1 in URL, or
 * - localStorage.debug=1
 */
export function isDebugEnabled(): boolean {
  return Boolean(import.meta.env?.DEV) || readBoolFromQuery("debug") || readBoolFromStorage("debug");
}

export function debugLog(...args: unknown[]): void {
  if (!isDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.log(...args);
}

export function debugInfo(...args: unknown[]): void {
  if (!isDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.info(...args);
}

export function debugWarn(...args: unknown[]): void {
  if (!isDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.warn(...args);
}

