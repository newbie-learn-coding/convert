import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import type { LogEvent } from "@ffmpeg/ffmpeg";

import mime from "mime";
import normalizeMimeType from "../normalizeMimeType.ts";
import { wasmAssetPath, withBasePath } from "../assetPath.ts";

const DEFAULT_FFMPEG_CORE_BASE_URL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
const INIT_FORMAT_TIMEOUT_MS = 15000;

const MIME_HINTS: Record<string, string> = {
  apng: "image/png",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  m4v: "video/mp4",
  oga: "audio/ogg",
  ogv: "video/ogg",
  tga: "image/x-tga",
  mjpeg: "video/x-motion-jpeg"
};

const FALLBACK_SUPPORTED_FORMATS: FileFormat[] = [
  { name: "PNG", format: "png", extension: "png", mime: "image/png", from: true, to: true, internal: "png", category: "image", lossless: true },
  { name: "JPEG", format: "jpeg", extension: "jpg", mime: "image/jpeg", from: true, to: true, internal: "mjpeg", category: "image", lossless: false },
  { name: "GIF", format: "gif", extension: "gif", mime: "image/gif", from: true, to: true, internal: "gif", category: "image", lossless: false },
  { name: "WAV", format: "wav", extension: "wav", mime: "audio/wav", from: true, to: true, internal: "wav", category: "audio", lossless: true },
  { name: "MP3", format: "mp3", extension: "mp3", mime: "audio/mpeg", from: true, to: true, internal: "mp3", category: "audio", lossless: false },
  { name: "MP4", format: "mp4", extension: "mp4", mime: "video/mp4", from: true, to: true, internal: "mp4", category: "video", lossless: false },
  { name: "WebM", format: "webm", extension: "webm", mime: "video/webm", from: true, to: true, internal: "webm", category: "video", lossless: false }
];

function resolveFFmpegAssetUrl(base: string, fileName: string) {
  const normalizedBase = base.trim().replace(/\/+$/, "");
  if (normalizedBase.length === 0) {
    return wasmAssetPath(fileName);
  }

  if (/^https?:\/\//i.test(normalizedBase)) {
    return `${normalizedBase}/${fileName}`;
  }

  const pathWithoutLeadingSlash = normalizedBase.replace(/^\/+/, "");
  return withBasePath(`${pathWithoutLeadingSlash}/${fileName}`);
}

class FFmpegHandler implements FormatHandler {

  public name: string = "FFmpeg";
  public supportedFormats: FileFormat[] = [];
  public ready: boolean = false;

  #ffmpeg?: FFmpeg;
  #onLog = (log: LogEvent) => {
    this.handleStdout(log);
  };

  #stdout: string = "";
  handleStdout (log: LogEvent) {
    this.#stdout += log.message + "\n";
  }
  clearStdout () {
    this.#stdout = "";
  }
  async getStdout (callback: () => void | Promise<void>) {
    if (!this.#ffmpeg) return "";
    this.clearStdout();
    this.#ffmpeg.off("log", this.#onLog);
    this.#ffmpeg.on("log", this.#onLog);
    try {
      await callback();
      return this.#stdout;
    } finally {
      this.#ffmpeg.off("log", this.#onLog);
    }
  }

  async loadFFmpeg () {
    if (!this.#ffmpeg) return;

    const configuredBase = `${import.meta.env.VITE_FFMPEG_CORE_BASE_URL ?? ""}`.trim();
    const baseCandidates = configuredBase.length > 0
      ? [configuredBase]
      : [DEFAULT_FFMPEG_CORE_BASE_URL, "/wasm"];

    let lastError: unknown;
    for (const base of baseCandidates) {
      const coreURL = resolveFFmpegAssetUrl(base, "ffmpeg-core.js");
      const wasmURL = resolveFFmpegAssetUrl(base, "ffmpeg-core.wasm");
      try {
        await this.#ffmpeg.load({
          coreURL,
          wasmURL
        });
        return;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error("Failed to load FFmpeg core assets.");
  }
  terminateFFmpeg () {
    if (!this.#ffmpeg) return;
    this.#ffmpeg.terminate();
  }
  async reloadFFmpeg () {
    if (!this.#ffmpeg) return;
    this.terminateFFmpeg();
    await this.loadFFmpeg();
  }
  /**
   * FFmpeg tends to run out of memory (?) with an "index out of bounds"
   * message sometimes. Other times it just stalls, irrespective of any timeout.
   *
   * This wrapper restarts FFmpeg when it crashes with that OOB error, and
   * forces a Promise-level timeout as a fallback for when it stalls.
   * @param args CLI arguments, same as in `FFmpeg.exec()`.
   * @param timeout Max execution time in milliseconds. `-1` for no timeout (default).
   * @param attempts Amount of times to attempt execution. Default is 1.
   */
  async execSafe (args: string[], timeout: number = -1, attempts: number = 1): Promise<void> {
    if (!this.#ffmpeg) throw new Error("Handler not initialized.");
    try {
      if (timeout === -1) {
        await this.#ffmpeg.exec(args);
      } else {
        let timeoutId: ReturnType<typeof setTimeout>;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error("FFmpeg execution timed out")), timeout);
        });
        try {
          await Promise.race([this.#ffmpeg.exec(args, timeout), timeoutPromise]);
        } finally {
          clearTimeout(timeoutId!);
        }
      }
    } catch (e) {
      if (!e || (
        typeof e === "string"
        && e.includes("out of bounds")
        && attempts > 1
      )) {
        await this.reloadFFmpeg();
        return await this.execSafe(args, timeout, attempts - 1);
      }
      console.error(e);
      throw e;
    }
  }

  async init () {

    this.#ffmpeg = new FFmpeg();
    await this.loadFFmpeg();
    this.supportedFormats = [];

    try {
      const stdout = await this.getStdout(async () => {
        await this.execSafe(["-formats", "-hide_banner"], INIT_FORMAT_TIMEOUT_MS, 2);
      });
      this.supportedFormats = this.parseSupportedFormatsFromList(stdout);
    } catch (error) {
      console.warn("FFmpeg format discovery failed, falling back to baseline format set.", error);
      this.supportedFormats = FALLBACK_SUPPORTED_FORMATS.map(format => ({ ...format }));
    }

    // ====== Manual fine-tuning ======

    const prioritize = ["webm", "mp4", "gif", "wav"];
    prioritize.reverse();

    this.supportedFormats.sort((a, b) => {
      const priorityIndexA = prioritize.indexOf(a.format);
      const priorityIndexB = prioritize.indexOf(b.format);
      return priorityIndexB - priorityIndexA;
    });

    // AV1 doesn't seem to be included in WASM FFmpeg
    this.supportedFormats = this.supportedFormats.filter(c => c.mime !== "image/avif");
    // HEVC stalls when attempted
    this.supportedFormats = this.supportedFormats.filter(c => c.mime !== "video/hevc");

    // Add .qta (QuickTime Audio) support - uses same mov demuxer
    this.supportedFormats.push({
      name: "QuickTime Audio",
      format: "qta",
      extension: "qta",
      mime: "video/quicktime",
      from: true,
      to: true,
      internal: "mov"
    });

    this.#ffmpeg.terminate();

    this.ready = true;
  }

  private parseSupportedFormatsFromList (stdout: string): FileFormat[] {
    const formats: FileFormat[] = [];
    const seenKeys = new Set<string>();
    const formatSection = stdout.split(" --\n")[1] ?? "";
    const lines = formatSection.split("\n");

    for (let line of lines) {
      let len;
      do {
        len = line.length;
        line = line.replaceAll("  ", " ");
      } while (len !== line.length);
      line = line.trim();

      const parts = line.split(" ");
      if (parts.length < 2) continue;

      const flags = parts[0];
      const description = parts.slice(2).join(" ");
      const aliases = parts[1].split(",").map(item => item.trim()).filter(Boolean);

      if (description.startsWith("piped ") || aliases.length === 0) continue;

      const primaryAlias = aliases[0] === "png" ? "apng" : aliases[0];

      for (const alias of aliases) {
        const mimeType = this.resolveMimeType(primaryAlias, alias);
        if (
          !mimeType.startsWith("video/")
          && !mimeType.startsWith("audio/")
          && !mimeType.startsWith("image/")
        ) continue;

        const key = `${alias}:${mimeType}:${flags}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        formats.push({
          name: description + (aliases.length > 1 ? ` / ${alias}` : ""),
          format: alias,
          extension: this.resolveExtension(primaryAlias, alias, mimeType),
          mime: mimeType,
          from: flags.includes("D"),
          to: flags.includes("E"),
          internal: alias,
          category: mimeType.split("/")[0],
          lossless: ["png", "bmp", "tiff"].includes(alias)
        });
      }
    }

    return formats;
  }

  private resolveExtension (primaryAlias: string, alias: string, mimeType: string): string {
    const explicit = mime.getExtension(mimeType);
    if (explicit) return explicit;
    if (primaryAlias === "mjpeg" || alias === "jpeg") return "jpg";
    return alias;
  }

  private resolveMimeType (primaryAlias: string, alias: string): string {
    const hinted = MIME_HINTS[alias] ?? MIME_HINTS[primaryAlias];
    const fallback = hinted ?? mime.getType(alias) ?? mime.getType(primaryAlias) ?? `video/${primaryAlias}`;
    return normalizeMimeType(fallback);
  }

  async doConvert (
    inputFiles: FileData[],
    inputFormat: FileFormat,
    outputFormat: FileFormat,
    args?: string[]
  ): Promise<FileData[]> {

    if (!this.#ffmpeg) {
      throw new Error("Handler not initialized.");
    }

    await this.reloadFFmpeg();

    let forceFPS = 0;
    if (inputFormat.mime === "image/png" || inputFormat.mime === "image/jpeg") {
      forceFPS = inputFiles.length < 30 ? 1 : 30;
    }

    let fileIndex = 0;
    let listString = "";
    for (const file of inputFiles) {
      const entryName = `file_${fileIndex++}.${inputFormat.extension}`;
      await this.#ffmpeg.writeFile(entryName, new Uint8Array(file.bytes));
      listString += `file '${entryName}'\n`;
      if (forceFPS) listString += `duration ${1 / forceFPS}\n`;
    }
    await this.#ffmpeg.writeFile("list.txt", new TextEncoder().encode(listString));

    const command = ["-hide_banner", "-f", "concat", "-safe", "0", "-i", "list.txt", "-f", outputFormat.internal];
    if (outputFormat.mime === "video/mp4") {
      command.push("-pix_fmt", "yuv420p");
    }
    if (args) command.push(...args);
    command.push("output");

    const stdout = await this.getStdout(async () => {
      await this.#ffmpeg!.exec(command);
    });

    for (let i = 0; i < fileIndex; i ++) {
      const entryName = `file_${i}.${inputFormat.extension}`;
      await this.#ffmpeg.deleteFile(entryName);
    }

    if (stdout.includes("Conversion failed!\n")) {

      const oldArgs = args ? args : []
      if (stdout.includes(" not divisible by") && !oldArgs.includes("-vf")) {
        const division = stdout.split(" not divisible by ")[1].split(" ")[0];
        return this.doConvert(inputFiles, inputFormat, outputFormat, [...oldArgs, "-vf", `pad=ceil(iw/${division})*${division}:ceil(ih/${division})*${division}`]);
      }
      if (stdout.includes("width and height must be a multiple of") && !oldArgs.includes("-vf")) {
        const division = stdout.split("width and height must be a multiple of ")[1].split(" ")[0].split("")[0];
        return this.doConvert(inputFiles, inputFormat, outputFormat, [...oldArgs, "-vf", `pad=ceil(iw/${division})*${division}:ceil(ih/${division})*${division}`]);
      }
      if (stdout.includes("Valid sizes are") && !oldArgs.includes("-s")) {
        const newSize = stdout.split("Valid sizes are ")[1].split(".")[0].split(" ").pop();
        if (typeof newSize !== "string") throw new Error(`FFmpeg conversion failed: ${stdout}`);
        return this.doConvert(inputFiles, inputFormat, outputFormat, [...oldArgs, "-s", newSize]);
      }

      throw new Error(`FFmpeg conversion failed: ${stdout}`);
    }

    let bytes: Uint8Array;

    // Validate that output file exists before attempting to read
    let fileData;
    try {
      fileData = await this.#ffmpeg.readFile("output");
    } catch (e) {
      throw new Error(`Output file not created: ${e}`);
    }

    if (!fileData || (fileData instanceof Uint8Array && fileData.length === 0)) {
      throw new Error("FFmpeg failed to produce output file");
    }
    if (!(fileData instanceof Uint8Array)) {
      const encoder = new TextEncoder();
      bytes = encoder.encode(fileData);
    } else {
      bytes = new Uint8Array(fileData?.buffer);
    }

    await this.#ffmpeg.deleteFile("output");
    await this.#ffmpeg.deleteFile("list.txt");

    const baseName = inputFiles[0].name.split(".")[0];
    const name = baseName + "." + outputFormat.extension;

    return [{ bytes, name }];

  }

}

export default FFmpegHandler;
