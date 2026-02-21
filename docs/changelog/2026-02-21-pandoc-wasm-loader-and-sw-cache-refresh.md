# 2026-02-21 — Pandoc wasm loader hardening + service worker cache refresh

## Why

Production users reported runtime errors like:

- `/wasm/pandoc.wasm` → `404`
- `Failed to execute 'compile' on 'WebAssembly': HTTP status code is not ok`
- `LazyHandler` initialization failure for `pandoc`

This happened when a wasm URL failed and the fallback path was unavailable in Cloudflare static assets (expected due size limits), and some clients were still running stale cached JS/service-worker state.

## What changed

- Hardened `src/handlers/pandoc/pandoc.js` wasm initialization:
  - Always includes fallback candidates even when `VITE_PANDOC_WASM_URL` is provided.
  - Validates HTTP status before WebAssembly compile (`response.ok` guard).
  - Uses `instantiateStreaming(response.clone())` with `arrayBuffer()` fallback for content-type/runtime compatibility.
- Bumped service worker cache version in `public/sw.js`:
  - `CACHE_VERSION: "v1" -> "v2"`
  - Forces stale cache eviction and new asset activation.

## Validation evidence

Commands:

```bash
bun run build
bun run check:cf-assets
bun run test:unit
NPM_CONFIG_CACHE=/tmp/npm-cache bun run cf:deploy
bash scripts/cf-post-deploy-gate.sh production --base-url https://converttoit.com
```

Key outcomes:

- Build succeeded.
- Cloudflare asset-size check passed.
- Unit test suite passed.
- Production deploy succeeded (worker version id: `89e167c6-cbb6-4a86-963f-20373537e23a`).
- Post-deploy gate passed (health/version/log-correlation).

## Operational note

If a user still sees old bundle errors, ask them to hard refresh once (`Cmd/Ctrl + Shift + R`) so the new service worker/cache version is applied immediately.
