#!/usr/bin/env node
// Generate cache.json by loading the production site and extracting supportedFormatCache
import puppeteer from "puppeteer-core";
import { writeFileSync } from "fs";

const SITE_URL = process.argv[2] || "https://converttoit.com";
const TIMEOUT = 180_000;

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
  args: ["--no-sandbox"],
});

const page = await browser.newPage();

// Track "Built initial format list." console message
let formatListBuilt = false;
page.on("console", (msg) => {
  const text = msg.text();
  if (text.includes("Built initial format list")) formatListBuilt = true;
  if (msg.type() === "warn" || msg.type() === "error")
    process.stderr.write(`[browser] ${text}\n`);
});

console.log(`Loading ${SITE_URL} ...`);
await page.goto(SITE_URL, { waitUntil: "networkidle2", timeout: TIMEOUT });

console.log("Waiting for handlers to initialize...");
// Poll until the console message fires
const start = Date.now();
while (!formatListBuilt && Date.now() - start < TIMEOUT) {
  await new Promise((r) => setTimeout(r, 1000));
}
if (!formatListBuilt) {
  await browser.close();
  console.error("Timed out waiting for format list to build.");
  process.exit(1);
}

// Extra buffer for any trailing lazy handlers
await new Promise((r) => setTimeout(r, 3000));

const cacheData = await page.evaluate(() => window.printSupportedFormatCache());
await browser.close();

const parsed = JSON.parse(cacheData);
console.log(`Captured ${parsed.length} handler caches.`);

writeFileSync("public/cache.json", JSON.stringify(parsed) + "\n");
console.log("Written to public/cache.json");
