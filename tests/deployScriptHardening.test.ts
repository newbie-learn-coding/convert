import { describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const ROOT_DIR = path.resolve(import.meta.dir, "..");

type DeployExecution = {
  result: ReturnType<typeof spawnSync>;
  npxArgs: string[];
  cleanup: () => void;
};

function runDeploy(
  targetEnv: "production" | "staging",
  extraEnv: Record<string, string> = {}
): DeployExecution {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), "deploy-hardening-"));
  const binDir = path.join(tempRoot, "bin");
  const argsFile = path.join(tempRoot, "npx-args.log");
  mkdirSync(binDir, { recursive: true });

  const stubNpxPath = path.join(binDir, "npx");
  writeFileSync(
    stubNpxPath,
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$@" > ${JSON.stringify(argsFile)}
`
  );
  chmodSync(stubNpxPath, 0o755);

  const result = spawnSync(
    "bash",
    ["scripts/deploy.sh", targetEnv, "--dry-run", "--skip-build", "--skip-policy-checks"],
    {
      cwd: ROOT_DIR,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
        CF_ALLOW_INTERACTIVE: "1",
        ...extraEnv
      }
    }
  );

  const npxArgs = existsSync(argsFile)
    ? readFileSync(argsFile, "utf8").split(/\r?\n/).filter(Boolean)
    : [];

  return {
    result,
    npxArgs,
    cleanup: () => rmSync(tempRoot, { recursive: true, force: true })
  };
}

describe("deploy.sh hardening", () => {
  test("production deploy does not pass --env", () => {
    const execution = runDeploy("production");
    try {
      if (execution.result.status !== 0) {
        console.error(execution.result.stdout);
        console.error(execution.result.stderr);
      }

      expect(execution.result.status).toBe(0);
      expect(execution.npxArgs).toContain("deploy");
      expect(execution.npxArgs).not.toContain("--env");
    } finally {
      execution.cleanup();
    }
  });

  test("staging deploy passes --env staging", () => {
    const execution = runDeploy("staging");
    try {
      if (execution.result.status !== 0) {
        console.error(execution.result.stdout);
        console.error(execution.result.stderr);
      }

      expect(execution.result.status).toBe(0);
      const envArgIndex = execution.npxArgs.indexOf("--env");
      expect(envArgIndex).toBeGreaterThanOrEqual(0);
      expect(execution.npxArgs[envArgIndex + 1]).toBe("staging");
    } finally {
      execution.cleanup();
    }
  });

  test("wrangler fallback uses pinned version from CF_WRANGLER_VERSION", () => {
    const execution = runDeploy("production", { CF_WRANGLER_VERSION: "4.11.1" });
    try {
      if (execution.result.status !== 0) {
        console.error(execution.result.stdout);
        console.error(execution.result.stderr);
      }

      expect(execution.result.status).toBe(0);
      expect(execution.npxArgs[1]).toBe("wrangler@4.11.1");
    } finally {
      execution.cleanup();
    }
  });
});
