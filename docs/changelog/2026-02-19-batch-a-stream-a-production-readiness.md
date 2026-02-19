# Batch A / Stream A — Production readiness + canonical workflow gate groundwork

Date: 2026-02-19

## Scope covered

- Added a dedicated production readiness gate command for CI and local preflight.
- Wired Cloudflare/Pages verify workflows to run the new gate command.
- Strengthened canonical-domain guardrails so `.com` remains canonical and `.app` remains redirect-only.
- Updated deployment docs/runbooks with the new gate path.

## Files updated

- `scripts/validate-production-readiness.sh` (new)
- `package.json`
- `.github/workflows/cloudflare-deploy.yml`
- `.github/workflows/pages.yml`
- `scripts/check-critical-files.mjs`
- `scripts/check-seo-domain-policy.mjs`
- `README.md`
- `docs/ops/cloudflare-deploy-runbook.md`
- `docs/ops/seo-pseo-production-rollout.md`

## Validation commands executed

```bash
bun run check:seo-policy
bun run check:integrity
bun run validate:production-readiness
```

Result: pass in this stream.
