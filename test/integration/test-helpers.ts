/**
 * Integration Test Helpers
 *
 * Common utilities and fixtures for browser-based integration tests.
 */

import puppeteer, { type Browser, type Page } from "puppeteer";
import type { FileData, FileFormat, FormatHandler, ConvertPathNode } from "../../src/FormatHandler.js";

declare global {
  interface Window {
    queryFormatNode: (testFunction: (value: ConvertPathNode) => boolean) => ConvertPathNode | undefined;
    tryConvertByTraversing: (
      files: FileData[],
      from: ConvertPathNode,
      to: ConvertPathNode
    ) => Promise<{ files: FileData[]; path: ConvertPathNode[] } | null>;
    supportedFormatCache: Map<string, FileFormat[]>;
    traversionGraph: {
      searchPath: (
        from: ConvertPathNode,
        to: ConvertPathNode,
        simpleMode: boolean
      ) => AsyncGenerator<ConvertPathNode[]>;
    };
    showPopup: (html: string) => void;
    hidePopup: () => void;
  }
}

export interface TestServer {
  stop: () => void;
  port: number;
}

export interface TestContext {
  browser: Browser;
  page: Page;
  server: TestServer;
}

/**
 * Creates and starts a test server for serving the built application.
 */
export function createTestServer(port: number = 8080): TestServer {
  const server = Bun.serve({
    async fetch(req) {
      let path = new URL(req.url).pathname.replace("/convert/", "") || "index.html";
      if (path.startsWith("/test/")) path = "../test/resources/" + path.slice(6);
      const file = Bun.file(`${__dirname}/../../dist/${path}`);
      if (!(await file.exists())) return new Response("Not Found", { status: 404 });
      return new Response(file);
    },
    port
  });

  return {
    stop: () => server.stop(),
    port
  };
}

/**
 * Initializes a Puppeteer browser and page with test-specific configuration.
 */
export async function createTestContext(serverPort: number = 8080): Promise<TestContext> {
  const server = createTestServer(serverPort);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });

  const page = await browser.newPage();

  // Set viewport to a consistent size for tests
  await page.setViewport({ width: 1280, height: 720 });

  // Configure console logging for debugging
  page.on("console", msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === "error") {
      console.error("[Browser Console]", text);
    } else if (type === "warning") {
      console.warn("[Browser Console]", text);
    } else if (process.env.DEBUG === "true") {
      console.log("[Browser Console]", text);
    }
  });

  // Catch unhandled errors
  page.on("pageerror", error => {
    console.error("[Browser Page Error]", error.message);
  });

  return { browser, page, server };
}

/**
 * Waits for the application to be fully initialized.
 */
export async function waitForAppReady(page: Page, timeout: number = 30000): Promise<void> {
  await Promise.race([
    new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("App did not initialize within timeout"));
      }, timeout);

      page.on("console", msg => {
        if (msg.text() === "Built initial format list.") {
          clearTimeout(timeoutId);
          resolve();
        }
      });
    }),
    page.goto(`http://localhost:8080/convert/index.html`, { waitUntil: "domcontentloaded" })
  ]);
}

/**
 * Cleans up test context by closing browser and stopping server.
 */
export async function cleanupTestContext(context: TestContext): Promise<void> {
  await context.page.close();
  await context.browser.close();
  context.server.stop();
}

/**
 * Loads a test file as a FileData object.
 */
export async function loadTestFile(fileName: string, serverUrl: string = "http://localhost:8080"): Promise<FileData> {
  const response = await fetch(`${serverUrl}/test/${fileName}`);
  if (!response.ok) {
    throw new Error(`Failed to load test file: ${fileName}`);
  }
  const bytes = await response.bytes();
  return { name: fileName, bytes };
}

/**
 * Loads multiple test files.
 */
export async function loadTestFiles(fileNames: string[], serverUrl: string = "http://localhost:8080"): Promise<FileData[]> {
  return Promise.all(fileNames.map(name => loadTestFile(name, serverUrl)));
}

/**
 * Creates a dummy handler for testing.
 */
export function createDummyHandler(name: string = "dummy"): FormatHandler {
  return {
    name,
    ready: true,
    async init() {},
    async doConvert() {
      return [];
    }
  };
}

/**
 * Creates a ConvertPathNode for testing.
 */
export function createConvertPathNode(format: FileFormat, handler?: FormatHandler): ConvertPathNode {
  return {
    handler: handler || createDummyHandler(),
    format
  };
}

/**
 * Attempts a conversion using the browser's conversion API.
 */
export async function attemptConversion(
  page: Page,
  files: string[],
  from: FileFormat,
  to: FileFormat
): Promise<{ files: FileData[]; path: ConvertPathNode[] } | null> {
  const dummyHandler = createDummyHandler();

  return page.evaluate(
    async (testFileNames, from, to) => {
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

/**
 * Simulates a file upload via drag and drop.
 */
export async function uploadFileByDragDrop(
  page: Page,
  fileName: string,
  selector: string = "#file-area"
): Promise<void> {
  const file = await loadTestFile(fileName);

  // Get the file element
  const fileHandle = await page.evaluateHandle(async (fileName, fileBytes) => {
    const arrayBuffer = new Uint8Array(fileBytes).buffer;
    const file = new File([arrayBuffer], fileName, { type: "application/octet-stream" });
    return file;
  }, fileName, Array.from(file.bytes));

  // Create the DataTransfer and drag events
  await page.evaluateHandle((fileHandle) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(fileHandle as File);
    return dataTransfer;
  }, fileHandle);

  // Dispatch drop event
  await page.evaluate((selector) => {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Element not found: ${selector}`);

    const dataTransfer = new DataTransfer();
    const dropEvent = new DragEvent("drop", {
      bubbles: true,
      cancelable: true,
      dataTransfer
    });

    element.dispatchEvent(dropEvent);
  }, selector);
}

/**
 * Simulates a file upload via input element.
 */
export async function uploadFileByInput(
  page: Page,
  fileName: string,
  inputSelector: string = "#file-input"
): Promise<void> {
  const fileInput = await page.$(inputSelector);
  if (!fileInput) {
    throw new Error(`File input not found: ${inputSelector}`);
  }

  const file = await loadTestFile(fileName);

  await fileInput.uploadFile({
    name: fileName,
    mimeType: "application/octet-stream",
    buffer: Buffer.from(file.bytes)
  });
}

/**
 * Clicks a format button in the format list.
 */
export async function selectFormat(
  page: Page,
  mimeType: string,
  listSelector: string = "#from-list"
): Promise<void> {
  await page.evaluate((mimeType, listSelector) => {
    const list = document.querySelector(listSelector);
    if (!list) throw new Error(`Format list not found: ${listSelector}`);

    // Handle both virtual and non-virtual lists
    const virtualList = list.querySelector(".virtual-list-scroll");
    let targetButton: HTMLButtonElement | null = null;

    if (virtualList) {
      // For virtual lists, we need to find and scroll to the button
      const allButtons = Array.from(list.querySelectorAll("button[format-index]"));
      targetButton = allButtons.find(btn =>
        btn.getAttribute("mime-type") === mimeType
      ) || null;

      if (targetButton) {
        targetButton.scrollIntoView({ behavior: "instant", block: "nearest" });
      }
    } else {
      targetButton = Array.from(list.querySelectorAll("button[format-index]")).find(btn =>
        btn.getAttribute("mime-type") === mimeType
      ) || null;
    }

    if (!targetButton) {
      throw new Error(`Format button not found for MIME type: ${mimeType}`);
    }

    targetButton.click();
  }, mimeType, listSelector);
}

/**
 * Gets the current popup message.
 */
export async function getPopupMessage(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const popup = document.querySelector("#popup");
    if (!popup || popup.hasAttribute("hidden")) return null;
    return popup.textContent?.trim() || null;
  });
}

/**
 * Checks if popup is visible.
 */
export async function isPopupVisible(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const popup = document.querySelector("#popup");
    return popup !== null && !popup.hasAttribute("hidden");
  });
}

/**
 * Dismisses the popup.
 */
export async function dismissPopup(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.hidePopup();
  });
}

/**
 * Gets the selected format from a format list.
 */
export async function getSelectedFormat(
  page: Page,
  listSelector: string = "#from-list"
): Promise<{ mime: string; format: string } | null> {
  return page.evaluate((listSelector) => {
    const list = document.querySelector(listSelector);
    if (!list) return null;

    const selectedButton = list.querySelector("button.selected");
    if (!selectedButton) return null;

    const mime = selectedButton.getAttribute("mime-type");
    const formatLabel = selectedButton.querySelector(".format-label-primary")?.textContent;

    return mime ? { mime, format: formatLabel || "" } : null;
  }, listSelector);
}

/**
 * Gets the current file selection state.
 */
export async function getFileSelectionState(page: Page): Promise<{
  fileCount: number;
  fileName: string | null;
}> {
  return page.evaluate(() => {
    const fileArea = document.querySelector("#file-area");
    if (!fileArea) return { fileCount: 0, fileName: null };

    const title = fileArea.querySelector("h2");
    if (!title) return { fileCount: 0, fileName: null };

    const text = title.textContent || "";
    const match = text.match(/^(.+?)(?:\s|\.\.\.|$)/);

    return {
      fileCount: text.includes("more") ? 2 : 1,
      fileName: match ? match[1] : null
    };
  });
}

/**
 * Checks if convert button is enabled.
 */
export async function isConvertButtonEnabled(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const button = document.querySelector("#convert-button");
    if (!button) return false;
    return !button.hasAttribute("disabled") && !button.classList.contains("disabled");
  });
}

/**
 * Gets the convert helper text.
 */
export async function getConvertHelperText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const helper = document.querySelector("#convert-helper");
    return helper?.textContent?.trim() || "";
  });
}

/**
 * Performs a full conversion flow.
 */
export async function performFullConversion(
  page: Page,
  fileName: string,
  fromMimeType: string,
  toMimeType: string
): Promise<{ success: boolean; popupMessage: string | null }> {
  // Upload file
  await uploadFileByInput(page, fileName);

  // Wait for file to be processed
  await page.waitForTimeout(500);

  // Select input format
  await selectFormat(page, fromMimeType, "#from-list");

  // Wait for format selection
  await page.waitForTimeout(100);

  // Select output format
  await selectFormat(page, toMimeType, "#to-list");

  // Wait for format selection
  await page.waitForTimeout(100);

  // Check if convert button is enabled
  const canConvert = await isConvertButtonEnabled(page);

  if (!canConvert) {
    const helperText = await getConvertHelperText(page);
    return { success: false, popupMessage: helperText };
  }

  // Click convert
  await page.click("#convert-button");

  // Wait for conversion to complete or fail
  await page.waitForTimeout(3000);

  // Get popup message
  const popupMessage = await getPopupMessage(page);
  const success = popupMessage?.includes("Converted") || false;

  return { success, popupMessage };
}

/**
 * Test fixture type definitions for common format conversions.
 */
export const TestFixtures = {
  // Image files
  PNG_50X50: "colors_50x50.png",

  // Video files
  MP4_DOOM: "doom.mp4",

  // Audio files
  MP3_GASTER: "gaster.mp3",

  // Document files
  DOCX_WORD: "word.docx",
  MD_MARKDOWN: "markdown.md"
};

/**
 * Assertions helper for common test checks.
 */
export const TestAssertions = {
  /**
   * Asserts that a conversion path is valid.
   */
  assertValidPath(path: ConvertPathNode[], fromMime: string, toMime: string): void {
    if (!path || path.length < 2) {
      throw new Error(`Invalid path: expected at least 2 nodes, got ${path?.length || 0}`);
    }

    const firstMime = path[0].format.mime;
    const lastMime = path[path.length - 1].format.mime;

    if (firstMime !== fromMime) {
      throw new Error(`Path starts with ${firstMime}, expected ${fromMime}`);
    }

    if (lastMime !== toMime) {
      throw new Error(`Path ends with ${lastMime}, expected ${toMime}`);
    }
  },

  /**
   * Asserts that conversion output is valid.
   */
  assertValidConversion(
    result: { files: FileData[]; path: ConvertPathNode[] } | null,
    fromMime: string,
    toMime: string
  ): void {
    if (!result) {
      throw new Error("Conversion returned null");
    }

    if (!result.files || result.files.length === 0) {
      throw new Error("Conversion produced no output files");
    }

    const firstFile = result.files[0];
    if (!firstFile.bytes || firstFile.bytes.length === 0) {
      throw new Error("Output file has no data");
    }

    this.assertValidPath(result.path, fromMime, toMime);
  },

  /**
   * Asserts that format detection is working.
   */
  async assertFormatDetection(page: Page, fileName: string, expectedMime: string): Promise<void> {
    const selectedFormat = await getSelectedFormat(page, "#from-list");
    if (!selectedFormat) {
      throw new Error("No format was auto-selected after file upload");
    }

    if (selectedFormat.mime !== expectedMime) {
      throw new Error(
        `Expected MIME type ${expectedMime}, got ${selectedFormat.mime} for file ${fileName}`
      );
    }
  }
};
