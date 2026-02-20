import { FormatDefinition } from "src/FormatHandler"

/**
 * File format categories for organizing and grouping formats.
 */
export const Category = {
    DATA: "data",
    IMAGE: "image",
    VIDEO: "video",
    VECTOR: "vector",
    DOCUMENT: "document",
    TEXT: "text",
    AUDIO: "audio",
    ARCHIVE: "archive",
    SPREADSHEET: "spreadsheet",
    PRESENTATION: "presentation"
}

/**
 * Type representing valid category values.
 */
export type CategoryType = typeof Category[keyof typeof Category];

/**
 * Common format definitions for reducing boilerplate in handler definitions.
 * These format definitions provide standard metadata for widely-used formats.
 *
 * Usage:
 * ```typescript
 * CommonFormats.PNG.builder("png").allowFrom().allowTo()
 * // or
 * CommonFormats.PNG.supported("png", true, true, true)
 * ```
 */
const CommonFormats = {
    // images
    PNG: new FormatDefinition(
        "Portable Network Graphics",
        "png",
        "png",
        "image/png",
        Category.IMAGE
    ),
    JPEG: new FormatDefinition(
        "Joint Photographic Experts Group JFIF",
        "jpeg",
        "jpg",
        "image/jpeg",
        Category.IMAGE
    ),
    WEBP: new FormatDefinition(
        "WebP",
        "webp",
        "webp",
        "image/webp",
        Category.IMAGE
    ),
    GIF: new FormatDefinition(
        "CompuServe Graphics Interchange Format (GIF)",
        "gif",
        "gif",
        "image/gif",
        [Category.IMAGE, Category.VIDEO]
    ),
    SVG: new FormatDefinition(
        "Scalable Vector Graphics",
        "svg",
        "svg",
        "image/svg+xml",
        [Category.IMAGE, Category.VECTOR, Category.DOCUMENT]
    ),
    // texts
    JSON: new FormatDefinition(
        "JavaScript Object Notation",
        "json",
        "json",
        "application/json",
        Category.DATA
    ),
    XML: new FormatDefinition(
        "Extensible Markup Language",
        "xml",
        "xml",
        "application/xml",
        Category.DATA
    ),
    YML: new FormatDefinition(
        "YAML Ain't Markup Language",
        "yaml",
        "yml",
        "application/yaml",
        Category.DATA
    ),
    CSV: new FormatDefinition(
        "Comma Seperated Values",
        "csv",
        "csv",
        "text/csv",
        Category.DATA
    ),
    TEXT: new FormatDefinition(
        "Plain Text",
        "text",
        "txt",
        "text/plain",
        Category.TEXT
    ),
    HTML: new FormatDefinition(
        "Hypertext Markup Language",
        "html",
        "html",
        "text/html",
        [Category.DOCUMENT, Category.TEXT]
    ),
    MD: new FormatDefinition(
        "Markdown Document",
        "md",
        "md",
        "text/markdown",
        ["document", "text"]
    ),
    BATCH: new FormatDefinition(
        "Windows Batch file",
        "batch",
        "bat",
        "text/windows-batch",
        ["text"]
    ),
    // audio
    MP3: new FormatDefinition(
        "MP3 Audio",
        "mp3",
        "mp3",
        "audio/mpeg",
        Category.AUDIO
    ),
    WAV: new FormatDefinition(
        "Waveform Audio File Format",
        "wav",
        "wav",
        "audio/wav",
        Category.AUDIO
    ),
    OGG: new FormatDefinition(
        "Ogg Audio",
        "ogg",
        "ogg",
        "audio/ogg",
        Category.AUDIO
    ),
    FLAC: new FormatDefinition(
        "Free Lossless Audio Codec",
        "flac",
        "flac",
        "audio/flac",
        Category.AUDIO
    ),
    // video
    MP4: new FormatDefinition(
        "MPEG-4 Part 14",
        "mp4",
        "mp4",
        "video/mp4",
        Category.VIDEO
    ),
    // archive
    ZIP: new FormatDefinition(
        "ZIP Archive",
        "zip",
        "zip",
        "application/zip",
        Category.ARCHIVE
    ),
    // documents
    PDF: new FormatDefinition(
        "Portable Document Format",
        "pdf",
        "pdf",
        "application/pdf",
        Category.DOCUMENT
    ),
    // documents - Microsoft Office
    DOCX: new FormatDefinition(
        "Microsoft Office 365 Word Document",
        "docx",
        "docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        Category.DOCUMENT
    ),
    XLSX: new FormatDefinition(
        "Microsoft Office 365 Workbook",
        "xlsx",
        "xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        [Category.SPREADSHEET, Category.DOCUMENT]
    ),
    PPTX: new FormatDefinition(
        "Microsoft Office 365 Presentation",
        "pptx",
        "pptx",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        Category.PRESENTATION
    )
}

/**
 * Type representing the CommonFormats object structure.
 */
export type CommonFormatsType = typeof CommonFormats;

export default CommonFormats