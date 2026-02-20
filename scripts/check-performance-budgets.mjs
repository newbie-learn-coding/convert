#!/usr/bin/env node
/**
 * Performance budget checker.
 * Covers all critical build artifacts (js/css/html/wasm/json/bin) in dist/.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, constants as zlibConstants, gzipSync } from "node:zlib";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DIST_DIR = path.resolve(__dirname, "../dist");
const VERBOSE = process.env.PERF_BUDGET_VERBOSE === "1";
const GZIP_LEVEL = parseBoundedInteger(process.env.PERF_BUDGET_GZIP_LEVEL, 9, 1, 9);
const BROTLI_QUALITY = parseBoundedInteger(process.env.PERF_BUDGET_BROTLI_QUALITY, 4, 0, 11);
const CRITICAL_EXTENSIONS = new Set([".js", ".css", ".html", ".wasm", ".json", ".bin"]);

const BUDGET_RULES = [
  {
    name: "entry-html",
    test: (artifactPath) => artifactPath === "index.html",
    budget: { raw: 80, gzip: 20, brotli: 16 }
  },
  {
    name: "pseo-html",
    test: (artifactPath) => artifactPath.startsWith("format/") || artifactPath.startsWith("compare/"),
    budget: { raw: 40, gzip: 10, brotli: 8 }
  },
  {
    name: "entry-js",
    test: (artifactPath) =>
      /^assets\/(index|main|polyfills|worker|flo\.worker|sqlite3-opfs-async-proxy|sqlite3-worker1)-.*\.js$/.test(artifactPath),
    budget: { raw: 260, gzip: 180, brotli: 160 }
  },
  {
    name: "handler-js",
    test: (artifactPath) => /^assets\/handler-.*\.js$/.test(artifactPath),
    budget: { raw: 260, gzip: 200, brotli: 185 }
  },
  {
    name: "vendor-js",
    test: (artifactPath) => /^assets\/vendor-.*\.js$/.test(artifactPath),
    budget: { raw: 760, gzip: 320, brotli: 280 }
  },
  {
    name: "asset-wasm",
    test: (artifactPath) => /^assets\/.*\.wasm$/.test(artifactPath),
    budget: { raw: 2600, gzip: 1000, brotli: 820 }
  },
  {
    name: "wasm-runtime",
    test: (artifactPath) => /^wasm\/.*\.wasm$/.test(artifactPath),
    budget: { raw: 15360, gzip: 5600, brotli: 5000 }
  },
  {
    name: "wasm-runtime-js",
    test: (artifactPath) => /^wasm\/.*\.js$/.test(artifactPath),
    budget: { raw: 180, gzip: 55, brotli: 50 }
  },
  {
    name: "binary-chunk",
    test: (artifactPath) => /^assets\/.*\.bin$/.test(artifactPath),
    budget: { raw: 220, gzip: 160, brotli: 150 }
  },
  {
    name: "css",
    test: (artifactPath) => artifactPath.endsWith(".css"),
    budget: { raw: 120, gzip: 35, brotli: 30 }
  },
  {
    name: "seo-json",
    test: (artifactPath) => artifactPath.startsWith("seo/") && artifactPath.endsWith(".json"),
    budget: { raw: 100, gzip: 20, brotli: 18 }
  },
  {
    name: "generic-js",
    test: (artifactPath) => artifactPath.endsWith(".js"),
    budget: { raw: 400, gzip: 180, brotli: 160 }
  },
  {
    name: "generic-html",
    test: (artifactPath) => artifactPath.endsWith(".html"),
    budget: { raw: 50, gzip: 12, brotli: 10 }
  },
  {
    name: "generic-json",
    test: (artifactPath) => artifactPath.endsWith(".json"),
    budget: { raw: 120, gzip: 30, brotli: 25 }
  },
  {
    name: "generic-binary",
    test: () => true,
    budget: { raw: 260, gzip: 180, brotli: 170 }
  }
];

function parseBoundedInteger(inputValue, fallbackValue, min, max) {
  const parsedValue = Number.parseInt(String(inputValue ?? ""), 10);
  if (!Number.isFinite(parsedValue)) {
    return fallbackValue;
  }
  return Math.min(max, Math.max(min, parsedValue));
}

function toPosixPath(inputPath) {
  return inputPath.split(path.sep).join("/");
}

function collectCriticalArtifacts(rootDir) {
  const artifactFiles = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    if (!currentDir) {
      continue;
    }

    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (!CRITICAL_EXTENSIONS.has(ext)) {
        continue;
      }

      artifactFiles.push({
        absolutePath,
        relativePath: toPosixPath(path.relative(rootDir, absolutePath))
      });
    }
  }

  artifactFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return artifactFiles;
}

function resolveBudget(artifactPath) {
  for (const rule of BUDGET_RULES) {
    if (rule.test(artifactPath)) {
      return rule;
    }
  }
  return BUDGET_RULES[BUDGET_RULES.length - 1];
}

function toKB(valueInBytes) {
  return valueInBytes / 1024;
}

function measureArtifactSizes(absolutePath) {
  const buffer = readFileSync(absolutePath);
  const gzipBuffer = gzipSync(buffer, { level: GZIP_LEVEL });
  const brotliBuffer = brotliCompressSync(buffer, {
    params: {
      [zlibConstants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY
    }
  });

  return {
    raw: toKB(buffer.length),
    gzip: toKB(gzipBuffer.length),
    brotli: toKB(brotliBuffer.length)
  };
}

function evaluateArtifact(artifactPath, measuredSizes, budgetRule) {
  const failedMetrics = [];
  const metricNames = ["raw", "gzip", "brotli"];

  for (const metricName of metricNames) {
    if (measuredSizes[metricName] > budgetRule.budget[metricName]) {
      failedMetrics.push(metricName);
    }
  }

  return {
    artifactPath,
    rule: budgetRule.name,
    sizes: measuredSizes,
    budget: budgetRule.budget,
    passed: failedMetrics.length === 0,
    failedMetrics
  };
}

function formatSize(sizeInKB) {
  return `${sizeInKB.toFixed(1)}KB`;
}

function printLargestArtifacts(results) {
  const largest = [...results]
    .sort((left, right) => right.sizes.raw - left.sizes.raw)
    .slice(0, 10)
    .map((result) => ({
      artifact: result.artifactPath,
      rule: result.rule,
      raw: formatSize(result.sizes.raw),
      gzip: formatSize(result.sizes.gzip),
      brotli: formatSize(result.sizes.brotli),
      passed: result.passed ? "✓" : "✗"
    }));

  console.log("Top 10 largest critical artifacts:");
  console.table(largest);
}

function printFailedArtifacts(failedResults) {
  if (failedResults.length === 0) {
    return;
  }

  console.warn(`\n${failedResults.length} artifact(s) exceeded performance budgets:`);
  console.table(
    failedResults.map((result) => ({
      artifact: result.artifactPath,
      rule: result.rule,
      failedMetrics: result.failedMetrics.join(", "),
      raw: `${formatSize(result.sizes.raw)} / ${formatSize(result.budget.raw)}`,
      gzip: `${formatSize(result.sizes.gzip)} / ${formatSize(result.budget.gzip)}`,
      brotli: `${formatSize(result.sizes.brotli)} / ${formatSize(result.budget.brotli)}`
    }))
  );
}

function printVerboseResults(results) {
  if (!VERBOSE) {
    return;
  }

  console.log("\nDetailed artifact results:");
  console.table(
    results.map((result) => ({
      artifact: result.artifactPath,
      rule: result.rule,
      raw: `${formatSize(result.sizes.raw)} / ${formatSize(result.budget.raw)}`,
      gzip: `${formatSize(result.sizes.gzip)} / ${formatSize(result.budget.gzip)}`,
      brotli: `${formatSize(result.sizes.brotli)} / ${formatSize(result.budget.brotli)}`,
      passed: result.passed ? "✓" : "✗"
    }))
  );
}

function checkPerformanceBudgets() {
  console.log("Checking performance budgets...\n");

  if (!existsSync(DIST_DIR)) {
    console.error(`Dist directory not found: ${DIST_DIR}`);
    return false;
  }

  const artifacts = collectCriticalArtifacts(DIST_DIR);
  if (artifacts.length === 0) {
    console.error("No critical build artifacts found. Run build first.");
    return false;
  }

  const results = artifacts.map((artifact) => {
    const measuredSizes = measureArtifactSizes(artifact.absolutePath);
    const budgetRule = resolveBudget(artifact.relativePath);
    return evaluateArtifact(artifact.relativePath, measuredSizes, budgetRule);
  });

  const failedResults = results.filter((result) => !result.passed);
  const passedCount = results.length - failedResults.length;

  console.log(`Checked ${results.length} critical artifacts in ${DIST_DIR}`);
  console.log(`Compression settings: gzip(level=${GZIP_LEVEL}), brotli(quality=${BROTLI_QUALITY})`);
  console.log(`${passedCount}/${results.length} artifacts passed performance budgets.`);

  printLargestArtifacts(results);
  printFailedArtifacts(failedResults);
  printVerboseResults(results);

  return failedResults.length === 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const passed = checkPerformanceBudgets();
  process.exit(passed ? 0 : 1);
}

export { checkPerformanceBudgets };
