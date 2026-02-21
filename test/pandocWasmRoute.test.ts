import { describe, expect, test } from "bun:test";
import worker from "../cloudflare/worker/index.mjs";

type AssetsBinding = { fetch: (request: Request) => Promise<Response> | Response };

globalThis.caches = {
  default: {
    match: async () => null,
    put: async () => {}
  }
} as unknown as CacheStorage;

function createEnv(overrides: Partial<Record<string, unknown>> = {}) {
  const assets: AssetsBinding = {
    fetch: () => new Response("asset-ok", { headers: { "cache-control": "public, max-age=60" } })
  };

  return {
    ENVIRONMENT: "production",
    APP_VERSION: "1.2.3",
    BUILD_SHA: "abc123",
    ASSETS: assets,
    ...overrides
  };
}

describe("/wasm/pandoc.wasm route", () => {
  test("serves pandoc.wasm from R2 binding when present", async () => {
    const env = createEnv({
      WASM_BUCKET: {
        get: async (key: string) => {
          if (key !== "pandoc.wasm") return null;
          return {
            body: new Uint8Array([0, 97, 115, 109]), // "\0asm" magic (truncated)
            size: 4,
            httpEtag: "\"test-etag\""
          };
        }
      }
    });

    const response = await worker.fetch(new Request("https://converttoit.com/wasm/pandoc.wasm"), env);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/wasm");
    expect(response.headers.get("etag")).toBe("\"test-etag\"");
  });

  test("returns 405 for unsupported methods", async () => {
    const response = await worker.fetch(
      new Request("https://converttoit.com/wasm/pandoc.wasm", { method: "POST" }),
      createEnv()
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, HEAD");
  });
});

