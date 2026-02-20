import CommonFormats from "src/CommonFormats.ts";
import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";
import JSZip from "jszip";

/**
 * Error thrown when ZIP creation fails.
 */
class ZipCreationError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "ZipCreationError";
  }
}

/**
 * Handler for creating ZIP archives from any input files.
 * Implements the FormatHandler interface for integration with the conversion pipeline.
 */
class jszipHandler implements FormatHandler {

  public name: string = "jszip";

  public supportedFormats: FileFormat[] = [
    CommonFormats.ZIP.builder("zip").allowTo().markLossless()
  ];

  public supportAnyInput: boolean = true;

  public ready: boolean = false;

  async init(): Promise<void> {
    this.ready = true;
  }

  async doConvert(
    inputFiles: FileData[],
    _inputFormat: FileFormat,
    outputFormat: FileFormat
  ): Promise<FileData[]> {

    if (inputFiles.length === 0) {
      throw new ZipCreationError("No input files provided for ZIP creation");
    }

    const zip = new JSZip();

    for (const file of inputFiles) {
      if (!file.bytes || file.bytes.length === 0) {
        console.warn(`Skipping empty file: ${file.name}`);
        continue;
      }
      zip.file(file.name, file.bytes);
    }

    let output: Uint8Array;
    try {
      output = await zip.generateAsync({ type: "uint8array" });
    } catch (error) {
      throw new ZipCreationError(
        "Failed to generate ZIP archive",
        error instanceof Error ? error.message : error
      );
    }

    if (output.length === 0) {
      throw new ZipCreationError("Generated ZIP archive is empty");
    }

    const outputName = inputFiles.length === 1
      ? `${inputFiles[0].name.split(".")[0]}.${outputFormat.extension}`
      : `archive.${outputFormat.extension}`;

    return [{ bytes: output, name: outputName }];
  }
}

export default jszipHandler;
