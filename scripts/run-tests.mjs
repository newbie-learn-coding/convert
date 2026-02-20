#!/usr/bin/env node
/**
 * Comprehensive Test Runner
 * Runs all tests and generates a summary report
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

const testSuites = [
  { name: "Core Unit Tests", command: ["bun", "test", "src/fileValidator.unit.test.ts", "src/performance.unit.test.ts", "src/logging.unit.test.ts"] },
  { name: "Traversion Graph", command: ["bun", "test", "test/TraversionGraph.test.ts"] },
  { name: "Handler Error Normalization", command: ["bun", "test", "test/handlerErrorNormalization.test.ts"] },
  {
    name: "Ops Hardening",
    command: [
      "bun",
      "test",
      "test/seoDomainPolicy.test.ts",
      "test/criticalFileIntegrity.test.ts",
      "test/cloudflareWorkerHardening.test.ts",
      "test/deployScriptHardening.test.ts",
    ],
  },
];

async function runTest(suite) {
  return new Promise((resolve) => {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Running: ${suite.name}`);
    console.log("=".repeat(60));

    const startTime = Date.now();
    const child = spawn(suite.command[0], suite.command.slice(1), {
      cwd: rootDir,
      stdio: "inherit",
    });

    child.on("close", (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      resolve({
        name: suite.name,
        passed: code === 0,
        code,
        duration,
      });
    });

    child.on("error", (error) => {
      console.error(`Error running ${suite.name}:`, error.message);
      resolve({
        name: suite.name,
        passed: false,
        code: -1,
        duration: 0,
        error: error.message,
      });
    });
  });
}

async function main() {
  console.log("Starting Test Suite Execution");
  console.log(`Root Directory: ${rootDir}`);

  const results = [];
  for (const suite of testSuites) {
    const result = await runTest(suite);
    results.push(result);
  }

  // Print summary
  console.log(`\n${"=".repeat(60)}`);
  console.log("TEST SUMMARY");
  console.log("=".repeat(60));

  let totalPassed = 0;
  let totalFailed = 0;

  for (const result of results) {
    const status = result.passed ? "PASS" : "FAIL";
    const icon = result.passed ? "✓" : "✗";
    console.log(`${icon} ${status}: ${result.name} (${result.duration}s)`);

    if (result.passed) {
      totalPassed++;
    } else {
      totalFailed++;
    }
  }

  console.log("-".repeat(60));
  console.log(`Total: ${results.length} suites, ${totalPassed} passed, ${totalFailed} failed`);
  console.log("=".repeat(60));

  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Test runner failed:", error);
  process.exit(1);
});
