#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WRANGLER_CONFIG_PATH="${WRANGLER_CONFIG_PATH:-$ROOT_DIR/wrangler.toml}"
CF_ENV_FILE="${CF_ENV_FILE:-$ROOT_DIR/.env.local}"
DEFAULT_WRANGLER_VERSION="${DEFAULT_WRANGLER_VERSION:-4.0.0}"

load_cf_env_file() {
  if [ -f "$CF_ENV_FILE" ]; then
    # shellcheck disable=SC1090
    source "$CF_ENV_FILE"
  fi
}

ensure_wrangler_config() {
  if [ -f "$WRANGLER_CONFIG_PATH" ]; then
    return 0
  fi

  echo "[cf-common] Wrangler config not found: $WRANGLER_CONFIG_PATH" >&2
  if [ "$WRANGLER_CONFIG_PATH" = "$ROOT_DIR/wrangler.toml" ] && [ -f "$ROOT_DIR/wrangler.toml.example" ]; then
    echo "[cf-common] Create it from template: cp wrangler.toml.example wrangler.toml" >&2
  fi
  return 1
}

load_cf_env_file
CF_WRANGLER_VERSION="${CF_WRANGLER_VERSION:-$DEFAULT_WRANGLER_VERSION}"
WRANGLER_PACKAGE="wrangler@${CF_WRANGLER_VERSION}"

wrangler_cmd() {
  if [ -x "$ROOT_DIR/node_modules/.bin/wrangler" ]; then
    "$ROOT_DIR/node_modules/.bin/wrangler" "$@"
    return
  fi

  if command -v npx >/dev/null 2>&1; then
    npx --yes "$WRANGLER_PACKAGE" "$@"
    return
  fi

  if command -v bunx >/dev/null 2>&1; then
    bunx --bun "$WRANGLER_PACKAGE" "$@"
    return
  fi

  echo "[cf-common] Could not find wrangler runner (node_modules/.bin/wrangler, npx, or bunx)." >&2
  return 127
}

with_timeout() {
  local seconds="$1"
  shift

  if command -v timeout >/dev/null 2>&1; then
    timeout "$seconds" "$@"
    return
  fi

  perl -e 'alarm shift; exec @ARGV' "$seconds" "$@"
}
