import { afterAll, expect, test } from "bun:test";
import puppeteer from "puppeteer";
import type { FileData, FormatHandler, FileFormat, ConvertPathNode } from "../src/FormatHandler.js";
import CommonFormats from "../src/CommonFormats.js";

declare global {
  interface Window {
    queryFormatNode: (testFunction: (value: ConvertPathNode) => boolean) => ConvertPathNode | undefined;
    tryConvertByTraversing: (files: FileData[], from: ConvertPathNode, to: ConvertPathNode) => Promise<{
      files: FileData[];
      path: ConvertPathNode[];
    } | null>;
  }
}

// Set up a basic webserver to host the distribution build
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

// Start puppeteer, wait for ready confirmation
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

console.log("Setup finished.");

const dummyHandler: FormatHandler = {
  name: "dummy",
  ready: true,
  async init () { },
  async doConvert (inputFiles, inputFormat, outputFormat, args) {
    return [];
  }
};

function attemptConversion (
  files: string[],
  from: FileFormat,
  to: FileFormat
) {
  return page.evaluate(async (testFileNames, from, to) => {
    const files: FileData[] = [];
    for (const fileName of testFileNames) {
      files.push({
        bytes: await fetch("/test/" + fileName).then(r => r.bytes()),
        name: fileName
      });
    }
    return await window.tryConvertByTraversing(files, from, to);
  },
    files,
    { format: from, handler: dummyHandler },
    { format: to, handler: dummyHandler }
  );
}

// ==================================================================
//                         START OF TESTS
// ==================================================================

function expectSuccessfulRoute(
  conversion: Awaited<ReturnType<typeof attemptConversion>>,
  fromMime: string,
  toMime: string
) {
  expect(conversion).not.toBeNull();
  const mimes = conversion!.path.map(step => step.format.mime);
  expect(mimes[0]).toBe(fromMime);
  expect(mimes[mimes.length - 1]).toBe(toMime);
  expect(conversion!.files.length).toBeGreaterThan(0);
}

test("png → jpeg succeeds with a valid route", async () => {
  const conversion = await attemptConversion(
    ["colors_50x50.png"],
    CommonFormats.PNG,
    CommonFormats.JPEG
  );
  expectSuccessfulRoute(conversion, "image/png", "image/jpeg");
}, { timeout: 60000 });

test("png → webp succeeds with a valid route", async () => {
  const conversion = await attemptConversion(
    ["colors_50x50.png"],
    CommonFormats.PNG,
    CommonFormats.WEBP
  );
  expectSuccessfulRoute(conversion, "image/png", "image/webp");
}, { timeout: 60000 });

test("jpeg → png succeeds with a valid route", async () => {
  const conversion = await attemptConversion(
    ["colors_50x50.png"],
    CommonFormats.JPEG,
    CommonFormats.PNG
  );
  expectSuccessfulRoute(conversion, "image/jpeg", "image/png");
}, { timeout: 60000 });

test("mp3 → wav succeeds with a valid route", async () => {
  const conversion = await attemptConversion(
    ["gaster.mp3"],
    CommonFormats.MP3,
    CommonFormats.WAV
  );
  expectSuccessfulRoute(conversion, "audio/mpeg", "audio/wav");
}, { timeout: 60000 });

test("docx → html succeeds with a valid route", async () => {
  const conversion = await attemptConversion(
    ["word.docx"],
    CommonFormats.DOCX,
    CommonFormats.HTML
  );
  expectSuccessfulRoute(
    conversion,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/html"
  );
}, { timeout: 60000 });

test("png → svg gracefully returns no route when unavailable", async () => {
  const conversion = await attemptConversion(
    ["colors_50x50.png"],
    CommonFormats.PNG,
    CommonFormats.SVG
  );
  expect(conversion).toBeNull();
}, { timeout: 60000 });

test("mp4 → png gracefully returns no route when unavailable", async () => {
  const conversion = await attemptConversion(
    ["doom.mp4"],
    CommonFormats.MP4,
    CommonFormats.PNG
  );
  expect(conversion).toBeNull();
}, { timeout: 60000 });

test("md → docx gracefully returns no route when unavailable", async () => {
  const conversion = await attemptConversion(
    ["markdown.md"],
    CommonFormats.MD,
    CommonFormats.DOCX
  );
  expect(conversion).toBeNull();
}, { timeout: 60000 });

// ==================================================================
//                          END OF TESTS
// ==================================================================


afterAll(async () => {
  await browser.close();
  server.stop();
});
