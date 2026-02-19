#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Running production readiness gates (canonical policy + deploy guardrails)..."

bun run check:seo-policy
bun run check:integrity
bun run test:ops-hardening
bun run build
bun run check:cf-assets

echo "Production readiness gates passed."
