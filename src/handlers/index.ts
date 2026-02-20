import type { FormatHandler } from "../FormatHandler.ts";
import CommonFormats from "src/CommonFormats.ts";
import { lazyHandler } from "./LazyHandler.ts";

import canvasToBlobHandler from "./canvasToBlob.ts";
import meydaHandler from "./meyda.ts";
import htmlEmbedHandler from "./htmlEmbed.ts";
import pdftoimgHandler from "./pdftoimg.ts";
import svgTraceHandler from "./svgTrace.ts";
import { renameZipHandler, renameTxtHandler } from "./rename.ts";
import envelopeHandler from "./envelope.ts";
import svgForeignObjectHandler from "./svgForeignObject.ts";
import qoiFuHandler from "./qoi-fu.ts";
import vtfHandler from "./vtf.ts";
import mcMapHandler from "./mcmap.ts";
import jszipHandler from "./jszip.ts";
import alsHandler from "./als.ts";
import qoaFuHandler from "./qoa-fu.ts";
import pyTurtleHandler from "./pyTurtle.ts";
import { fromJsonHandler, toJsonHandler } from "./json.ts";
import nbtHandler from "./nbt.ts";
import cgbiToPngHandler from "./cgbi-to-png.ts";
import batToExeHandler from "./batToExe.ts";
import textEncodingHandler from "./textEncoding.ts";
import sb3ToHtmlHandler from "./sb3tohtml.ts";
import lzhHandler from "./lzh.ts";
import espeakngHandler from "./espeakng"
import textToShellHandler from "./texttoshell.ts";
import batchHandler from "./batch.ts";

const handlers: FormatHandler[] = [];
const HEAVY_LAZY_CONFIG = { timeout: 30000, maxRetries: 0 };

try { handlers.push(new svgTraceHandler()) } catch (_) { };
try { handlers.push(new canvasToBlobHandler()) } catch (_) { };
try { handlers.push(new meydaHandler()) } catch (_) { };
try { handlers.push(new htmlEmbedHandler()) } catch (_) { };
try {
  handlers.push(lazyHandler(
    {
      name: "FFmpeg",
      supportedFormats: []
    },
    () => import("./FFmpeg.ts"),
    HEAVY_LAZY_CONFIG
  ))
} catch (_) { };
try { handlers.push(new pdftoimgHandler()) } catch (_) { };
try {
  handlers.push(lazyHandler(
    {
      name: "ImageMagick",
      supportedFormats: []
    },
    () => import("./ImageMagick.ts"),
    HEAVY_LAZY_CONFIG
  ))
} catch (_) { };
try { handlers.push(renameZipHandler) } catch (_) { };
try { handlers.push(renameTxtHandler) } catch (_) { };
try { handlers.push(new envelopeHandler()) } catch (_) { };
try { handlers.push(new svgForeignObjectHandler()) } catch (_) { };
try { handlers.push(new qoiFuHandler()) } catch (_) { };
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
  ))
} catch (_) { };
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
  ))
} catch (_) { };
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
  ))
} catch (_) { };
try { handlers.push(new vtfHandler()) } catch (_) { };
try { handlers.push(new mcMapHandler()) } catch (_) { };
try { handlers.push(new jszipHandler()) } catch (_) { };
try { handlers.push(new alsHandler()) } catch (_) { };
try { handlers.push(new qoaFuHandler()) } catch (_) { };
try { handlers.push(new pyTurtleHandler()) } catch (_) { };
try { handlers.push(new fromJsonHandler()) } catch (_) { };
try { handlers.push(new toJsonHandler()) } catch (_) { };
try { handlers.push(new nbtHandler()) } catch (_) { };
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
  ))
} catch (_) { };
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
          category: "audio"
        },
        CommonFormats.JSON.supported("json", false, true)
      ]
    },
    () => import("./flptojson.ts")
  ))
} catch (_) { };
try {
  handlers.push(lazyHandler(
    {
      name: "floHandler",
      supportedFormats: [
        {
          name: "Flo Audio",
          format: "flo",
          extension: "flo",
          mime: "audio/flo",
          from: true,
          to: true,
          internal: "flo",
          category: "audio",
          lossless: false
        },
        {
          name: "WAV (signed 16-bit)",
          format: "wav",
          extension: "wav",
          mime: "audio/wav",
          from: true,
          to: true,
          internal: "wav",
          category: "audio",
          lossless: true
        },
        {
          name: "Raw PCM Float32LE",
          format: "f32le",
          extension: "pcm",
          mime: "video/f32le",
          from: true,
          to: true,
          internal: "f32le",
          category: "audio",
          lossless: true
        }
      ]
    },
    () => import("./flo.ts"),
    HEAVY_LAZY_CONFIG
  ))
} catch (_) { };
try { handlers.push(new cgbiToPngHandler()) } catch (_) { };
try { handlers.push(new batToExeHandler()) } catch (_) { };
try { handlers.push(new sb3ToHtmlHandler()) } catch (_) { };
try { handlers.push(new textEncodingHandler()) } catch (_) { };
try {
  handlers.push(lazyHandler(
    {
      name: "libopenmpt",
      supportedFormats: []
    },
    () => import("./libopenmpt.ts"),
    HEAVY_LAZY_CONFIG
  ))
} catch (_) { };
try { handlers.push(new lzhHandler()) } catch (_) { };
try {
  handlers.push(lazyHandler(
    {
      name: "pandoc",
      supportedFormats: []
    },
    () => import("./pandoc.ts"),
    HEAVY_LAZY_CONFIG
  ))
} catch (_) { };
try { handlers.push(new espeakngHandler()) } catch (_) { };
try { handlers.push(new textToShellHandler()) } catch (_) { };
try { handlers.push(new batchHandler()) } catch (_) { };
try {
  handlers.push(lazyHandler(
    {
      name: "bsor",
      supportedFormats: [
        {
          name: "Beat Saber Open Replay",
          format: "bsor",
          extension: "bsor",
          mime: "application/x-bsor",
          from: true,
          to: false,
          internal: "bsor"
        },
        CommonFormats.PNG.supported("png", false, true),
        CommonFormats.JPEG.supported("jpeg", false, true),
        CommonFormats.JSON.supported("json", false, true, true)
      ]
    },
    () => import("./bsor.ts")
  ))
} catch (_) { };

export default handlers;
