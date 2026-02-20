import CommonFormats from "src/CommonFormats.ts";
import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";

/**
 * Configuration options for rename handler creation.
 */
interface RenameHandlerOptions {
  /** Handler name for identification */
  name: string;
  /** Supported format definitions */
  formats: FileFormat[];
}

/**
 * Error thrown when rename operations fail.
 */
class RenameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenameError";
  }
}

/**
 * Creates a rename handler that changes file extensions without modifying content.
 * Used for format aliases where the underlying format is the same.
 *
 * @param options - Configuration options for the handler
 * @returns A FormatHandler instance for the rename operation
 */
function createRenameHandler(options: RenameHandlerOptions): FormatHandler {
  const { name, formats } = options;

  return {
    name,
    ready: true,
    supportedFormats: formats,

    async init(): Promise<void> {
      this.ready = true;
    },

    async doConvert(
      inputFiles: FileData[],
      _inputFormat: FileFormat,
      outputFormat: FileFormat
    ): Promise<FileData[]> {
      if (inputFiles.length === 0) {
        throw new RenameError("No input files provided for rename operation");
      }

      return inputFiles.map(file => {
        const baseName = file.name.split(".")[0];
        if (!baseName) {
          throw new RenameError(`Invalid filename: ${file.name}`);
        }

        return {
          bytes: file.bytes,
          name: `${baseName}.${outputFormat.extension}`
        };
      });
    }
  };
}
/**
 * Handler for renaming ZIP-based formats.
 * Supports various ZIP-based containers (Office docs, Android apps, etc.).
 */
export const renameZipHandler = createRenameHandler({
  name: "renamezip",
  formats: [
  CommonFormats.ZIP.builder("zip").allowTo(),
  CommonFormats.DOCX.builder("docx").allowFrom(),
  CommonFormats.XLSX.builder("xlsx").allowFrom(),
  CommonFormats.PPTX.builder("pptx").allowFrom(),
  {
    name: "OpenDocument Text",
    format: "odt",
    extension: "odt",
    mime: "application/vnd.oasis.opendocument.text",
    from: true,
    to: false,
    internal: "odt",
    category: "document"
  },
  {
    name: "OpenDocument Presentation",
    format: "odp",
    extension: "odp",
    mime: "application/vnd.oasis.opendocument.presentation",
    from: true,
    to: false,
    internal: "odp",
    category: "presentation"
  },
  {
    name: "OpenDocument Spreadsheet",
    format: "ods",
    extension: "ods",
    mime: "application/vnd.oasis.opendocument.spreadsheet",
    from: true,
    to: false,
    internal: "ods",
    category: "spreadsheet"
  },
  {
    name: "Firefox Plugin",
    format: "xpi",
    extension: "xpi",
    mime: "application/x-xpinstall",
    from: true,
    to: false,
    internal: "xpi"
  },
  CommonFormats.ZIP.builder("love").allowFrom()
    .withFormat("love").withExt("love").named("LÖVE Game Package"),
  CommonFormats.ZIP.builder("osz").allowFrom()
    .withFormat("osz").withExt("osz").named("osu! Beatmap"),
  CommonFormats.ZIP.builder("osk").allowFrom()
    .withFormat("osk").withExt("osk").named("osu! Skin"),
  {
    name: "Java Archive",
    format: "jar",
    extension: "jar",
    mime: "application/x-java-archive",
    from: true,
    to: false,
    internal: "jar"
  },
  {
    name: "Android Package Archive",
    format: "apk",
    extension: "apk",
    mime: "application/vnd.android.package-archive",
    from: true,
    to: false,
    internal: "apk"
  }
]
});

/**
 * Handler for renaming text-based formats.
 * Supports JSON, XML, YAML as plain text aliases.
 */
export const renameTxtHandler = createRenameHandler({
  name: "renametxt",
  formats: [
    CommonFormats.TEXT.builder("text").allowTo(),
    CommonFormats.JSON.builder("json").allowFrom(),
    CommonFormats.XML.builder("xml").allowFrom(),
    CommonFormats.YML.builder("yaml").allowFrom()
  ]
});
