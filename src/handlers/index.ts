import type { FormatHandler } from "../FormatHandler.ts";
import { lazyHandler } from "./LazyHandler.ts";
import CommonFormats from "src/CommonFormats.ts";

// Eager-loaded imports (lightweight handlers)
import canvasToBlobHandler from "./canvasToBlob.ts";
import htmlEmbedHandler from "./htmlEmbed.ts";
import svgTraceHandler from "./svgTrace.ts";
import { renameZipHandler, renameTxtHandler } from "./rename.ts";
import svgForeignObjectHandler from "./svgForeignObject.ts";
import qoiFuHandler from "./qoi-fu.ts";
import vtfHandler from "./vtf.ts";
import mcMapHandler from "./mcmap.ts";
import jszipHandler from "./jszip.ts";
import qoaFuHandler from "./qoa-fu.ts";
import pyTurtleHandler from "./pyTurtle.ts";
import { fromJsonHandler, toJsonHandler } from "./json.ts";
import nbtHandler from "./nbt.ts";
import cgbiToPngHandler from "./cgbi-to-png.ts";
import batToExeHandler from "./batToExe.ts";
import textEncodingHandler from "./textEncoding.ts";

const handlers: FormatHandler[] = [];

// ============================================================================
// EAGER-LOADED HANDLERS (lightweight, essential for initial load)
// These load immediately as they have small footprint and common use cases.
// ============================================================================

try { handlers.push(new svgTraceHandler()) } catch (_) { };
try { handlers.push(new canvasToBlobHandler()) } catch (_) { };
try { handlers.push(new htmlEmbedHandler()) } catch (_) { };
try { handlers.push(renameZipHandler) } catch (_) { };
try { handlers.push(renameTxtHandler) } catch (_) { };
try { handlers.push(new svgForeignObjectHandler()) } catch (_) { };
try { handlers.push(new qoiFuHandler()) } catch (_) { };
try { handlers.push(new vtfHandler()) } catch (_) { };
try { handlers.push(new mcMapHandler()) } catch (_) { };
try { handlers.push(new jszipHandler()) } catch (_) { };
try { handlers.push(new qoaFuHandler()) } catch (_) { };
try { handlers.push(new pyTurtleHandler()) } catch (_) { };
try { handlers.push(new fromJsonHandler()) } catch (_) { };
try { handlers.push(new toJsonHandler()) } catch (_) { };
try { handlers.push(new nbtHandler()) } catch (_) { };
try { handlers.push(new cgbiToPngHandler()) } catch (_) { };
try { handlers.push(new batToExeHandler()) } catch (_) { };
try { handlers.push(new textEncodingHandler()) } catch (_) { };

// ============================================================================
// LAZY-LOADED HANDLERS (loaded on-demand when conversion is needed)
// These handlers have large WASM dependencies or are rarely used.
// Each provides minimal format metadata upfront, then loads the full
// implementation only when the user performs a conversion.
// ============================================================================

// Lazy-loaded: FFmpeg (~vendor chunk) - video/audio conversion
// Loads @ffmpeg/ffmpeg and @ffmpeg/util dynamically
try {
  handlers.push(lazyHandler(
    {
      name: "FFmpeg",
      supportedFormats: [
        { name: "MP4", format: "mp4", extension: "mp4", mime: "video/mp4", from: true, to: true, internal: "mp4", category: "video" },
        { name: "WebM", format: "webm", extension: "webm", mime: "video/webm", from: true, to: true, internal: "webm", category: "video" },
        { name: "GIF", format: "gif", extension: "gif", mime: "image/gif", from: true, to: true, internal: "gif", category: "image" },
        { name: "WAV", format: "wav", extension: "wav", mime: "audio/wav", from: true, to: true, internal: "wav", category: "audio" },
        { name: "MP3", format: "mp3", extension: "mp3", mime: "audio/mpeg", from: true, to: true, internal: "mp3", category: "audio" },
        { name: "OGG", format: "ogg", extension: "ogg", mime: "audio/ogg", from: true, to: true, internal: "ogg", category: "audio" },
        { name: "MOV", format: "mov", extension: "mov", mime: "video/quicktime", from: true, to: true, internal: "mov", category: "video" },
        { name: "AVI", format: "avi", extension: "avi", mime: "video/x-msvideo", from: true, to: true, internal: "avi", category: "video" },
        { name: "FLAC", format: "flac", extension: "flac", mime: "audio/flac", from: true, to: true, internal: "flac", category: "audio" },
      ]
    },
    () => import("./FFmpeg.ts")
  ));
} catch (_) { };

// Lazy-loaded: ImageMagick (~207KB media chunk + magick.wasm)
// Advanced image conversion with support for 100+ formats
try {
  handlers.push(lazyHandler(
    {
      name: "ImageMagick",
      supportedFormats: [
        CommonFormats.PNG.builder("png").allowFrom().allowTo(),
        CommonFormats.JPEG.builder("jpeg").allowFrom().allowTo(),
        CommonFormats.GIF.builder("gif").allowFrom().allowTo(),
        CommonFormats.WEBP.builder("webp").allowFrom().allowTo(),
        CommonFormats.PDF.builder("pdf").allowFrom().allowTo(),
      ]
    },
    () => import("./ImageMagick.ts")
  ));
} catch (_) { };

// Lazy-loaded: PDF to Image (~363KB pdf chunk with pdftoimg-js)
try {
  handlers.push(lazyHandler(
    {
      name: "pdftoimg",
      supportedFormats: [
        CommonFormats.PDF.builder("pdf").allowFrom(),
        CommonFormats.PNG.supported("png", false, true),
        CommonFormats.JPEG.supported("jpeg", false, true),
      ]
    },
    () => import("./pdftoimg.ts")
  ));
} catch (_) { };

// Lazy-loaded: Pandoc (~25KB + WASM) - document conversion
// Supports Markdown, HTML, DOCX, ODT, EPUB, etc.
try {
  handlers.push(lazyHandler(
    {
      name: "pandoc",
      supportedFormats: [
        CommonFormats.MD.builder("markdown").allowFrom().allowTo(),
        CommonFormats.HTML.builder("html").allowFrom().allowTo(),
        { name: "Word", format: "docx", extension: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", from: true, to: true, internal: "docx", category: "document" },
        { name: "OpenDocument Text", format: "odt", extension: "odt", mime: "application/vnd.oasis.opendocument.text", from: true, to: true, internal: "odt", category: "document" },
        { name: "EPUB", format: "epub", extension: "epub", mime: "application/epub+zip", from: true, to: true, internal: "epub", category: "document" },
        { name: "LaTeX", format: "latex", extension: "tex", mime: "application/x-latex", from: true, to: true, internal: "latex", category: "document" },
        { name: "Rich Text Format", format: "rtf", extension: "rtf", mime: "application/rtf", from: true, to: true, internal: "rtf", category: "document" },
      ]
    },
    () => import("./pandoc.ts")
  ));
} catch (_) { };

// Lazy-loaded: Three.js + GLTFLoader (~46KB chunk) - GLB->image conversion
try {
  handlers.push(lazyHandler(
    {
      name: "threejs",
      supportedFormats: [
        {
          name: "GL Transmission Format Binary",
          format: "glb",
          extension: "glb",
          mime: "model/gltf-binary",
          from: true,
          to: false,
          internal: "glb",
          category: "model"
        },
        CommonFormats.PNG.supported("png", false, true),
        CommonFormats.JPEG.supported("jpeg", false, true),
        CommonFormats.WEBP.supported("webp", false, true)
      ]
    },
    () => import("./threejs.ts")
  ));
} catch (_) { };

// Lazy-loaded: Portal 2 Demo (~618KB 3d chunk with Three.js + CSG) - rare format
try {
  handlers.push(lazyHandler(
    {
      name: "sppd",
      supportedFormats: [
        {
          name: "Portal 2 Demo File",
          format: "dem",
          extension: "dem",
          mime: "application/x-portal2-demo",
          from: true,
          to: false,
          internal: "dem"
        },
        CommonFormats.PNG.supported("png", false, true),
        CommonFormats.JPEG.supported("jpeg", false, true),
        CommonFormats.JSON.supported("json", false, true, true)
      ]
    },
    () => import("./sppd.ts")
  ));
} catch (_) { };

// Lazy-loaded: SQLite3 (~859KB WASM) - database conversion
try {
  handlers.push(lazyHandler(
    {
      name: "sqlite3",
      supportedFormats: [
        {
          name: "SQLite3",
          format: "sqlite3",
          extension: "db",
          mime: "application/vnd.sqlite3",
          from: true,
          to: false,
          internal: "sqlite3",
          category: "database"
        },
        CommonFormats.CSV.builder("csv").allowTo()
      ]
    },
    () => import("./sqlite.ts")
  ));
} catch (_) { };

// Lazy-loaded: Meyda + WaveFile (~niche chunk) - audio<->image spectrogram
try {
  handlers.push(lazyHandler(
    {
      name: "meyda",
      supportedFormats: [
        CommonFormats.PNG.supported("image", true, true),
        CommonFormats.JPEG.supported("image", true, true),
        CommonFormats.WEBP.supported("image", true, true),
        CommonFormats.WAV.builder("audio").allowFrom().allowTo(),
        CommonFormats.MP3.builder("audio").allowFrom(),
        CommonFormats.OGG.builder("audio").allowFrom(),
        CommonFormats.FLAC.builder("audio").allowFrom(),
      ]
    },
    () => import("./meyda.ts")
  ));
} catch (_) { };

// Lazy-loaded: Office documents (envelope parser) - doc/xlsx/pptx -> HTML
try {
  handlers.push(lazyHandler(
    {
      name: "envelope",
      supportedFormats: [
        CommonFormats.DOCX.builder("docx").allowFrom(),
        CommonFormats.PPTX.builder("pptx").allowFrom(),
        CommonFormats.XLSX.builder("xlsx").allowFrom(),
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
        CommonFormats.HTML.supported("html", false, true, true)
      ]
    },
    () => import("./envelope.ts")
  ));
} catch (_) { };

// Lazy-loaded: libopenmpt (~WASM) - tracker music formats
try {
  handlers.push(lazyHandler(
    {
      name: "libopenmpt",
      supportedFormats: [
        { name: "Amiga MOD", format: "mod", extension: "mod", mime: "audio/x-mod", from: true, to: false, internal: "mod", category: "audio" },
        { name: "Scream Tracker 3", format: "s3m", extension: "s3m", mime: "audio/x-s3m", from: true, to: false, internal: "s3m", category: "audio" },
        { name: "FastTracker 2", format: "xm", extension: "xm", mime: "audio/x-xm", from: true, to: false, internal: "xm", category: "audio" },
        { name: "Impulse Tracker", format: "it", extension: "it", mime: "audio/x-it", from: true, to: false, internal: "it", category: "audio" },
        { name: "UNIS 669", format: "669", extension: "669", mime: "audio/x-669", from: true, to: false, internal: "669", category: "audio" },
        { name: "MO3 Module", format: "mo3", extension: "mo3", mime: "audio/x-mo3", from: true, to: false, internal: "mo3", category: "audio" },
        { name: "Ultra Tracker", format: "ult", extension: "ult", mime: "audio/x-ult", from: true, to: false, internal: "ult", category: "audio" },
        CommonFormats.WAV.supported("wav", false, true),
      ]
    },
    () => import("./libopenmpt.ts")
  ));
} catch (_) { };

// Lazy-loaded: LZH/LHA archives
try {
  handlers.push(lazyHandler(
    {
      name: "lzh",
      supportedFormats: [
        {
          name: "LZH/LHA Archive",
          format: "lzh",
          extension: "lzh",
          mime: "application/x-lzh-compressed",
          from: true,
          to: true,
          internal: "lzh",
          category: "archive",
          lossless: true
        },
      ]
    },
    () => import("./lzh.ts")
  ));
} catch (_) { };

// Lazy-loaded: pe-library + buffer (~50KB) - EXE/DLL->ZIP
try {
  handlers.push(lazyHandler(
    {
      name: "petozip",
      supportedFormats: [
        {
          name: "Windows Executable",
          format: "exe",
          extension: "exe",
          mime: "application/vnd.microsoft.portable-executable",
          from: true,
          to: false,
          internal: "exe"
        },
        {
          name: "Dynamic-Link Library",
          format: "dll",
          extension: "dll",
          mime: "application/vnd.microsoft.portable-executable",
          from: true,
          to: false,
          internal: "dll"
        },
        CommonFormats.ZIP.builder("zip").allowTo().markLossless()
      ]
    },
    () => import("./petozip.ts")
  ));
} catch (_) { };

// Lazy-loaded: ts-flp + buffer (~30KB) - FLP->JSON
try {
  handlers.push(lazyHandler(
    {
      name: "flptojson",
      supportedFormats: [
        {
          name: "FL Studio Project File",
          format: "flp",
          extension: "flp",
          mime: "application/octet-stream",
          from: true,
          to: false,
          internal: "flp",
          category: "audio",
        },
        CommonFormats.JSON.supported("json", false, true)
      ]
    },
    () => import("./flptojson.ts")
  ));
} catch (_) { };

// Lazy-loaded: FLO audio format (~2.3MB WASM) - rare audio format
try {
  handlers.push(lazyHandler(
    {
      name: "flo",
      supportedFormats: [
        {
          name: "FLO Audio",
          format: "flo",
          extension: "flo",
          mime: "audio/x-flo",
          from: true,
          to: false,
          internal: "flo",
          category: "audio"
        },
        CommonFormats.WAV.supported("wav", false, true),
      ]
    },
    () => import("./flo.ts")
  ));
} catch (_) { };

export default handlers;
