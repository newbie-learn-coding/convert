import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PRIMARY_DOMAIN = "https://converttoit.com";

const errors = [];

function readFile(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  try {
    return fs.readFileSync(absolutePath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`${relativePath}: unable to read file (${message})`);
    return "";
  }
}

function assertFileExists(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`${relativePath}: file is missing`);
    return false;
  }
  const stat = fs.statSync(absolutePath);
  if (!stat.isFile()) {
    errors.push(`${relativePath}: expected a file`);
    return false;
  }
  if (stat.size === 0) {
    errors.push(`${relativePath}: file is empty`);
    return false;
  }
  return true;
}

const requiredFiles = [
  "index.html",
  ".github/workflows/cloudflare-deploy.yml",
  ".github/workflows/pages.yml",
  "public/robots.txt",
  "public/sitemap.xml",
  "public/_headers",
  "public/_redirects",
  "cloudflare/redirects/converttoit.app/_redirects",
  "cloudflare/worker/index.mjs",
  "wrangler.toml.example",
  "scripts/cf-common.sh",
  "scripts/check-cloudflare-asset-sizes.mjs",
  "scripts/cf-post-deploy-gate.sh",
  "scripts/validate-production-readiness.sh",
  "scripts/validate-safe.sh"
];

for (const requiredFile of requiredFiles) {
  assertFileExists(requiredFile);
}

const robots = readFile("public/robots.txt");
for (const requiredLine of [
  "User-agent: *",
  "Allow: /",
  `Sitemap: ${PRIMARY_DOMAIN}/sitemap.xml`
]) {
  if (!robots.includes(requiredLine)) {
    errors.push(`public/robots.txt: missing line -> ${requiredLine}`);
  }
}

const sitemap = readFile("public/sitemap.xml");
if (!sitemap.includes("<urlset")) {
  errors.push("public/sitemap.xml: missing <urlset>");
}
const sitemapLocs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
if (!sitemapLocs.includes(`${PRIMARY_DOMAIN}/`)) {
  errors.push(`public/sitemap.xml: missing required URL ${PRIMARY_DOMAIN}/`);
}

const headers = readFile("public/_headers");
for (const requiredHeader of [
  "Strict-Transport-Security:",
  "Content-Security-Policy:",
  "X-Content-Type-Options: nosniff",
  "X-Frame-Options: DENY"
]) {
  if (!headers.includes(requiredHeader)) {
    errors.push(`public/_headers: missing required security header -> ${requiredHeader}`);
  }
}

const redirectRules = readFile("public/_redirects");
for (const requiredRedirect of [
  "/index.html / 301"
]) {
  if (!redirectRules.includes(requiredRedirect)) {
    errors.push(`public/_redirects: missing redirect rule -> ${requiredRedirect}`);
  }
}
for (const line of redirectRules.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
  if (/^https?:\/\//i.test(trimmed)) {
    errors.push(`public/_redirects: host-based redirects are not allowed for Workers assets -> ${trimmed}`);
  }
}

const edgeRedirectRules = readFile("cloudflare/redirects/converttoit.app/_redirects");
for (const requiredRedirect of [
  "https://converttoit.app/* https://converttoit.com/:splat 301!",
  "http://converttoit.app/* https://converttoit.com/:splat 301!",
  "https://www.converttoit.app/* https://converttoit.com/:splat 301!",
  "http://www.converttoit.app/* https://converttoit.com/:splat 301!"
]) {
  if (!edgeRedirectRules.includes(requiredRedirect)) {
    errors.push(`cloudflare/redirects/converttoit.app/_redirects: missing redirect rule -> ${requiredRedirect}`);
  }
}

const workerSource = readFile("cloudflare/worker/index.mjs");
for (const requiredWorkerToken of [
  "DEFAULT_SECURITY_HEADERS",
  "x-robots-tag",
  "OPS_ALLOWED_METHODS",
  "method_not_allowed",
  "x-ops-token",
  "MAX_CORRELATION_ID_LENGTH = 64",
  "CANONICAL_ORIGIN = \"https://converttoit.com\"",
  "\"converttoit.app\"",
  "\"www.converttoit.com\"",
  "Response.redirect(canonicalUrl.toString(), 301)"
]) {
  if (!workerSource.includes(requiredWorkerToken)) {
    errors.push(`cloudflare/worker/index.mjs: missing hardening token -> ${requiredWorkerToken}`);
  }
}
if (workerSource.includes("searchParams.get(\"token\")")) {
  errors.push("cloudflare/worker/index.mjs: query-string token auth must not be supported");
}

for (const workflowFile of [".github/workflows/cloudflare-deploy.yml", ".github/workflows/pages.yml"]) {
  const workflowSource = readFile(workflowFile);
  for (const requiredToken of [
    "Production readiness gates (canonical + deploy)",
    "bun run validate:production-readiness"
  ]) {
    if (!workflowSource.includes(requiredToken)) {
      errors.push(`${workflowFile}: missing workflow gate token -> ${requiredToken}`);
    }
  }
}

const cloudflareDeployWorkflow = readFile(".github/workflows/cloudflare-deploy.yml");
for (const requiredToken of [
  "Post-deploy production ops gate",
  "if: env.TARGET_ENV == 'production'",
  "CF_DEPLOY_BASE_URL: https://converttoit.com",
  "bash scripts/cf-post-deploy-gate.sh production --base-url \"$CF_DEPLOY_BASE_URL\"",
  "Rollback production deploy on post-deploy gate failure",
  "steps.deploy_step.outcome == 'success'",
  "steps.post_deploy_gate.outcome == 'failure'",
  "bash scripts/cf-rollback.sh production --yes"
]) {
  if (!cloudflareDeployWorkflow.includes(requiredToken)) {
    errors.push(`.github/workflows/cloudflare-deploy.yml: missing post-deploy ops gate token -> ${requiredToken}`);
  }
}

const deployScriptSource = readFile("scripts/deploy.sh");
for (const requiredToken of [
  "if [ \"$TARGET_ENV\" != \"production\" ]; then",
  "DEPLOY_ARGS+=(--env \"$TARGET_ENV\")"
]) {
  if (!deployScriptSource.includes(requiredToken)) {
    errors.push(`scripts/deploy.sh: missing deploy hardening token -> ${requiredToken}`);
  }
}
if (deployScriptSource.includes("DEPLOY_ARGS+=(--env \"\")")) {
  errors.push("scripts/deploy.sh: production deploy must not pass --env \"\"");
}

const cfCommonSource = readFile("scripts/cf-common.sh");
for (const requiredToken of [
  "DEFAULT_WRANGLER_VERSION",
  "CF_WRANGLER_VERSION",
  "WRANGLER_PACKAGE=\"wrangler@${CF_WRANGLER_VERSION}\""
]) {
  if (!cfCommonSource.includes(requiredToken)) {
    errors.push(`scripts/cf-common.sh: missing wrangler pinning token -> ${requiredToken}`);
  }
}
if (cfCommonSource.includes("wrangler@4")) {
  errors.push("scripts/cf-common.sh: floating wrangler@4 pin must not be used");
}

const postDeployGateScript = readFile("scripts/cf-post-deploy-gate.sh");
for (const requiredToken of [
  "CANONICAL_HOST=\"converttoit.com\"",
  "/_ops/health",
  "/_ops/version",
  "cf-log-check.sh\" production --base-url \"$NORMALIZED_BASE_URL\""
]) {
  if (!postDeployGateScript.includes(requiredToken)) {
    errors.push(`scripts/cf-post-deploy-gate.sh: missing post-deploy check token -> ${requiredToken}`);
  }
}

const productionReadinessScript = readFile("scripts/validate-production-readiness.sh");
for (const requiredToken of [
  "bun run check:integrity",
  "bun run test:ops-hardening",
  "bun run build",
  "bun run check:cf-assets"
]) {
  if (!productionReadinessScript.includes(requiredToken)) {
    errors.push(`scripts/validate-production-readiness.sh: missing gate command -> ${requiredToken}`);
  }
}

if (errors.length > 0) {
  console.error("Critical file integrity check failed:\n");
  for (const [index, error] of errors.entries()) {
    console.error(`${index + 1}. ${error}`);
  }
  process.exit(1);
}

console.log(`Critical file integrity check passed (${requiredFiles.length} required files, ${sitemapLocs.length} sitemap URLs).`);
