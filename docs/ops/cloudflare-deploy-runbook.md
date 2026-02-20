# Cloudflare Production Operations Runbook (Authoritative)

Last updated: 2026-02-20

This is the single source of truth for:

- local setup
- deploy environment variables
- production deploy sequence
- post-deploy gate + log verification
- rollback
- incident response checklist

## 1) Scope and source files

Deploy tooling for this runbook is implemented in:

- `scripts/deploy.sh`
- `scripts/cf-post-deploy-gate.sh`
- `scripts/cf-log-check.sh`
- `scripts/cf-rollback.sh`
- `scripts/cf-common.sh`
- `wrangler.toml.example` (copy to local `wrangler.toml`)
- `.env.local.example` / `.env.cf.example`

## 2) Local setup (one-time on each machine)

```bash
# repo root
cp .env.local.example .env.local
cp wrangler.toml.example wrangler.toml

# edit .env.local with real values, then load
source .env.local
```

Do not commit `wrangler.toml` or any secret-bearing `.env*` file.

## 3) Environment variables

### Required for non-interactive deploy/rollback

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

### Optional but recommended

- `CF_OPS_LOG_TOKEN` (if `/_ops/log-ping` is protected)
- `CF_OPS_METRICS_TOKEN` (if Prometheus/Grafana scrapes `/_ops/metrics`)
- `CF_APP_VERSION` (otherwise package version is used)
- `CF_BUILD_SHA` (otherwise current git short SHA is used)
- `CF_DEPLOY_BASE_URL` (used by `bun run cf:logs:check`)
- `CF_ALLOW_INTERACTIVE=1` (only for local interactive wrangler auth fallback)

### Global limiter flags (feature-flagged, default-safe)

Default behavior is safe fallback (`RATE_LIMIT_GLOBAL_ENABLED=false`), so isolate-level in-memory limiter remains active.

- `CF_RATE_LIMIT_GLOBAL_ENABLED` → `true|false` (default `false`)
- `CF_RATE_LIMIT_GLOBAL_PROVIDER` → `durable_object|kv` (default `durable_object`)
- `CF_RATE_LIMIT_GLOBAL_DO_NAME` → Durable Object instance name (default `global-rate-limiter-v1`)
- `CF_RATE_LIMIT_GLOBAL_TELEMETRY_ENABLED` → enable global limiter for `/_ops/logs|/_ops/logging` (default `false`)
- `CF_RATE_LIMIT_GLOBAL_ALLOW_KV_FALLBACK` → must be `true` before KV mode is allowed (default `false`, KV not recommended)
- Optional fine-tuning:
  - `CF_RATE_LIMIT_GLOBAL_OPS_REQUESTS`
  - `CF_RATE_LIMIT_GLOBAL_OPS_WINDOW_SECONDS`
  - `CF_RATE_LIMIT_GLOBAL_TELEMETRY_REQUESTS`
  - `CF_RATE_LIMIT_GLOBAL_TELEMETRY_WINDOW_SECONDS`

Wrangler config now declares `GLOBAL_RATE_LIMITER` Durable Object binding and `v1-global-rate-limiter` migration (`new_sqlite_classes = ["GlobalRateLimiter"]`).

## 4) Production deploy sequence (safe order)

Run exactly in this order:

```bash
bun run cf:deploy:dry-run
bun run cf:deploy
bash scripts/cf-post-deploy-gate.sh production --base-url https://converttoit.com
CF_DEPLOY_BASE_URL=https://converttoit.com bun run cf:logs:check
```

What each command covers:

1. `cf:deploy:dry-run` → build + policy/integrity/asset/perf checks + wrangler dry run.
2. `cf:deploy` → real deploy with app version + build SHA injection.
3. `cf-post-deploy-gate.sh` → strict production checks on `/_ops/health` and `/_ops/version`, then built-in log-tail verification.
4. `cf:logs:check` → explicit standalone log-correlation acceptance proof.

> Note: step 3 already includes a log-correlation check. Keep step 4 anyway for explicit release evidence.

## 5) Manual log tailing (ad-hoc troubleshooting)

```bash
# production tail
node_modules/.bin/wrangler tail --config wrangler.toml --format pretty

# staging tail
node_modules/.bin/wrangler tail --config wrangler.toml --env staging --format pretty
```

Structured log verification helper:

```bash
bash scripts/cf-log-check.sh production --base-url https://converttoit.com
```

## 6) Rollback

### Fast rollback to previous version

```bash
bash scripts/cf-rollback.sh production --yes
```

### Rollback to a specific version

```bash
bash scripts/cf-rollback.sh production --list
bash scripts/cf-rollback.sh production <version-id> --yes
```

### Rollback verification

```bash
curl -fsS https://converttoit.com/_ops/health
curl -fsS https://converttoit.com/_ops/version
CF_DEPLOY_BASE_URL=https://converttoit.com bun run cf:logs:check
```

## 7) Incident checklist (production)

If any deploy gate fails, treat as an incident until resolved.

### Immediate (0-5 minutes)

- [ ] Stop further deploys.
- [ ] Capture failing command output + timestamp.
- [ ] Run:
  - `curl -fsS https://converttoit.com/_ops/health`
  - `curl -fsS https://converttoit.com/_ops/version`
  - `CF_DEPLOY_BASE_URL=https://converttoit.com bun run cf:logs:check`
- [ ] If service health/regression is confirmed: `bash scripts/cf-rollback.sh production --yes`.

### Stabilization (5-30 minutes)

- [ ] Confirm rollback/mitigation via health/version/log checks.
- [ ] Record deployed version id before and after rollback.
- [ ] Document user impact window.

### Closure

- [ ] Create incident notes with root cause + remediation.
- [ ] Add follow-up task(s) to prevent recurrence.
- [ ] Update runbook/checklists when process gaps are found.

## 8) BLOCKED conditions and remediation

If deployment is blocked, report `BLOCKED` with missing variable names only (never secret values).

Typical blockers:

- Missing `CLOUDFLARE_API_TOKEN`
- Missing `CLOUDFLARE_ACCOUNT_ID`
- Missing local `wrangler.toml` (create via `cp wrangler.toml.example wrangler.toml`)
- Invalid `CF_DEPLOY_BASE_URL` / wrong host for production gate
