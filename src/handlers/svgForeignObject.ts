import CommonFormats from "src/CommonFormats.ts";
import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";
import { createLayoutSandbox, sanitizeHtmlToFragment } from "./layoutSanitizer.ts";

const MEDIA_READY_TIMEOUT_MS = 5000;

function waitForMediaReady (media: HTMLImageElement | HTMLVideoElement): Promise<void> {
  if (media instanceof HTMLImageElement && media.complete) {
    return Promise.resolve();
  }
  if (media instanceof HTMLVideoElement && media.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve();
  }

  return new Promise(resolve => {
    let timeoutId = 0;

    const finish = () => {
      media.removeEventListener("load", finish);
      media.removeEventListener("loadeddata", finish);
      media.removeEventListener("error", finish);
      window.clearTimeout(timeoutId);
      resolve();
    };

    media.addEventListener("load", finish);
    media.addEventListener("loadeddata", finish);
    media.addEventListener("error", finish);
    timeoutId = window.setTimeout(finish, MEDIA_READY_TIMEOUT_MS);
  });
}

async function waitForEmbeddedMedia (container: ParentNode): Promise<void> {
  const mediaElements = Array.from(container.querySelectorAll("img, video"));
  await Promise.all(mediaElements.map(media => {
    if (media instanceof HTMLImageElement || media instanceof HTMLVideoElement) {
      return waitForMediaReady(media);
    }
    return Promise.resolve();
  }));
}

async function waitForRenderCycle (): Promise<void> {
  await new Promise<void>(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });
}

class svgForeignObjectHandler implements FormatHandler {

  public name: string = "svgForeignObject";

  public supportedFormats: FileFormat[] = [
    CommonFormats.HTML.supported("html", true, false),
    // Identical to the input HTML, just wrapped in an SVG foreignObject, so it's lossless
    CommonFormats.SVG.supported("svg", false, true, true)
  ];

  public ready: boolean = true;

  async init () {
    this.ready = true;
  }

  static async normalizeHTML (html: string) {
    const sandbox = createLayoutSandbox(":host>div{display:flow-root;}");

    try {
      sandbox.container.replaceChildren(sanitizeHtmlToFragment(html));

      // Wait for all images/videos to finish loading. This is required for layout
      // changes, not because we actually care about media contents.
      await waitForEmbeddedMedia(sandbox.container);

      // Make sure the browser has had time to render.
      await waitForRenderCycle();

      // Finally, get the bounding box of the input and serialize it to XML.
      const bbox = sandbox.container.getBoundingClientRect();
      const serializer = new XMLSerializer();
      const xml = serializer.serializeToString(sandbox.container);
      return { xml, bbox };
    } finally {
      sandbox.cleanup();
    }
  }

  async doConvert (
    inputFiles: FileData[],
    inputFormat: FileFormat,
    outputFormat: FileFormat
  ): Promise<FileData[]> {

    if (inputFormat.internal !== "html") {
      throw new Error(`svgForeignObject handler expected html input, received ${inputFormat.internal}.`);
    }
    if (outputFormat.internal !== "svg") {
      throw new Error(`svgForeignObject handler expected svg output, received ${outputFormat.internal}.`);
    }

    const outputFiles: FileData[] = [];

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    for (const inputFile of inputFiles) {
      const { name, bytes } = inputFile;
      const html = decoder.decode(bytes);
      const { xml, bbox } = await svgForeignObjectHandler.normalizeHTML(html);
      const svg = (
        `<svg width="${bbox.width}" height="${bbox.height}" xmlns="http://www.w3.org/2000/svg">
        <foreignObject x="0" y="0" width="${bbox.width}" height="${bbox.height}">
        ${xml}
        </foreignObject>
        </svg>`);
      const outputBytes = encoder.encode(svg);
      const newName = (name.endsWith(".html") ? name.slice(0, -5) : name) + ".svg";
      outputFiles.push({ name: newName, bytes: outputBytes });
    }

    return outputFiles;

  }

}

export default svgForeignObjectHandler;
