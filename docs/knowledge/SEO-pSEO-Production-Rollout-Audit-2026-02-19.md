---
title: SEO + pSEO Production Rollout Audit (2026-02-19)
date: 2026-02-19
status: completed
tags:
  - seo
  - pseo
  - rollout
  - audit
  - obsidian
aliases:
  - Convert To It SEO pSEO Audit 2026-02-19
---

# SEO + pSEO Production Rollout Audit (2026-02-19)

## Linked references

- [[docs/ops/seo-pseo-production-rollout.md|SEO+pSEO production rollout runbook]]
- [[README.md#Cloudflare production deployment (Workers + static assets)|Production gate in README]]
- [[scripts/build-pseo.mjs|pSEO generator source of truth]]
- [[public/seo/seo-rubric-report.json|SEO rubric artifact]]
- [[public/seo/anti-cannibalization-report.json|Anti-cannibalization artifact]]

## Rollout summary

- Upgraded pSEO templates to produce deeper, structured detail pages with a hard body-depth gate (>=1000 words).
- Strengthened format/compare hub metadata with CTR-focused copy and strict length enforcement.
- Added stronger E-E-A-T signals via page-level editorial trust sections and enriched JSON-LD (`datePublished`, `dateModified`, `publisher`, `Article`/`WebPage` context).
- Preserved canonical policy: `.com` remains canonical, `.app` remains redirect-only.

## Audit evidence (latest run)

- `bun run pseo:build`
  - SEO rubric: **min 29/30**, **avg 29.92/30**
  - Meaningful uniqueness strategy: **min 82.24**, **avg 86.23**
  - Anti-cannibalization + canonical checks: pass
- `bun run check:seo-policy`: pass
- `bun run check:integrity`: pass
- `bun test tests/seoDomainPolicy.test.ts`: pass

## Quality gate checklist

- [x] Generated detail content depth target met (>=1000 words floor).
- [x] Anti-cannibalization strategy score >=80 across generated pages.
- [x] Canonical policy lock preserved (`https://converttoit.com` only).
- [x] SEO artifacts regenerated from script source (no manual artifact drift).

## Follow-up anchors

- Weekly: review [[public/seo/anti-cannibalization-report.json]] deltas.
- Release-day: run [[docs/ops/seo-pseo-production-rollout.md#3.2-build--quality-gates]].
- Monthly: reconfirm `.app -> .com` redirect health + indexation cohorts.
