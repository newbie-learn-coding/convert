#!/usr/bin/env bun
/**
 * Integration Test Runner
 *
 * Helper script to run integration tests with proper setup and teardown.
 */

const { spawn } = require("child_process");

// Test files to run
const TEST_FILES = process.argv.slice(2);

if (TEST_FILES.length === 0) {
  console.log("Usage: bun run test/integration/run-tests.ts <test-file>...");
  console.log("Example: bun run test/integration/run-tests.ts conversion-flows");
  process.exit(1);
}

async function runTests() {
  console.log("Starting integration tests...");
  console.log("Test files:", TEST_FILES.join(", "));

  for (const testFile of TEST_FILES) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Running: ${testFile}`);
    console.log(`${"=".repeat(60)}`);

    const testPath = `test/integration/${testFile}.test.ts`;

    const proc = spawn("bun", ["test", testPath], {
      stdio: "inherit",
      env: {
        ...process.env,
        NODE_ENV: "test"
      }
    });

    await new Promise((resolve) => {
      proc.on("close", resolve);
    });
  }

  console.log("\n" + "=".repeat(60));
  console.log("All tests completed!");
  console.log("=".repeat(60));
}

runTests().catch(err => {
  console.error("Error running tests:", err);
  process.exit(1);
});
