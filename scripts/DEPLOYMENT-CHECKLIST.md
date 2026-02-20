# Deployment Checklist (Cloudflare Workers)

Last updated: 2026-02-20

Authoritative runbook: `docs/ops/cloudflare-deploy-runbook.md`

## 1) Pre-flight

- [ ] `wrangler.toml` exists (`cp wrangler.toml.example wrangler.toml` if missing)
- [ ] `.env.local` is sourced
- [ ] `CLOUDFLARE_API_TOKEN` is set (non-interactive)
- [ ] `CLOUDFLARE_ACCOUNT_ID` is set (non-interactive)
- [ ] Optional `CF_OPS_LOG_TOKEN` is set if `/_ops/log-ping` is protected

## 2) Mandatory command sequence

Run in this exact order:

```bash
bun run cf:deploy:dry-run
bun run cf:deploy
bash scripts/cf-post-deploy-gate.sh production --base-url https://converttoit.com
CF_DEPLOY_BASE_URL=https://converttoit.com bun run cf:logs:check
```

## 3) Acceptance criteria (GO gate)

- [ ] Dry run passed.
- [ ] Production deploy command succeeded.
- [ ] `cf-post-deploy-gate.sh` passed (`/_ops/health` + `/_ops/version` + internal log verification).
- [ ] Standalone `cf:logs:check` passed with correlation-id match.

## 4) If any step fails

- [ ] Mark release as **NO-GO**.
- [ ] Capture failing command, exit code, and timestamp.
- [ ] Run immediate rollback if production health is degraded:

```bash
bash scripts/cf-rollback.sh production --yes
```

- [ ] Re-run health/version/log checks after rollback.

