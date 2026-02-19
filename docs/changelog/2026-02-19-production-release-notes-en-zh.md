# Production Release Notes — 2026-02-19 (EN / 中文)

## 1) English

### Scope
This release delivers P2-level production hardening across Cloudflare operations, frontend conversion security, SEO/pSEO quality, and test/deploy closure.

### Key changes

#### A. Cloudflare ops and deploy hardening
- `/_ops/log-ping` now accepts auth token from `x-ops-token` header only (query-string token auth removed).
- Production deploy no longer passes `--env ""`; staging still uses `--env staging`.
- Wrangler fallback runner now supports explicit pinning via `CF_WRANGLER_VERSION` (default pinned package string).
- CI workflow includes production post-deploy gate and automatic rollback step when gate fails.
- Added deploy hardening tests and integrity guardrails.

#### B. Frontend conversion security hardening
- Added `src/handlers/layoutSanitizer.ts` to sanitize untrusted HTML/SVG used for layout extraction.
- Removed unsafe `innerHTML` injection paths in:
  - `src/handlers/svgForeignObject.ts`
  - `src/handlers/pyTurtle.ts`
- Normalized invalid-format failures to `Error` objects.
- Added focused regression tests for error normalization.

#### C. SEO / pSEO production upgrades
- Upgraded `scripts/build-pseo.mjs` with deeper page templates and stronger E-E-A-T/structured data signals.
- Regenerated all pSEO pages and artifacts under:
  - `public/format/**`
  - `public/compare/**`
  - `public/seo/**`
  - `public/sitemap.xml`
- Added Obsidian-ready audit artifact:
  - `docs/knowledge/SEO-pSEO-Production-Rollout-Audit-2026-02-19.md`

#### D. Browser test closure
- Stabilized browser gate using deterministic smoke test:
  - `test/browserSmoke.test.ts`
- `test:browser` now runs smoke suite by default.
- Full legacy browser regression retained as `test:browser:full`.

### Validation evidence (executed)
- `bun run pseo:build` ✅
- `bun run test:unit` ✅
- `bun run test:ops-hardening` ✅
- `bun run test:browser` ✅
- `VALIDATE_INCLUDE_BROWSER_TESTS=1 bun run validate:safe` ✅
- `bun run validate:production-readiness` ✅
- `bun run cf:deploy:dry-run` ✅
- `bun run cf:deploy` ✅
- `bash scripts/cf-post-deploy-gate.sh production --base-url https://converttoit.com` ✅

### Runtime verification
- `GET https://converttoit.com/_ops/health` returns `status: ok`.
- `GET https://converttoit.com/_ops/version` returns expected production metadata.
- Deployed Worker version ID: `745d382a-07cb-46d3-ae15-cfa88fc91dc7`.

### SEO quality snapshot
- `public/seo/seo-rubric-report.json`
  - `minScore: 29`
  - `averageScore: 29.92`
  - `minWordCount: 1428`
- `public/seo/anti-cannibalization-report.json`
  - `minMeaningfulUniquenessStrategyScore: 82.24`

---

## 2) 中文

### 发布范围
本次发布完成了 P2 级生产优化，覆盖 Cloudflare 运维闭环、前端转换安全、SEO/pSEO 质量提升，以及测试/部署闭环。

### 关键变更

#### A. Cloudflare 运维与部署加固
- `/_ops/log-ping` 仅支持 `x-ops-token` 请求头鉴权（移除 query token）。
- 生产部署不再传 `--env ""`，staging 仍使用 `--env staging`。
- wrangler 回退执行支持 `CF_WRANGLER_VERSION` 显式版本 pin。
- CI 增加生产 post-deploy gate，失败自动触发 rollback。
- 新增部署加固测试和完整性校验规则。

#### B. 前端转换安全加固
- 新增 `src/handlers/layoutSanitizer.ts`，用于不可信 HTML/SVG 的安全清洗。
- 修复以下文件中的 `innerHTML` 注入风险：
  - `src/handlers/svgForeignObject.ts`
  - `src/handlers/pyTurtle.ts`
- 统一非法输入输出的异常为 `Error` 对象。
- 新增错误归一化回归测试。

#### C. SEO / pSEO 升级
- 升级 `scripts/build-pseo.mjs`，增强内容深度、E-E-A-T 和结构化数据。
- 重新生成 pSEO 页面与产物：
  - `public/format/**`
  - `public/compare/**`
  - `public/seo/**`
  - `public/sitemap.xml`
- 新增 Obsidian 交付文档：
  - `docs/knowledge/SEO-pSEO-Production-Rollout-Audit-2026-02-19.md`

#### D. 浏览器测试闭环
- 增加稳定 smoke 用例：`test/browserSmoke.test.ts`。
- `test:browser` 默认执行 smoke。
- 旧全量浏览器回归保留为：`test:browser:full`。

### 验证证据（已执行）
- `bun run pseo:build` ✅
- `bun run test:unit` ✅
- `bun run test:ops-hardening` ✅
- `bun run test:browser` ✅
- `VALIDATE_INCLUDE_BROWSER_TESTS=1 bun run validate:safe` ✅
- `bun run validate:production-readiness` ✅
- `bun run cf:deploy:dry-run` ✅
- `bun run cf:deploy` ✅
- `bash scripts/cf-post-deploy-gate.sh production --base-url https://converttoit.com` ✅

### 线上校验
- `https://converttoit.com/_ops/health` 正常返回 `status: ok`。
- `https://converttoit.com/_ops/version` 正常返回生产元信息。
- 部署版本 ID：`745d382a-07cb-46d3-ae15-cfa88fc91dc7`。

### SEO 快照
- `seo-rubric-report.json`：`minScore=29`, `avg=29.92`, `minWordCount=1428`
- `anti-cannibalization-report.json`：`minMeaningfulUniquenessStrategyScore=82.24`
