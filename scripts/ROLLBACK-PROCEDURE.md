# Rollback Procedure (Cloudflare Workers)

Last updated: 2026-02-20

Authoritative runbook: `docs/ops/cloudflare-deploy-runbook.md`

## 1) When to rollback

Rollback immediately for:

- production outage
- severe error-rate spike
- data integrity/security regression
- failed post-deploy gate with user-facing impact

## 2) Rollback commands

### Roll back to previous deployment

```bash
bash scripts/cf-rollback.sh production --yes
```

### Roll back to a specific version

```bash
bash scripts/cf-rollback.sh production --list
bash scripts/cf-rollback.sh production <version-id> --yes
```

## 3) Post-rollback verification (required)

```bash
curl -fsS https://converttoit.com/_ops/health
curl -fsS https://converttoit.com/_ops/version
CF_DEPLOY_BASE_URL=https://converttoit.com bun run cf:logs:check
```

## 4) Incident closure checklist

- [ ] Service recovered and verified.
- [ ] Before/after version IDs recorded.
- [ ] User impact window documented.
- [ ] Root-cause follow-up ticket created.

