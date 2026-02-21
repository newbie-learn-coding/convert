#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/cf-common.sh"

usage() {
  cat <<'USAGE'
Usage:
  scripts/cf-log-check.sh [production|staging] --base-url <https://...> [--tail-seconds N] [--log-timeout N]

Examples:
  scripts/cf-log-check.sh production --base-url https://converttoit-site.<subdomain>.workers.dev
  CF_OPS_LOG_TOKEN=... scripts/cf-log-check.sh staging --base-url https://staging.example.com
  CF_DEPLOY_BASE_URL=https://converttoit.com bun run cf:logs:check

Environment variables:
  CF_OPS_LOG_TOKEN      Optional token sent as x-ops-token for /_ops/log-ping
  CF_LOG_PING_TIMEOUT   Curl max time in seconds (default: 20)
  CF_TAIL_CONNECT_RETRIES Number of retries for transient wrangler tail failures (default: 3)
  CF_TAIL_RETRY_DELAY   Seconds between retries (default: 2)
  WRANGLER_CONFIG_PATH  Config path (default: ./wrangler.toml)
USAGE
}

TARGET_ENV="production"
BASE_URL="${CF_DEPLOY_BASE_URL:-}"
TAIL_SECONDS=15
LOG_PING_TIMEOUT="${CF_LOG_PING_TIMEOUT:-20}"
TAIL_CONNECT_RETRIES="${CF_TAIL_CONNECT_RETRIES:-3}"
TAIL_RETRY_DELAY="${CF_TAIL_RETRY_DELAY:-2}"
TAIL_PID=""
TAIL_OUTPUT_FILE=""
PING_OUTPUT_FILE=""

cleanup() {
  if [ -n "$TAIL_PID" ] && kill -0 "$TAIL_PID" >/dev/null 2>&1; then
    kill "$TAIL_PID" >/dev/null 2>&1 || true
    wait "$TAIL_PID" 2>/dev/null || true
  fi
  [ -n "$TAIL_OUTPUT_FILE" ] && rm -f "$TAIL_OUTPUT_FILE"
  [ -n "$PING_OUTPUT_FILE" ] && rm -f "$PING_OUTPUT_FILE"
}

is_positive_integer() {
  [[ "$1" =~ ^[1-9][0-9]*$ ]]
}

is_transient_tail_error() {
  local file_path="$1"
  grep -Eiq "TLS|ECONNRESET|socket hang up|connection reset|transport closed|network error|fetch failed" "$file_path"
}

trap cleanup EXIT INT TERM

while [ "$#" -gt 0 ]; do
  case "$1" in
    production|staging)
      TARGET_ENV="$1"
      ;;
    --base-url)
      shift
      BASE_URL="${1:-}"
      ;;
    --tail-seconds)
      shift
      TAIL_SECONDS="${1:-}"
      ;;
    --log-timeout)
      shift
      LOG_PING_TIMEOUT="${1:-}"
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
  shift
done

if [ -z "$BASE_URL" ]; then
  echo "[log-check] --base-url is required (or CF_DEPLOY_BASE_URL env var)." >&2
  exit 1
fi

if ! is_positive_integer "$TAIL_SECONDS"; then
  echo "[log-check] --tail-seconds must be a positive integer." >&2
  exit 1
fi

if ! is_positive_integer "$LOG_PING_TIMEOUT"; then
  echo "[log-check] --log-timeout must be a positive integer." >&2
  exit 1
fi

if ! is_positive_integer "$TAIL_CONNECT_RETRIES"; then
  echo "[log-check] CF_TAIL_CONNECT_RETRIES must be a positive integer." >&2
  exit 1
fi

if ! is_positive_integer "$TAIL_RETRY_DELAY"; then
  echo "[log-check] CF_TAIL_RETRY_DELAY must be a positive integer." >&2
  exit 1
fi

if [[ ! "$BASE_URL" =~ ^https:// ]]; then
  echo "[log-check] --base-url must use https://." >&2
  exit 1
fi

BASE_HOST="$(printf '%s' "$BASE_URL" | sed -E 's#^[A-Za-z]+://([^/:?#]+).*$#\1#')"
if [ "$BASE_HOST" = "converttoit.app" ] || [ "$BASE_HOST" = "www.converttoit.app" ]; then
  echo "[log-check] --base-url cannot target converttoit.app (redirect-only domain)." >&2
  exit 1
fi

if ! ensure_wrangler_config; then
  exit 1
fi

if [ -n "${CLOUDFLARE_API_TOKEN:-}" ] && [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ] && [ "${CF_ALLOW_INTERACTIVE:-0}" != "1" ]; then
  echo "[log-check] CLOUDFLARE_ACCOUNT_ID is required when CLOUDFLARE_API_TOKEN is used." >&2
  exit 1
fi

cd "$ROOT_DIR"

TAIL_ARGS=(tail --config "$WRANGLER_CONFIG_PATH" --format pretty)
if [ "$TARGET_ENV" != "production" ]; then
  TAIL_ARGS+=(--env "$TARGET_ENV")
fi

for attempt in $(seq 1 "$TAIL_CONNECT_RETRIES"); do
  CORRELATION_ID="ops-check-$(date +%Y%m%d%H%M%S)-$RANDOM-a${attempt}"
  PING_URL="${BASE_URL%/}/_ops/log-ping?id=$CORRELATION_ID"
  TAIL_OUTPUT_FILE="$(mktemp -t cf-log-tail.XXXXXX)"
  PING_OUTPUT_FILE="$(mktemp -t cf-log-ping.XXXXXX)"

  echo "[log-check] Attempt ${attempt}/${TAIL_CONNECT_RETRIES}: starting wrangler tail for $TARGET_ENV (search=$CORRELATION_ID)"
  wrangler_cmd "${TAIL_ARGS[@]}" >"$TAIL_OUTPUT_FILE" 2>&1 &
  TAIL_PID=$!

  TAIL_READY=0
  for _ in $(seq 1 20); do
    if grep -q "Connected to" "$TAIL_OUTPUT_FILE"; then
      TAIL_READY=1
      break
    fi
    if ! kill -0 "$TAIL_PID" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  if [ "$TAIL_READY" -ne 1 ]; then
    if [ -n "$TAIL_PID" ] && kill -0 "$TAIL_PID" >/dev/null 2>&1; then
      kill "$TAIL_PID" >/dev/null 2>&1 || true
      wait "$TAIL_PID" 2>/dev/null || true
    fi
    TAIL_PID=""

    if is_transient_tail_error "$TAIL_OUTPUT_FILE" && [ "$attempt" -lt "$TAIL_CONNECT_RETRIES" ]; then
      echo "[log-check] transient wrangler tail startup failure; retrying in ${TAIL_RETRY_DELAY}s..." >&2
      rm -f "$TAIL_OUTPUT_FILE" "$PING_OUTPUT_FILE"
      TAIL_OUTPUT_FILE=""
      PING_OUTPUT_FILE=""
      sleep "$TAIL_RETRY_DELAY"
      continue
    fi

    echo "[log-check] wrangler tail did not become ready." >&2
    cat "$TAIL_OUTPUT_FILE" >&2
    exit 1
  fi

  CURL_ARGS=(--silent --show-error --request GET "$PING_URL" --header "accept: application/json")
  CURL_ARGS+=(--max-time "$LOG_PING_TIMEOUT" --connect-timeout 5)
  if [ -n "${CF_OPS_LOG_TOKEN:-}" ]; then
    CURL_ARGS+=(--header "x-ops-token: $CF_OPS_LOG_TOKEN")
  fi

  echo "[log-check] Triggering $PING_URL"
  HTTP_STATUS=""
  set +e
  HTTP_STATUS="$(curl "${CURL_ARGS[@]}" --write-out "%{http_code}" --output "$PING_OUTPUT_FILE")"
  CURL_CODE=$?
  set -e

  if [ "$CURL_CODE" -ne 0 ]; then
    if [ -n "$TAIL_PID" ] && kill -0 "$TAIL_PID" >/dev/null 2>&1; then
      kill "$TAIL_PID" >/dev/null 2>&1 || true
      wait "$TAIL_PID" 2>/dev/null || true
    fi
    TAIL_PID=""

    if [ "$attempt" -lt "$TAIL_CONNECT_RETRIES" ]; then
      echo "[log-check] curl failed with code $CURL_CODE; retrying in ${TAIL_RETRY_DELAY}s..." >&2
      rm -f "$TAIL_OUTPUT_FILE" "$PING_OUTPUT_FILE"
      TAIL_OUTPUT_FILE=""
      PING_OUTPUT_FILE=""
      sleep "$TAIL_RETRY_DELAY"
      continue
    fi

    exit "$CURL_CODE"
  fi

  if [[ ! "$HTTP_STATUS" =~ ^2[0-9][0-9]$ ]]; then
    if [ -n "$TAIL_PID" ] && kill -0 "$TAIL_PID" >/dev/null 2>&1; then
      kill "$TAIL_PID" >/dev/null 2>&1 || true
      wait "$TAIL_PID" 2>/dev/null || true
    fi
    TAIL_PID=""

    echo "[log-check] log-ping returned HTTP ${HTTP_STATUS}." >&2
    if [ -s "$PING_OUTPUT_FILE" ]; then
      cat "$PING_OUTPUT_FILE" >&2
    fi

    if [ "$HTTP_STATUS" = "401" ] || [ "$HTTP_STATUS" = "403" ]; then
      if [ -z "${CF_OPS_LOG_TOKEN:-}" ]; then
        echo "[log-check] CF_OPS_LOG_TOKEN is not set, but /_ops/log-ping is protected." >&2
        echo "[log-check] Skipping strict log tail verification (health/version gate already passed)." >&2
        echo "[log-check] To enable strict verification, set CF_OPS_LOG_TOKEN and re-run this check." >&2
        exit 0
      fi

      # Auth/token issue with an explicitly provided token: fail fast to surface mismatch
      exit 22
    fi

    if [ "$attempt" -lt "$TAIL_CONNECT_RETRIES" ]; then
      echo "[log-check] HTTP ${HTTP_STATUS} from log-ping; retrying in ${TAIL_RETRY_DELAY}s..." >&2
      rm -f "$TAIL_OUTPUT_FILE" "$PING_OUTPUT_FILE"
      TAIL_OUTPUT_FILE=""
      PING_OUTPUT_FILE=""
      sleep "$TAIL_RETRY_DELAY"
      continue
    fi

    exit 1
  fi

  cat "$PING_OUTPUT_FILE"

  FOUND=0
  for _ in $(seq 1 "$TAIL_SECONDS"); do
    if grep -q "$CORRELATION_ID" "$TAIL_OUTPUT_FILE"; then
      FOUND=1
      break
    fi
    if ! kill -0 "$TAIL_PID" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  if [ -n "$TAIL_PID" ] && kill -0 "$TAIL_PID" >/dev/null 2>&1; then
    kill "$TAIL_PID" >/dev/null 2>&1 || true
    wait "$TAIL_PID" 2>/dev/null || true
  fi
  TAIL_PID=""

  if [ "$FOUND" -eq 1 ]; then
    echo "[log-check] SUCCESS: correlation id found in Cloudflare tail output."
    exit 0
  fi

  if is_transient_tail_error "$TAIL_OUTPUT_FILE" && [ "$attempt" -lt "$TAIL_CONNECT_RETRIES" ]; then
    echo "[log-check] transient tail disconnect before correlation id observed; retrying in ${TAIL_RETRY_DELAY}s..." >&2
    rm -f "$TAIL_OUTPUT_FILE" "$PING_OUTPUT_FILE"
    TAIL_OUTPUT_FILE=""
    PING_OUTPUT_FILE=""
    sleep "$TAIL_RETRY_DELAY"
    continue
  fi

  echo "[log-check] FAILED: correlation id was not found in tail output." >&2
  echo "[log-check] Tail output:" >&2
  cat "$TAIL_OUTPUT_FILE" >&2
  exit 1
done

echo "[log-check] FAILED: retries exhausted before log correlation could be verified." >&2
exit 1
