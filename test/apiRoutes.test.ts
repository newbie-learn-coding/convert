import { describe, expect, test } from "bun:test";
import worker from "../cloudflare/worker/index.mjs";

type AssetsBinding = { fetch: (request: Request) => Promise<Response> | Response };

const MOCK_CACHE_PAYLOAD = [
  [
    "handler-a",
    [
      {
        name: "Portable Network Graphics",
        format: "png",
        extension: "png",
        mime: "image/png",
        category: "image",
        internal: "png",
        from: true,
        to: false,
        lossless: true
      },
      {
        name: "Waveform Audio",
        format: "wav",
        extension: "wav",
        mime: "audio/wav",
        category: "audio",
        internal: "wav",
        from: true,
        to: true,
        lossless: true
      }
    ]
  ],
  [
    "handler-b",
    [
      {
        name: "Joint Photographic Experts Group",
        format: "jpeg",
        extension: "jpg",
        mime: "image/jpeg",
        category: ["image", "photo"],
        internal: "jpeg",
        from: false,
        to: true,
        lossless: false
      }
    ]
  ]
];

globalThis.caches = {
  default: {
    match: async () => null,
    put: async () => {}
  }
} as unknown as CacheStorage;

function createEnv(overrides: Partial<Record<string, unknown>> = {}) {
  const assets: AssetsBinding = {
    fetch: (request: Request) => {
      const url = new URL(request.url);
      if (url.pathname === "/cache.json") {
        return new Response(JSON.stringify(MOCK_CACHE_PAYLOAD), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      return new Response("Not Found", { status: 404 });
    }
  };

  return {
    ENVIRONMENT: "test",
    APP_VERSION: "test-version",
    BUILD_SHA: "test-sha",
    ASSETS: assets,
    ...overrides
  };
}

describe("API v1 free endpoints", () => {
  test("serves /api/v1/status with API CORS and overridden COOP/CORP headers", async () => {
    const response = await worker.fetch(
      new Request("https://converttoit.com/api/v1/status", {
        headers: { "cf-connecting-ip": "203.0.113.10" }
      }),
      createEnv()
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("cross-origin-opener-policy")).toBe("unsafe-none");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("cross-origin");

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.service).toBe("converttoit.com");
    expect(body.environment).toBe("test");
    expect(body.appVersion).toBe("test-version");
    expect(body.buildSha).toBe("test-sha");

    const headResponse = await worker.fetch(
      new Request("https://converttoit.com/api/v1/status", {
        method: "HEAD",
        headers: { "cf-connecting-ip": "203.0.113.14" }
      }),
      createEnv()
    );
    expect(headResponse.status).toBe(200);
    expect(await headResponse.text()).toBe("");
  });

  test("filters /api/v1/formats by category/from/to/q", async () => {
    const response = await worker.fetch(
      new Request("https://converttoit.com/api/v1/formats?category=image&from=true&to=false&q=png", {
        headers: { "cf-connecting-ip": "203.0.113.11" }
      }),
      createEnv()
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(body.total).toBe(3);
    expect(body.count).toBe(1);
    expect(body.filters).toEqual({
      category: ["image"],
      from: true,
      to: false,
      q: "png"
    });
    expect(body.items[0].format).toBe("png");
    expect(body.items[0].handlers).toContain("handler-a");

    const headResponse = await worker.fetch(
      new Request("https://converttoit.com/api/v1/formats?category=image", {
        method: "HEAD",
        headers: { "cf-connecting-ip": "203.0.113.15" }
      }),
      createEnv()
    );
    expect(headResponse.status).toBe(200);
    expect(await headResponse.text()).toBe("");
  });

  test("serves /api/v1/handlers list", async () => {
    const response = await worker.fetch(
      new Request("https://converttoit.com/api/v1/handlers", {
        headers: { "cf-connecting-ip": "203.0.113.12" }
      }),
      createEnv()
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(body.count).toBe(2);
    expect(body.items).toHaveLength(2);
    expect(body.items[0].handler).toBe("handler-a");
    expect(body.items[0].formatCount).toBe(2);
    expect(body.items[0].categories).toEqual(["audio", "image"]);
    expect(body.items[0].formats).toHaveLength(2);
    expect(body.items[1].handler).toBe("handler-b");
    expect(body.items[1].formats).toHaveLength(1);

    const headResponse = await worker.fetch(
      new Request("https://converttoit.com/api/v1/handlers", {
        method: "HEAD",
        headers: { "cf-connecting-ip": "203.0.113.16" }
      }),
      createEnv()
    );
    expect(headResponse.status).toBe(200);
    expect(await headResponse.text()).toBe("");
  });

  test("handles OPTIONS preflight for /api/v1 routes", async () => {
    const response = await worker.fetch(
      new Request("https://converttoit.com/api/v1/formats", {
        method: "OPTIONS",
        headers: { "cf-connecting-ip": "203.0.113.13" }
      }),
      createEnv()
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-methods")).toBe("GET, HEAD, OPTIONS");
    expect(response.headers.get("cross-origin-opener-policy")).toBe("unsafe-none");
    expect(await response.text()).toBe("");
  });

  test("returns 429 after 60 requests/minute per IP", async () => {
    const env = createEnv();
    const ip = "203.0.113.60";
    let lastResponse: Response | null = null;

    for (let index = 0; index < 61; index++) {
      lastResponse = await worker.fetch(
        new Request("https://converttoit.com/api/v1/status", {
          headers: { "cf-connecting-ip": ip }
        }),
        env
      );
    }

    expect(lastResponse).not.toBeNull();
    expect(lastResponse?.status).toBe(429);
    expect(lastResponse?.headers.get("x-ratelimit-limit")).toBe("60");
    expect(lastResponse?.headers.get("x-ratelimit-source")).toBe("isolate");
    const body = await lastResponse!.json();
    expect(body.error).toBe("rate_limited");
  });
});
