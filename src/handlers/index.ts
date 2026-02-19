import type { FormatHandler } from "../FormatHandler.ts";
import { lazyHandler } from "./LazyHandler.ts";
import CommonFormats from "src/CommonFormats.ts";

import canvasToBlobHandler from "./canvasToBlob.ts";
import meydaHandler from "./meyda.ts";
import htmlEmbedHandler from "./htmlEmbed.ts";
import FFmpegHandler from "./FFmpeg.ts";
import pdftoimgHandler from "./pdftoimg.ts";
import ImageMagickHandler from "./ImageMagick.ts";
import svgTraceHandler from "./svgTrace.ts";
import { renameZipHandler, renameTxtHandler } from "./rename.ts";
import envelopeHandler from "./envelope.ts";
import pandocHandler from "./pandoc.ts";
import svgForeignObjectHandler from "./svgForeignObject.ts";
import qoiFuHandler from "./qoi-fu.ts";
import sppdHandler from "./sppd.ts";
import sqlite3Handler from "./sqlite.ts";
import vtfHandler from "./vtf.ts";
import mcMapHandler from "./mcmap.ts";
import jszipHandler from "./jszip.ts";
import qoaFuHandler from "./qoa-fu.ts";
import pyTurtleHandler from "./pyTurtle.ts";
import { fromJsonHandler, toJsonHandler } from "./json.ts";
import nbtHandler from "./nbt.ts";
import floHandler from "./flo.ts";
import cgbiToPngHandler from "./cgbi-to-png.ts";
import batToExeHandler from "./batToExe.ts";
import textEncodingHandler from "./textEncoding.ts";
import libopenmptHandler from "./libopenmpt.ts";
import lzhHandler from "./lzh.ts";

const handlers: FormatHandler[] = [];
try { handlers.push(new svgTraceHandler()) } catch (_) { };
try { handlers.push(new canvasToBlobHandler()) } catch (_) { };
try { handlers.push(new meydaHandler()) } catch (_) { };
try { handlers.push(new htmlEmbedHandler()) } catch (_) { };
try { handlers.push(new FFmpegHandler()) } catch (_) { };
try { handlers.push(new pdftoimgHandler()) } catch (_) { };
try { handlers.push(new ImageMagickHandler()) } catch (_) { };
try { handlers.push(renameZipHandler) } catch (_) { };
try { handlers.push(renameTxtHandler) } catch (_) { };
try { handlers.push(new envelopeHandler()) } catch (_) { };
try { handlers.push(new svgForeignObjectHandler()) } catch (_) { };
try { handlers.push(new qoiFuHandler()) } catch (_) { };
try { handlers.push(new sppdHandler()) } catch (_) { };

// Lazy-loaded: Three.js (~618KB) - only needed for GLB→image conversion
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

try { handlers.push(new sqlite3Handler()) } catch (_) { };
try { handlers.push(new vtfHandler()) } catch (_) { };
try { handlers.push(new mcMapHandler()) } catch (_) { };
try { handlers.push(new jszipHandler()) } catch (_) { };
try { handlers.push(new qoaFuHandler()) } catch (_) { };
try { handlers.push(new pyTurtleHandler()) } catch (_) { };
try { handlers.push(new fromJsonHandler()) } catch (_) { };
try { handlers.push(new toJsonHandler()) } catch (_) { };
try { handlers.push(new nbtHandler()) } catch (_) { };

// Lazy-loaded: pe-library + buffer (~50KB) - only needed for EXE/DLL→ZIP
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

// Lazy-loaded: ts-flp + buffer (~30KB) - only needed for FLP→JSON
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

try { handlers.push(new floHandler()) } catch (_) { };
try { handlers.push(new cgbiToPngHandler()) } catch (_) { };
try { handlers.push(new batToExeHandler()) } catch (_) { };
try { handlers.push(new textEncodingHandler()) } catch (_) { };
try { handlers.push(new libopenmptHandler()) } catch (_) { };
try { handlers.push(new lzhHandler()) } catch (_) { };
try { handlers.push(new pandocHandler()) } catch (_) { };

export default handlers;
