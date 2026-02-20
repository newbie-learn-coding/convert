import { afterAll, expect, test } from "bun:test";
import puppeteer from "puppeteer";
import type { ConvertPathNode, FileData, FileFormat, FormatHandler } from "../src/FormatHandler.js";
import CommonFormats from "../src/CommonFormats.js";

declare global {
  interface Window {
    queryFormatNode: (testFunction: (value: ConvertPathNode) => boolean) => ConvertPathNode | undefined;
    tryConvertByTraversing: (
      files: FileData[],
      from: ConvertPathNode,
      to: ConvertPathNode
    ) => Promise<{ files: FileData[]; path: ConvertPathNode[] } | null>;
  }
}

const server = Bun.serve({
  async fetch (req) {
    let path = new URL(req.url).pathname.replace("/convert/", "") || "index.html";
    if (path.startsWith("/test/")) path = "../test/resources/" + path.slice(6);
    const file = Bun.file(`${__dirname}/../dist/${path}`);
    if (!(await file.exists())) return new Response("Not Found", { status: 404 });
    return new Response(file);
  },
  port: 8080
});

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"]
});
const page = await browser.newPage();

await page.goto("http://localhost:8080/convert/index.html");
await page.waitForFunction(
  () => typeof window.tryConvertByTraversing === "function"
    && (window.traversionGraph as { getData?: () => { nodes?: unknown[] } })?.getData?.().nodes?.length > 0,
  { timeout: 180000 }
);

const dummyHandler: FormatHandler = {
  name: "dummy",
  ready: true,
  async init () { },
  async doConvert () {
    return [];
  }
};

function attemptConversion (
  files: string[],
  from: FileFormat,
  to: FileFormat
) {
  return page.evaluate(async (testFileNames, from, to) => {
    const payload: FileData[] = [];
    for (const fileName of testFileNames) {
      payload.push({
        bytes: await fetch("/test/" + fileName).then(r => r.bytes()),
        name: fileName
      });
    }
    return await window.tryConvertByTraversing(payload, from, to);
  },
    files,
    { format: from, handler: dummyHandler },
    { format: to, handler: dummyHandler }
  );
}

test("browser smoke: app initializes conversion graph", async () => {
  const summary = await page.evaluate(() => {
    return {
      hasTraversal: typeof window.tryConvertByTraversing === "function",
      formatGroups: window.supportedFormatCache.size
    };
  });

  expect(summary.hasTraversal).toBe(true);
  expect(summary.formatGroups).toBeGreaterThan(0);
});

test("browser smoke: png converts to jpeg with non-empty output", async () => {
  const conversion = await attemptConversion(
    ["colors_50x50.png"],
    CommonFormats.PNG,
    CommonFormats.JPEG
  );

  expect(conversion).toBeDefined();
  expect(conversion).not.toBeNull();

  const route = conversion!.path.map(step => step.format.mime);
  expect(route[0]).toBe("image/png");
  expect(route[route.length - 1]).toBe("image/jpeg");
  expect(route.length).toBeGreaterThanOrEqual(2);

  expect(conversion!.files.length).toBeGreaterThanOrEqual(1);
  const outputBytesLength = Object.values(conversion!.files[0].bytes).length;
  expect(outputBytesLength).toBeGreaterThan(0);
});

afterAll(async () => {
  await browser.close();
  server.stop();
});
