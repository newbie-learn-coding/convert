#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CANONICAL_HOST="converttoit.com"
CANONICAL_BASE_URL="https://${CANONICAL_HOST}"

usage() {
  cat <<'USAGE'
Usage:
  scripts/cf-post-deploy-gate.sh production --base-url <https://converttoit.com>

Examples:
  scripts/cf-post-deploy-gate.sh production --base-url https://converttoit.com
  CF_DEPLOY_BASE_URL=https://converttoit.com scripts/cf-post-deploy-gate.sh production

Environment variables:
  CF_DEPLOY_BASE_URL   Production base URL (fallback for --base-url)
  CF_OPS_HTTP_TIMEOUT  Curl timeout in seconds for /_ops checks (default: 20)

Notes:
  - This gate validates /_ops/health and /_ops/version, then runs cf-log-check.sh.
  - You can still run standalone evidence check:
      CF_DEPLOY_BASE_URL=https://converttoit.com bun run cf:logs:check
USAGE
}

is_positive_integer() {
  [[ "$1" =~ ^[1-9][0-9]*$ ]]
}

TARGET_ENV="production"
BASE_URL="${CF_DEPLOY_BASE_URL:-}"
HTTP_TIMEOUT="${CF_OPS_HTTP_TIMEOUT:-20}"
HEALTH_OUTPUT_FILE=""
VERSION_OUTPUT_FILE=""

cleanup() {
  [ -n "$HEALTH_OUTPUT_FILE" ] && rm -f "$HEALTH_OUTPUT_FILE"
  [ -n "$VERSION_OUTPUT_FILE" ] && rm -f "$VERSION_OUTPUT_FILE"
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
    --http-timeout)
      shift
      HTTP_TIMEOUT="${1:-}"
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

if [ "$TARGET_ENV" != "production" ]; then
  echo "[post-deploy] This gate is production-only. Received: $TARGET_ENV" >&2
  exit 1
fi

if [ -z "$BASE_URL" ]; then
  echo "[post-deploy] --base-url is required (or CF_DEPLOY_BASE_URL env var)." >&2
  exit 1
fi

if ! is_positive_integer "$HTTP_TIMEOUT"; then
  echo "[post-deploy] --http-timeout must be a positive integer." >&2
  exit 1
fi

NORMALIZED_BASE_URL="$(node -e '
const raw = process.argv[1];
const canonicalHost = process.argv[2];
const canonicalBase = process.argv[3];
const parsed = new URL(raw);
if (parsed.protocol !== "https:") {
  throw new Error("base URL must use https");
}
if (parsed.hostname !== canonicalHost) {
  throw new Error(`base URL host must be ${canonicalHost}`);
}
if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
  throw new Error("base URL must not include path, query, or fragment");
}
if (parsed.origin !== canonicalBase) {
  throw new Error(`base URL origin must be ${canonicalBase}`);
}
process.stdout.write(parsed.origin);
' "$BASE_URL" "$CANONICAL_HOST" "$CANONICAL_BASE_URL")"

HEALTH_OUTPUT_FILE="$(mktemp)"
VERSION_OUTPUT_FILE="$(mktemp)"

echo "[post-deploy] Checking ${NORMALIZED_BASE_URL}/_ops/health"
curl --silent --show-error --fail \
  --connect-timeout 5 \
  --max-time "$HTTP_TIMEOUT" \
  --header "accept: application/json" \
  "${NORMALIZED_BASE_URL}/_ops/health" >"$HEALTH_OUTPUT_FILE"

node -e '
const fs = require("fs");
const filePath = process.argv[1];
const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
for (const key of ["timestamp", "requestId", "service", "environment", "appVersion", "buildSha"]) {
  if (typeof payload[key] !== "string" || payload[key].trim() === "") {
    throw new Error(`/_ops/health missing required string field: ${key}`);
  }
}
if (payload.status !== "ok") {
  throw new Error(`/_ops/health status must be \"ok\" (got: ${payload.status})`);
}
if (payload.service !== "converttoit.com") {
  throw new Error(`/_ops/health service must be converttoit.com (got: ${payload.service})`);
}
if (payload.environment !== "production") {
  throw new Error(`/_ops/health environment must be production (got: ${payload.environment})`);
}
if (payload.appVersion === "unknown" || payload.buildSha === "unknown") {
  throw new Error("/_ops/health reported unknown appVersion/buildSha");
}
' "$HEALTH_OUTPUT_FILE"

echo "[post-deploy] Checking ${NORMALIZED_BASE_URL}/_ops/version"
curl --silent --show-error --fail \
  --connect-timeout 5 \
  --max-time "$HTTP_TIMEOUT" \
  --header "accept: application/json" \
  "${NORMALIZED_BASE_URL}/_ops/version" >"$VERSION_OUTPUT_FILE"

node -e '
const fs = require("fs");
const filePath = process.argv[1];
const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
for (const key of ["timestamp", "requestId", "service", "environment", "appVersion", "buildSha"]) {
  if (typeof payload[key] !== "string" || payload[key].trim() === "") {
    throw new Error(`/_ops/version missing required string field: ${key}`);
  }
}
if (payload.service !== "converttoit.com") {
  throw new Error(`/_ops/version service must be converttoit.com (got: ${payload.service})`);
}
if (payload.environment !== "production") {
  throw new Error(`/_ops/version environment must be production (got: ${payload.environment})`);
}
if (payload.appVersion === "unknown" || payload.buildSha === "unknown") {
  throw new Error("/_ops/version reported unknown appVersion/buildSha");
}
' "$VERSION_OUTPUT_FILE"

echo "[post-deploy] Running Cloudflare log tail verification"
bash "$SCRIPT_DIR/cf-log-check.sh" production --base-url "$NORMALIZED_BASE_URL"

echo "[post-deploy] Production deploy-after gate passed."
echo "[post-deploy] Optional standalone evidence command:"
echo "              CF_DEPLOY_BASE_URL=${NORMALIZED_BASE_URL} bun run cf:logs:check"
