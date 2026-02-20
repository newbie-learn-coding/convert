#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/cf-common.sh"

usage() {
  cat <<'USAGE'
Usage:
  scripts/deploy.sh [production|staging] [--dry-run] [--skip-build] [--skip-policy-checks] [-- <extra wrangler args>]

Examples:
  scripts/deploy.sh production
  scripts/deploy.sh staging --dry-run
  scripts/deploy.sh production --skip-policy-checks
  scripts/deploy.sh production -- --outdir .wrangler-dist

Environment variables:
  CLOUDFLARE_API_TOKEN   API token for non-interactive deploys
  CLOUDFLARE_ACCOUNT_ID  Cloudflare account id (kept in env, not wrangler config)
  CF_APP_VERSION         Version injected into /_ops/version (default: package.json version)
  CF_BUILD_SHA           Build SHA injected into /_ops/version (default: git short SHA)
  CF_ALLOW_INTERACTIVE   Set to 1 to allow deploy without CLOUDFLARE_API_TOKEN
  CF_SKIP_POLICY_CHECKS  Set to 1 to skip SEO/domain integrity preflight checks
  WRANGLER_CONFIG_PATH   Config path (default: ./wrangler.toml)
  CF_RATE_LIMIT_GLOBAL_ENABLED            Override RATE_LIMIT_GLOBAL_ENABLED
  CF_RATE_LIMIT_GLOBAL_PROVIDER           Override RATE_LIMIT_GLOBAL_PROVIDER (durable_object|kv)
  CF_RATE_LIMIT_GLOBAL_DO_NAME            Override RATE_LIMIT_GLOBAL_DO_NAME
  CF_RATE_LIMIT_GLOBAL_TELEMETRY_ENABLED  Override RATE_LIMIT_GLOBAL_TELEMETRY_ENABLED
  CF_RATE_LIMIT_GLOBAL_ALLOW_KV_FALLBACK  Override RATE_LIMIT_GLOBAL_ALLOW_KV_FALLBACK (not recommended)
  CF_RATE_LIMIT_GLOBAL_OPS_REQUESTS       Optional override for global /_ops limit
  CF_RATE_LIMIT_GLOBAL_OPS_WINDOW_SECONDS Optional override for global /_ops window
  CF_RATE_LIMIT_GLOBAL_TELEMETRY_REQUESTS Optional override for global telemetry limit
  CF_RATE_LIMIT_GLOBAL_TELEMETRY_WINDOW_SECONDS Optional override for global telemetry window
USAGE
}

TARGET_ENV="production"
DRY_RUN=0
SKIP_BUILD="${CF_SKIP_BUILD:-0}"
SKIP_POLICY_CHECKS="${CF_SKIP_POLICY_CHECKS:-0}"
EXTRA_ARGS=()

while [ "$#" -gt 0 ]; do
  case "$1" in
    production|staging)
      TARGET_ENV="$1"
      ;;
    --dry-run)
      DRY_RUN=1
      ;;
    --skip-build)
      SKIP_BUILD=1
      ;;
    --skip-policy-checks)
      SKIP_POLICY_CHECKS=1
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    --)
      shift
      EXTRA_ARGS+=("$@")
      break
      ;;
    *)
      EXTRA_ARGS+=("$1")
      ;;
  esac
  shift
done

cd "$ROOT_DIR"

if ! ensure_wrangler_config; then
  exit 1
fi

if [ "$SKIP_POLICY_CHECKS" != "1" ]; then
  echo "[deploy] Running SEO/domain preflight checks"
  node scripts/check-seo-domain-policy.mjs
  node scripts/check-critical-files.mjs
else
  echo "[deploy] Skipping SEO/domain preflight checks (CF_SKIP_POLICY_CHECKS=1 or --skip-policy-checks)"
fi

if [ "$SKIP_BUILD" != "1" ]; then
  if ! command -v bun >/dev/null 2>&1; then
    echo "[deploy] bun is required for build step but was not found in PATH." >&2
    exit 1
  fi
  echo "[deploy] Building static assets with bun run build"
  bun run build

  # Build verification
  echo "[deploy] Verifying build artifacts"
  if [ ! -d "dist" ]; then
    echo "[deploy] ERROR: dist directory not found after build" >&2
    exit 1
  fi
  if [ ! -f "dist/index.html" ]; then
    echo "[deploy] ERROR: dist/index.html not found after build" >&2
    exit 1
  fi
  ASSET_COUNT=$(find dist -type f | wc -l)
  if [ "$ASSET_COUNT" -lt 5 ]; then
    echo "[deploy] ERROR: Too few assets in dist ($ASSET_COUNT files)" >&2
    exit 1
  fi
  echo "[deploy] Build artifacts verified ($ASSET_COUNT files)"
else
  echo "[deploy] Skipping build (CF_SKIP_BUILD=1 or --skip-build)"
fi

echo "[deploy] Checking Cloudflare asset size limits"
node scripts/check-cloudflare-asset-sizes.mjs

# Performance budget validation
echo "[deploy] Validating performance budgets"
bun run check:performance-budgets

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] && [ "${CF_ALLOW_INTERACTIVE:-0}" != "1" ]; then
  echo "[deploy] CLOUDFLARE_API_TOKEN is not set."
  echo "         Set CLOUDFLARE_API_TOKEN for CI/non-interactive deploys,"
  echo "         or set CF_ALLOW_INTERACTIVE=1 to rely on local wrangler auth."
  if [ "$DRY_RUN" -ne 1 ]; then
    exit 1
  fi
fi

if [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ] && [ "${CF_ALLOW_INTERACTIVE:-0}" != "1" ]; then
  echo "[deploy] CLOUDFLARE_ACCOUNT_ID is not set."
  echo "         Set CLOUDFLARE_ACCOUNT_ID in environment (do not hardcode account_id in wrangler config)."
  if [ "$DRY_RUN" -ne 1 ]; then
    exit 1
  fi
fi

PACKAGE_VERSION="$(node -p "require('./package.json').version" 2>/dev/null || echo '0.0.0')"
APP_VERSION="${CF_APP_VERSION:-$PACKAGE_VERSION}"
BUILD_SHA="${CF_BUILD_SHA:-$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')}"
ENVIRONMENT_LABEL="${CF_ENVIRONMENT:-$TARGET_ENV}"

DEPLOY_ARGS=(
  deploy
  --config "$WRANGLER_CONFIG_PATH"
  --var "APP_VERSION:$APP_VERSION"
  --var "BUILD_SHA:$BUILD_SHA"
  --var "ENVIRONMENT:$ENVIRONMENT_LABEL"
)

append_optional_var() {
  local var_name="$1"
  local var_value="${2:-}"
  if [ -n "$var_value" ]; then
    DEPLOY_ARGS+=(--var "${var_name}:${var_value}")
  fi
}

append_optional_var "RATE_LIMIT_GLOBAL_ENABLED" "${CF_RATE_LIMIT_GLOBAL_ENABLED:-}"
append_optional_var "RATE_LIMIT_GLOBAL_PROVIDER" "${CF_RATE_LIMIT_GLOBAL_PROVIDER:-}"
append_optional_var "RATE_LIMIT_GLOBAL_DO_NAME" "${CF_RATE_LIMIT_GLOBAL_DO_NAME:-}"
append_optional_var "RATE_LIMIT_GLOBAL_TELEMETRY_ENABLED" "${CF_RATE_LIMIT_GLOBAL_TELEMETRY_ENABLED:-}"
append_optional_var "RATE_LIMIT_GLOBAL_ALLOW_KV_FALLBACK" "${CF_RATE_LIMIT_GLOBAL_ALLOW_KV_FALLBACK:-}"
append_optional_var "RATE_LIMIT_GLOBAL_OPS_REQUESTS" "${CF_RATE_LIMIT_GLOBAL_OPS_REQUESTS:-}"
append_optional_var "RATE_LIMIT_GLOBAL_OPS_WINDOW_SECONDS" "${CF_RATE_LIMIT_GLOBAL_OPS_WINDOW_SECONDS:-}"
append_optional_var "RATE_LIMIT_GLOBAL_TELEMETRY_REQUESTS" "${CF_RATE_LIMIT_GLOBAL_TELEMETRY_REQUESTS:-}"
append_optional_var "RATE_LIMIT_GLOBAL_TELEMETRY_WINDOW_SECONDS" "${CF_RATE_LIMIT_GLOBAL_TELEMETRY_WINDOW_SECONDS:-}"

if [ "$TARGET_ENV" != "production" ]; then
  DEPLOY_ARGS+=(--env "$TARGET_ENV")
fi

if [ "$DRY_RUN" -eq 1 ]; then
  DEPLOY_ARGS+=(--dry-run)
fi

echo "[deploy] Deploying target environment: $TARGET_ENV"
echo "[deploy] APP_VERSION=$APP_VERSION BUILD_SHA=$BUILD_SHA"

if [ "${#EXTRA_ARGS[@]}" -gt 0 ]; then
  wrangler_cmd "${DEPLOY_ARGS[@]}" "${EXTRA_ARGS[@]}"
else
  wrangler_cmd "${DEPLOY_ARGS[@]}"
fi

if [ "$DRY_RUN" -eq 1 ] || [ "${CF_SKIP_POST_VERIFY:-0}" = "1" ]; then
  echo "[deploy] Skipping post-deployment verification (dry-run or CF_SKIP_POST_VERIFY=1)"
  echo "[deploy] Deployment complete for $TARGET_ENV"
  exit 0
fi

# Post-deployment verification
echo "[deploy] Running post-deployment verification"
sleep 5

# Determine deployment URL for verification
if [ "$TARGET_ENV" = "production" ]; then
  DEPLOY_URL="https://converttoit.com"
else
  # For staging, we need to get the workers.dev URL
  DEPLOY_URL="${CF_STAGING_URL:-}"
fi

if [ -n "$DEPLOY_URL" ]; then
  # Health check with retries
  HEALTH_RETRIES=3
  HEALTH_SUCCESS=0
  for i in $(seq 1 $HEALTH_RETRIES); do
    if curl -sf --max-time 10 "${DEPLOY_URL}/_ops/health" > /dev/null 2>&1; then
      HEALTH_SUCCESS=1
      break
    fi
    echo "[deploy] Health check attempt $i failed, retrying..."
    sleep 3
  done

  if [ "$HEALTH_SUCCESS" -eq 1 ]; then
    echo "[deploy] Health check passed"
  else
    echo "[deploy] WARNING: Health check failed after $HEALTH_RETRIES attempts"
    if [ "$DRY_RUN" -ne 1 ]; then
      echo "[deploy] Consider manual verification or rollback"
    fi
  fi

  # Version verification
  VERSION_RESPONSE=$(curl -sf --max-time 10 "${DEPLOY_URL}/_ops/version" 2>/dev/null || echo '{}')
  DEPLOYED_VERSION=$(echo "$VERSION_RESPONSE" | node -e "const d=require('fs').readFileSync(0,'utf8'); const j=JSON.parse(d||'{}'); console.log(j.appVersion||'unknown')")
  DEPLOYED_SHA=$(echo "$VERSION_RESPONSE" | node -e "const d=require('fs').readFileSync(0,'utf8'); const j=JSON.parse(d||'{}'); console.log(j.buildSha||'unknown')")

  if [ "$DEPLOYED_VERSION" = "$APP_VERSION" ] && [ "$DEPLOYED_SHA" = "$BUILD_SHA" ]; then
    echo "[deploy] Version verification passed: $APP_VERSION ($BUILD_SHA)"
  else
    echo "[deploy] WARNING: Version mismatch - expected $APP_VERSION ($BUILD_SHA), got $DEPLOYED_VERSION ($DEPLOYED_SHA)"
  fi
fi

if [ "$TARGET_ENV" = "production" ]; then
  echo "[deploy] Recommended acceptance sequence:"
  echo "         bash scripts/cf-post-deploy-gate.sh production --base-url https://converttoit.com"
  echo "         CF_DEPLOY_BASE_URL=https://converttoit.com bun run cf:logs:check"
fi

echo "[deploy] Deployment complete for $TARGET_ENV"
