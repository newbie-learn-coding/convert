/**
 * File Signature Validator
 * Detects actual file content by checking magic numbers (file signatures)
 * to prevent MIME type spoofing attacks.
 */

/** Result of file validation */
export interface ValidationResult {
  valid: boolean;
  detectedFormat: FileFormatInfo | null;
  error: string | null;
}

/** Information about a detected file format */
export interface FileFormatInfo {
  name: string;
  extension: string;
  mime: string;
  category: string;
}

/** Magic number signature definition */
interface MagicSignature {
  name: string;
  extension: string;
  mime: string;
  category: string;
  offset: number;
  signature: number[];
  mask?: number[];
  alternativeSignatures?: MagicSignature[];
}

// ============================================================================
// MAGIC NUMBER SIGNATURES
// ============================================================================

const PNG_SIGNATURE: MagicSignature = {
  name: "PNG",
  extension: "png",
  mime: "image/png",
  category: "image",
  offset: 0,
  signature: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
};

const JPEG_SIGNATURE: MagicSignature = {
  name: "JPEG",
  extension: "jpg",
  mime: "image/jpeg",
  category: "image",
  offset: 0,
  signature: [0xFF, 0xD8, 0xFF]
};

const GIF87a_SIGNATURE: MagicSignature = {
  name: "GIF",
  extension: "gif",
  mime: "image/gif",
  category: "image",
  offset: 0,
  signature: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]
};

const GIF89a_SIGNATURE: MagicSignature = {
  name: "GIF",
  extension: "gif",
  mime: "image/gif",
  category: "image",
  offset: 0,
  signature: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]
};

const WEBP_SIGNATURE: MagicSignature = {
  name: "WebP",
  extension: "webp",
  mime: "image/webp",
  category: "image",
  offset: 0,
  signature: [0x52, 0x49, 0x46, 0x46] // "RIFF"
};

const BMP_SIGNATURE: MagicSignature = {
  name: "BMP",
  extension: "bmp",
  mime: "image/bmp",
  category: "image",
  offset: 0,
  signature: [0x42, 0x4D] // "BM"
};

const TIFF_LE_SIGNATURE: MagicSignature = {
  name: "TIFF",
  extension: "tiff",
  mime: "image/tiff",
  category: "image",
  offset: 0,
  signature: [0x49, 0x49, 0x2A, 0x00] // "II" + 42 little-endian
};

const TIFF_BE_SIGNATURE: MagicSignature = {
  name: "TIFF",
  extension: "tiff",
  mime: "image/tiff",
  category: "image",
  offset: 0,
  signature: [0x4D, 0x4D, 0x00, 0x2A] // "MM" + 42 big-endian
};

const PDF_SIGNATURE: MagicSignature = {
  name: "PDF",
  extension: "pdf",
  mime: "application/pdf",
  category: "document",
  offset: 0,
  signature: [0x25, 0x50, 0x44, 0x46] // "%PDF"
};

const DOCX_SIGNATURE: MagicSignature = {
  name: "DOCX",
  extension: "docx",
  mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  category: "document",
  offset: 0,
  signature: [0x50, 0x4B, 0x03, 0x04] // ZIP archive (DOCX is a ZIP)
};

const XLSX_SIGNATURE: MagicSignature = {
  name: "XLSX",
  extension: "xlsx",
  mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  category: "document",
  offset: 0,
  signature: [0x50, 0x4B, 0x03, 0x04] // ZIP archive (XLSX is a ZIP)
};

const MP4_SIGNATURE: MagicSignature = {
  name: "MP4",
  extension: "mp4",
  mime: "video/mp4",
  category: "video",
  offset: 4,
  signature: [0x66, 0x74, 0x79, 0x70] // "ftyp"
};

const WEBM_SIGNATURE: MagicSignature = {
  name: "WebM",
  extension: "webm",
  mime: "video/webm",
  category: "video",
  offset: 0,
  signature: [0x1A, 0x45, 0xDF, 0xA3] // EBML header
};

const AVI_RIFF_SIGNATURE: MagicSignature = {
  name: "AVI",
  extension: "avi",
  mime: "video/x-msvideo",
  category: "video",
  offset: 0,
  signature: [0x52, 0x49, 0x46, 0x46], // "RIFF"
  alternativeSignatures: [
    {
      name: "AVI",
      extension: "avi",
      mime: "video/x-msvideo",
      category: "video",
      offset: 8,
      signature: [0x41, 0x56, 0x49, 0x20] // "AVI "
    }
  ]
};

const MOV_SIGNATURE: MagicSignature = {
  name: "QuickTime",
  extension: "mov",
  mime: "video/quicktime",
  category: "video",
  offset: 4,
  signature: [0x6D, 0x6F, 0x6F, 0x76], // "moov"
  alternativeSignatures: [
    {
      name: "QuickTime",
      extension: "mov",
      mime: "video/quicktime",
      category: "video",
      offset: 4,
      signature: [0x66, 0x72, 0x65, 0x65] // "free"
    },
    {
      name: "QuickTime",
      extension: "mov",
      mime: "video/quicktime",
      category: "video",
      offset: 4,
      signature: [0x6D, 0x64, 0x61, 0x74] // "mdat"
    },
    {
      name: "QuickTime",
      extension: "mov",
      mime: "video/quicktime",
      category: "video",
      offset: 4,
      signature: [0x77, 0x69, 0x64, 0x65] // "wide"
    },
    {
      name: "QuickTime",
      extension: "mov",
      mime: "video/quicktime",
      category: "video",
      offset: 4,
      signature: [0x70, 0x6E, 0x6F, 0x74] // "pnot"
    },
    {
      name: "QuickTime",
      extension: "mov",
      mime: "video/quicktime",
      category: "video",
      offset: 4,
      signature: [0x73, 0x6B, 0x69, 0x70] // "skip"
    },
    {
      name: "QuickTime",
      extension: "mov",
      mime: "video/quicktime",
      category: "video",
      offset: 4,
      signature: [0x6A, 0x75, 0x6E, 0x6B] // "junk"
    }
  ]
};

const MP3_SIGNATURE: MagicSignature = {
  name: "MP3",
  extension: "mp3",
  mime: "audio/mpeg",
  category: "audio",
  offset: 0,
  signature: [0xFF, 0xFB], // MPEG version 1
  alternativeSignatures: [
    {
      name: "MP3",
      extension: "mp3",
      mime: "audio/mpeg",
      category: "audio",
      offset: 0,
      signature: [0xFF, 0xFA] // MPEG version 1
    },
    {
      name: "MP3",
      extension: "mp3",
      mime: "audio/mpeg",
      category: "audio",
      offset: 0,
      signature: [0xFF, 0xF3] // MPEG version 2
    },
    {
      name: "MP3",
      extension: "mp3",
      mime: "audio/mpeg",
      category: "audio",
      offset: 0,
      signature: [0xFF, 0xF2] // MPEG version 2
    },
    {
      name: "MP3",
      extension: "mp3",
      mime: "audio/mpeg",
      category: "audio",
      offset: 0,
      signature: [0x49, 0x44, 0x33] // ID3 tag
    }
  ]
};

const WAV_SIGNATURE: MagicSignature = {
  name: "WAV",
  extension: "wav",
  mime: "audio/wav",
  category: "audio",
  offset: 0,
  signature: [0x52, 0x49, 0x46, 0x46], // "RIFF"
  alternativeSignatures: [
    {
      name: "WAV",
      extension: "wav",
      mime: "audio/wav",
      category: "audio",
      offset: 8,
      signature: [0x57, 0x41, 0x56, 0x45] // "WAVE"
    }
  ]
};

const OGG_SIGNATURE: MagicSignature = {
  name: "OGG",
  extension: "ogg",
  mime: "audio/ogg",
  category: "audio",
  offset: 0,
  signature: [0x4F, 0x67, 0x67, 0x53] // "OggS"
};

const FLAC_SIGNATURE: MagicSignature = {
  name: "FLAC",
  extension: "flac",
  mime: "audio/flac",
  category: "audio",
  offset: 0,
  signature: [0x66, 0x4C, 0x61, 0x43] // "fLaC"
};

const M4A_SIGNATURE: MagicSignature = {
  name: "M4A",
  extension: "m4a",
  mime: "audio/mp4",
  category: "audio",
  offset: 4,
  signature: [0x66, 0x74, 0x79, 0x70] // "ftyp" (M4A is MP4 audio)
};

const ZIP_SIGNATURE: MagicSignature = {
  name: "ZIP",
  extension: "zip",
  mime: "application/zip",
  category: "archive",
  offset: 0,
  signature: [0x50, 0x4B, 0x03, 0x04] // "PK\x03\x04"
};

const ZIP_EMPTY_SIGNATURE: MagicSignature = {
  name: "ZIP",
  extension: "zip",
  mime: "application/zip",
  category: "archive",
  offset: 0,
  signature: [0x50, 0x4B, 0x05, 0x06] // Empty ZIP
};

const ZIP_SPANNED_SIGNATURE: MagicSignature = {
  name: "ZIP",
  extension: "zip",
  mime: "application/zip",
  category: "archive",
  offset: 0,
  signature: [0x50, 0x4B, 0x07, 0x08] // Spanned ZIP
};

const RAR_SIGNATURE: MagicSignature = {
  name: "RAR",
  extension: "rar",
  mime: "application/vnd.rar",
  category: "archive",
  offset: 0,
  signature: [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07] // "Rar!\x1A\x07"
};

const RAR5_SIGNATURE: MagicSignature = {
  name: "RAR5",
  extension: "rar",
  mime: "application/vnd.rar",
  category: "archive",
  offset: 0,
  signature: [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x01, 0x00] // "Rar!\x1A\x07\x01\x00"
};

const SEVEN_ZIP_SIGNATURE: MagicSignature = {
  name: "7Z",
  extension: "7z",
  mime: "application/x-7z-compressed",
  category: "archive",
  offset: 0,
  signature: [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C] // "7z\xBC\xAF\x27\x1C"
};

const ICO_SIGNATURE: MagicSignature = {
  name: "ICO",
  extension: "ico",
  mime: "image/vnd.microsoft.icon",
  category: "image",
  offset: 0,
  signature: [0x00, 0x00, 0x01, 0x00]
};

const CUR_SIGNATURE: MagicSignature = {
  name: "CUR",
  extension: "cur",
  mime: "image/vnd.microsoft.icon",
  category: "image",
  offset: 0,
  signature: [0x00, 0x00, 0x02, 0x00]
};

const PSD_SIGNATURE: MagicSignature = {
  name: "PSD",
  extension: "psd",
  mime: "image/vnd.adobe.photoshop",
  category: "image",
  offset: 0,
  signature: [0x38, 0x42, 0x50, 0x53] // "8BPS"
};

const SVG_SIGNATURE: MagicSignature = {
  name: "SVG",
  extension: "svg",
  mime: "image/svg+xml",
  category: "image",
  offset: 0,
  signature: [0x3C, 0x73, 0x76, 0x67] // "<svg" (case sensitive check done in function)
};

const XML_SIGNATURE: MagicSignature = {
  name: "XML",
  extension: "xml",
  mime: "text/xml",
  category: "text",
  offset: 0,
  signature: [0x3C, 0x3F, 0x78, 0x6D, 0x6C] // "<?xml"
};

const HTML_SIGNATURE: MagicSignature = {
  name: "HTML",
  extension: "html",
  mime: "text/html",
  category: "text",
  offset: 0,
  signature: [0x3C, 0x21, 0x44, 0x4F, 0x43, 0x54, 0x59, 0x50, 0x45], // "<!DOCTYPE"
  alternativeSignatures: [
    {
      name: "HTML",
      extension: "html",
      mime: "text/html",
      category: "text",
      offset: 0,
      signature: [0x3C, 0x68, 0x74, 0x6D, 0x6C] // "<html"
    },
    {
      name: "HTML",
      extension: "html",
      mime: "text/html",
      category: "text",
      offset: 0,
      signature: [0x3C, 0x48, 0x54, 0x4D, 0x4C] // "<HTML"
    },
    {
      name: "HTML",
      extension: "html",
      mime: "text/html",
      category: "text",
      offset: 0,
      signature: [0x3C, 0x21, 0x2D, 0x2D] // "<!--"
    }
  ]
};

const JSON_SIGNATURE: MagicSignature = {
  name: "JSON",
  extension: "json",
  mime: "application/json",
  category: "text",
  offset: 0,
  signature: [0x7B] // "{"
};

const JSON_ARRAY_SIGNATURE: MagicSignature = {
  name: "JSON",
  extension: "json",
  mime: "application/json",
  category: "text",
  offset: 0,
  signature: [0x5B] // "["
};

// Additional common image formats
const TGA_SIGNATURE: MagicSignature = {
  name: "TGA",
  extension: "tga",
  mime: "image/x-tga",
  category: "image",
  offset: 0,
  // No unique signature, check via extension and file structure
  signature: [],
  mask: []
};

const PPM_SIGNATURE: MagicSignature = {
  name: "PPM",
  extension: "ppm",
  mime: "image/x-portable-pixmap",
  category: "image",
  offset: 0,
  signature: [0x50, 0x36] // "P6"
};

const PGM_SIGNATURE: MagicSignature = {
  name: "PGM",
  extension: "pgm",
  mime: "image/x-portable-graymap",
  category: "image",
  offset: 0,
  signature: [0x50, 0x35] // "P5"
};

const PBM_SIGNATURE: MagicSignature = {
  name: "PBM",
  extension: "pbm",
  mime: "image/x-portable-bitmap",
  category: "image",
  offset: 0,
  signature: [0x50, 0x34] // "P4"
};

// Additional audio formats
const AIFF_SIGNATURE: MagicSignature = {
  name: "AIFF",
  extension: "aiff",
  mime: "audio/aiff",
  category: "audio",
  offset: 0,
  signature: [0x46, 0x4F, 0x52, 0x4D], // "FORM"
  alternativeSignatures: [
    {
      name: "AIFF",
      extension: "aiff",
      mime: "audio/aiff",
      category: "audio",
      offset: 8,
      signature: [0x41, 0x49, 0x46, 0x46] // "AIFF"
    }
  ]
};

const AU_SIGNATURE: MagicSignature = {
  name: "AU",
  extension: "au",
  mime: "audio/basic",
  category: "audio",
  offset: 0,
  signature: [0x2E, 0x73, 0x6E, 0x64] // ".snd"
};

const MIDI_SIGNATURE: MagicSignature = {
  name: "MIDI",
  extension: "mid",
  mime: "audio/midi",
  category: "audio",
  offset: 0,
  signature: [0x4D, 0x54, 0x68, 0x64] // "MThd"
};

// Additional video formats
const FLV_SIGNATURE: MagicSignature = {
  name: "FLV",
  extension: "flv",
  mime: "video/x-flv",
  category: "video",
  offset: 0,
  signature: [0x46, 0x4C, 0x56, 0x01] // "FLV\x01"
};

const MKV_SIGNATURE: MagicSignature = {
  name: "MKV",
  extension: "mkv",
  mime: "video/x-matroska",
  category: "video",
  offset: 0,
  signature: [0x1A, 0x45, 0xDF, 0xA3] // Same as WebM (EBML)
};

const WMV_SIGNATURE: MagicSignature = {
  name: "WMV",
  extension: "wmv",
  mime: "video/x-ms-wmv",
  category: "video",
  offset: 0,
  signature: [0x30, 0x26, 0xB2, 0x75, 0x8E, 0x66, 0xCF, 0x11, 0xA6, 0xD9] // GUID
};

const MPEG_TS_SIGNATURE: MagicSignature = {
  name: "MPEG-TS",
  extension: "ts",
  mime: "video/mp2t",
  category: "video",
  offset: 0,
  signature: [0x47], // Transport stream packet (sync byte)
  mask: [0xFF]
};

const MPEG_PS_SIGNATURE: MagicSignature = {
  name: "MPEG-PS",
  extension: "mpg",
  mime: "video/mpeg",
  category: "video",
  offset: 0,
  signature: [0x00, 0x00, 0x01, 0xBA]
};

// Additional archive formats
const TAR_SIGNATURE: MagicSignature = {
  name: "TAR",
  extension: "tar",
  mime: "application/x-tar",
  category: "archive",
  offset: 257,
  signature: [0x75, 0x73, 0x74, 0x61, 0x72] // "ustar"
};

const GZIP_SIGNATURE: MagicSignature = {
  name: "GZIP",
  extension: "gz",
  mime: "application/gzip",
  category: "archive",
  offset: 0,
  signature: [0x1F, 0x8B]
};

const BZIP2_SIGNATURE: MagicSignature = {
  name: "BZIP2",
  extension: "bz2",
  mime: "application/x-bzip2",
  category: "archive",
  offset: 0,
  signature: [0x42, 0x5A, 0x68] // "BZh"
};

const LZMA_SIGNATURE: MagicSignature = {
  name: "LZMA",
  extension: "lzma",
  mime: "application/x-lzma",
  category: "archive",
  offset: 0,
  signature: [0x5D, 0x00, 0x00]
};

const XZ_SIGNATURE: MagicSignature = {
  name: "XZ",
  extension: "xz",
  mime: "application/x-xz",
  category: "archive",
  offset: 0,
  signature: [0xFD, 0x37, 0x7A, 0x58, 0x5A, 0x00] // "\xFD\x7zXZ\x00"
};

const CAB_SIGNATURE: MagicSignature = {
  name: "CAB",
  extension: "cab",
  mime: "application/vnd.ms-cab-compressed",
  category: "archive",
  offset: 0,
  signature: [0x4D, 0x53, 0x43, 0x46], // "MSCF"
  alternativeSignatures: [
    {
      name: "CAB",
      extension: "cab",
      mime: "application/vnd.ms-cab-compressed",
      category: "archive",
      offset: 0,
      signature: [0x49, 0x53, 0x63, 0x28] // "ISc("
    }
  ]
};

const ISO_SIGNATURE: MagicSignature = {
  name: "ISO",
  extension: "iso",
  mime: "application/x-iso9660-image",
  category: "archive",
  offset: 32769,
  signature: [0x43, 0x44, 0x30, 0x30, 0x31] // "CD001"
};

// ELF executable
const ELF_SIGNATURE: MagicSignature = {
  name: "ELF",
  extension: "elf",
  mime: "application/x-executable",
  category: "binary",
  offset: 0,
  signature: [0x7F, 0x45, 0x4C, 0x46] // "\x7fELF"
};

// PostScript
const PS_SIGNATURE: MagicSignature = {
  name: "PostScript",
  extension: "ps",
  mime: "application/postscript",
  category: "document",
  offset: 0,
  signature: [0x25, 0x21] // "%!"
};

const EPS_SIGNATURE: MagicSignature = {
  name: "EPS",
  extension: "eps",
  mime: "application/postscript",
  category: "document",
  offset: 0,
  signature: [0x25, 0x21, 0x50, 0x53, 0x2D, 0x41, 0x64, 0x6F, 0x62, 0x65] // "%!PS-Adobe"
};

// RTF
const RTF_SIGNATURE: MagicSignature = {
  name: "RTF",
  extension: "rtf",
  mime: "application/rtf",
  category: "document",
  offset: 0,
  signature: [0x7B, 0x5C, 0x72, 0x74, 0x66, 0x31] // "{\rtf1"
};

// EOT font
const EOT_SIGNATURE: MagicSignature = {
  name: "EOT",
  extension: "eot",
  mime: "application/vnd.ms-fontobject",
  category: "font",
  offset: 0,
  signature: [0x4C, 0x50], // "LP" (EOT version 1)
  alternativeSignatures: [
    {
      name: "EOT",
      extension: "eot",
      mime: "application/vnd.ms-fontobject",
      category: "font",
      offset: 34,
      signature: [0x4C, 0x50] // "LP" (EOT version 2)
    }
  ]
};

// WOFF font
const WOFF_SIGNATURE: MagicSignature = {
  name: "WOFF",
  extension: "woff",
  mime: "font/woff",
  category: "font",
  offset: 0,
  signature: [0x77, 0x4F, 0x46, 0x46] // "wOFF"
};

const WOFF2_SIGNATURE: MagicSignature = {
  name: "WOFF2",
  extension: "woff2",
  mime: "font/woff2",
  category: "font",
  offset: 0,
  signature: [0x77, 0x4F, 0x46, 0x32] // "wOF2"
};

// OTF/TTF font
const OTF_SIGNATURE: MagicSignature = {
  name: "OTF",
  extension: "otf",
  mime: "font/otf",
  category: "font",
  offset: 0,
  signature: [0x4F, 0x54, 0x54, 0x4F] // "OTTO"
};

const TTF_SIGNATURE: MagicSignature = {
  name: "TTF",
  extension: "ttf",
  mime: "font/ttf",
  category: "font",
  offset: 0,
  signature: [0x00, 0x01, 0x00, 0x00] // TrueType version
};

// CR2 (Canon RAW)
const CR2_SIGNATURE: MagicSignature = {
  name: "CR2",
  extension: "cr2",
  mime: "image/x-canon-cr2",
  category: "image",
  offset: 0,
  signature: [0x49, 0x49, 0x2A, 0x00], // Similar to TIFF LE
  alternativeSignatures: [
    {
      name: "CR2",
      extension: "cr2",
      mime: "image/x-canon-cr2",
      category: "image",
      offset: 8,
      signature: [0x43, 0x52, 0x02] // "CR\x02"
    }
  ]
};

// NEF (Nikon RAW)
const NEF_SIGNATURE: MagicSignature = {
  name: "NEF",
  extension: "nef",
  mime: "image/x-nikon-nef",
  category: "image",
  offset: 0,
  signature: [0x4D, 0x4D, 0x00, 0x2A] // Similar to TIFF BE
};

// DNG (Digital Negative)
const DNG_SIGNATURE: MagicSignature = {
  name: "DNG",
  extension: "dng",
  mime: "image/x-adobe-dng",
  category: "image",
  offset: 0,
  signature: [0x49, 0x49, 0x2A, 0x00] // Similar to TIFF LE
};

// ARW (Sony RAW)
const ARW_SIGNATURE: MagicSignature = {
  name: "ARW",
  extension: "arw",
  mime: "image/x-sony-arw",
  category: "image",
  offset: 0,
  signature: [0x49, 0x49, 0x2A, 0x00] // Similar to TIFF LE
};

// HEIF/HEIC
const HEIC_SIGNATURE: MagicSignature = {
  name: "HEIC",
  extension: "heic",
  mime: "image/heic",
  category: "image",
  offset: 4,
  signature: [0x66, 0x74, 0x79, 0x70], // "ftyp"
  alternativeSignatures: [
    {
      name: "HEIC",
      extension: "heic",
      mime: "image/heic",
      category: "image",
      offset: 8,
      signature: [0x68, 0x65, 0x69, 0x63] // "heic"
    },
    {
      name: "HEIF",
      extension: "heif",
      mime: "image/heif",
      category: "image",
      offset: 8,
      signature: [0x68, 0x65, 0x69, 0x66] // "heif"
    },
    {
      name: "HEIC",
      extension: "heic",
      mime: "image/heic",
      category: "image",
      offset: 8,
      signature: [0x6D, 0x69, 0x66, 0x31] // "mif1"
    }
  ]
};

// AVIF
const AVIF_SIGNATURE: MagicSignature = {
  name: "AVIF",
  extension: "avif",
  mime: "image/avif",
  category: "image",
  offset: 4,
  signature: [0x66, 0x74, 0x79, 0x70], // "ftyp"
  alternativeSignatures: [
    {
      name: "AVIF",
      extension: "avif",
      mime: "image/avif",
      category: "image",
      offset: 8,
      signature: [0x61, 0x76, 0x69, 0x66] // "avif"
    }
  ]
};

// JXL (JPEG XL)
const JXL_SIGNATURE: MagicSignature = {
  name: "JXL",
  extension: "jxl",
  mime: "image/jxl",
  category: "image",
  offset: 0,
  signature: [0xFF, 0x0A], // JXL codestream
  alternativeSignatures: [
    {
      name: "JXL",
      extension: "jxl",
      mime: "image/jxl",
      category: "image",
      offset: 0,
      signature: [0x00, 0x00, 0x00, 0x0C, 0x4A, 0x58, 0x4C, 0x20, 0x0D, 0x0A, 0x87, 0x0A] // JXL container
    }
  ]
};

// QOI
const QOI_SIGNATURE: MagicSignature = {
  name: "QOI",
  extension: "qoi",
  mime: "image/x-qoi",
  category: "image",
  offset: 0,
  signature: [0x71, 0x6F, 0x69, 0x66] // "qoif"
};

// VTF (Valve Texture Format)
const VTF_SIGNATURE: MagicSignature = {
  name: "VTF",
  extension: "vtf",
  mime: "image/x-vtf",
  category: "image",
  offset: 0,
  signature: [0x56, 0x54, 0x46, 0x00] // "VTF\x00"
};

// Collect all signatures
const ALL_SIGNATURES: MagicSignature[] = [
  PNG_SIGNATURE,
  JPEG_SIGNATURE,
  GIF87a_SIGNATURE,
  GIF89a_SIGNATURE,
  WEBP_SIGNATURE,
  BMP_SIGNATURE,
  TIFF_LE_SIGNATURE,
  TIFF_BE_SIGNATURE,
  ICO_SIGNATURE,
  CUR_SIGNATURE,
  PSD_SIGNATURE,
  SVG_SIGNATURE,
  TGA_SIGNATURE,
  PPM_SIGNATURE,
  PGM_SIGNATURE,
  PBM_SIGNATURE,
  PDF_SIGNATURE,
  DOCX_SIGNATURE,
  XLSX_SIGNATURE,
  PS_SIGNATURE,
  EPS_SIGNATURE,
  RTF_SIGNATURE,
  MP4_SIGNATURE,
  WEBM_SIGNATURE,
  AVI_RIFF_SIGNATURE,
  MOV_SIGNATURE,
  FLV_SIGNATURE,
  MKV_SIGNATURE,
  WMV_SIGNATURE,
  MPEG_TS_SIGNATURE,
  MPEG_PS_SIGNATURE,
  MP3_SIGNATURE,
  WAV_SIGNATURE,
  OGG_SIGNATURE,
  FLAC_SIGNATURE,
  M4A_SIGNATURE,
  AIFF_SIGNATURE,
  AU_SIGNATURE,
  MIDI_SIGNATURE,
  ZIP_SIGNATURE,
  ZIP_EMPTY_SIGNATURE,
  ZIP_SPANNED_SIGNATURE,
  RAR_SIGNATURE,
  RAR5_SIGNATURE,
  SEVEN_ZIP_SIGNATURE,
  TAR_SIGNATURE,
  GZIP_SIGNATURE,
  BZIP2_SIGNATURE,
  LZMA_SIGNATURE,
  XZ_SIGNATURE,
  CAB_SIGNATURE,
  ISO_SIGNATURE,
  EOT_SIGNATURE,
  WOFF_SIGNATURE,
  WOFF2_SIGNATURE,
  OTF_SIGNATURE,
  TTF_SIGNATURE,
  CR2_SIGNATURE,
  NEF_SIGNATURE,
  DNG_SIGNATURE,
  ARW_SIGNATURE,
  HEIC_SIGNATURE,
  AVIF_SIGNATURE,
  JXL_SIGNATURE,
  QOI_SIGNATURE,
  VTF_SIGNATURE,
  ELF_SIGNATURE,
  XML_SIGNATURE,
  HTML_SIGNATURE,
  JSON_SIGNATURE,
  JSON_ARRAY_SIGNATURE
];

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Checks if a byte array matches a signature at a given offset
 * @param bytes The byte array to check
 * @param signature The signature to match
 * @param offset The offset to start checking
 * @param mask Optional bitmask for matching
 * @returns true if the signature matches
 */
function matchesSignature(
  bytes: Uint8Array,
  signature: number[],
  offset: number,
  mask?: number[]
): boolean {
  // Check if we have enough bytes
  if (bytes.length < offset + signature.length) {
    return false;
  }

  for (let i = 0; i < signature.length; i++) {
    const byte = bytes[offset + i];
    const sigByte = signature[i];
    const maskByte = mask ? mask[i] : 0xFF;

    if ((byte & maskByte) !== sigByte) {
      return false;
    }
  }

  return true;
}

/**
 * Checks if bytes match any of the text signatures with case insensitivity
 * @param bytes The byte array to check
 * @param signatures Array of signatures to check
 * @param offset The offset to start checking
 * @returns true if any signature matches
 */
function matchesSignatureCaseInsensitive(
  bytes: Uint8Array,
  signatures: number[][],
  offset: number
): boolean {
  if (bytes.length < offset + signatures[0].length) {
    return false;
  }

  for (const signature of signatures) {
    let matches = true;
    for (let i = 0; i < signature.length; i++) {
      const byte = bytes[offset + i];
      const sigByte = signature[i];

      // Case-insensitive comparison for ASCII letters
      const matchesLetter =
        byte === sigByte ||
        (sigByte >= 0x41 && sigByte <= 0x5A && byte === sigByte + 0x20) || // Upper to lower
        (sigByte >= 0x61 && sigByte <= 0x7A && byte === sigByte - 0x20);   // Lower to upper

      if (!matchesLetter) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }

  return false;
}

/**
 * Checks if a file is a valid text-based format by examining bytes
 * @param bytes The byte array to check
 * @param signatures Array of signatures for different case variations
 * @param offset The offset to start checking
 * @returns true if any signature matches
 */
function matchesTextSignature(
  bytes: Uint8Array,
  signatures: number[][],
  offset: number
): boolean {
  return matchesSignatureCaseInsensitive(bytes, signatures, offset);
}

/**
 * Detects the format of a file from its magic number
 * @param bytes The file content as a Uint8Array
 * @returns The detected format info or null if not detected
 */
function detectFormatFromBytes(bytes: Uint8Array): FileFormatInfo | null {
  if (bytes.length === 0) {
    return null;
  }

  for (const sig of ALL_SIGNATURES) {
    // Check primary signature
    if (sig.signature.length > 0) {
      // Special handling for case-sensitive text signatures
      if (sig.name === "SVG" || sig.name === "HTML") {
        const sigBytes = sig.signature;
        if (matchesTextSignature(bytes, [sigBytes], sig.offset)) {
          return {
            name: sig.name,
            extension: sig.extension,
            mime: sig.mime,
            category: sig.category
          };
        }
      } else if (sig.name === "JSON" || sig.name === "XML") {
        // Text-based formats that might have whitespace before content
        let adjustedOffset = sig.offset;
        while (adjustedOffset < bytes.length && (bytes[adjustedOffset] === 0x20 || bytes[adjustedOffset] === 0x09 || bytes[adjustedOffset] === 0x0D || bytes[adjustedOffset] === 0x0A)) {
          adjustedOffset++;
        }
        if (matchesSignature(bytes, sig.signature, adjustedOffset, sig.mask)) {
          return {
            name: sig.name,
            extension: sig.extension,
            mime: sig.mime,
            category: sig.category
          };
        }
      } else if (matchesSignature(bytes, sig.signature, sig.offset, sig.mask)) {
        // Additional checks for ambiguous signatures

        // ZIP-based formats need extra checking
        if (sig.signature[0] === 0x50 && sig.signature[1] === 0x4B && sig.signature[2] === 0x03 && sig.signature[3] === 0x04) {
          // Check for DOCX by looking for [Content_Types].xml
          if (sig.name === "DOCX" && bytes.length > 30) {
            // DOCX files have specific structure in the ZIP
            // This is a simplified check - a full check would require ZIP parsing
            const expectedMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            // Look for common DOCX indicators
            if (bytes.length > 1000) {
              // Check for content type hints
              const str = Array.from(bytes.slice(0, 1000)).map(b => String.fromCharCode(b)).join("");
              if (str.includes("word/") || str.includes("[Content_Types]")) {
                return {
                  name: sig.name,
                  extension: sig.extension,
                  mime: expectedMime,
                  category: sig.category
                };
              }
            }
          }

          // Check for XLSX
          if (sig.name === "XLSX" && bytes.length > 1000) {
            const str = Array.from(bytes.slice(0, 1000)).map(b => String.fromCharCode(b)).join("");
            if (str.includes("xl/") || str.includes("[Content_Types]")) {
              return {
                name: sig.name,
                extension: sig.extension,
                mime: sig.mime,
                category: sig.category
              };
            }
          }

          // Default to ZIP if no specific Office format detected
          if (sig.name === "ZIP") {
            return {
              name: sig.name,
              extension: sig.extension,
              mime: sig.mime,
              category: sig.category
            };
          }
        }

        // RIFF-based formats (WAV, AVI, WebP)
        if (sig.signature[0] === 0x52 && sig.signature[1] === 0x49 && sig.signature[2] === 0x46 && sig.signature[3] === 0x46) {
          if (sig.name === "WAV" || sig.name === "AVI") {
            if (sig.alternativeSignatures) {
              for (const altSig of sig.alternativeSignatures) {
                if (matchesSignature(bytes, altSig.signature, altSig.offset)) {
                  return {
                    name: sig.name,
                    extension: sig.extension,
                    mime: sig.mime,
                    category: sig.category
                  };
                }
              }
            }
          }
        }

        // EBML-based formats (WebM, MKV)
        if (sig.signature[0] === 0x1A && sig.signature[1] === 0x45 && sig.signature[2] === 0xDF && sig.signature[3] === 0xA3) {
          // Need further inspection to distinguish WebM from MKV
          if (sig.name === "WebM") {
            // WebM has specific DocType
            for (let i = 4; i < Math.min(bytes.length, 100); i++) {
              if (bytes[i] === 0x42 && bytes[i + 1] === 0x82) {
                // Found DocType
                const docType = String.fromCharCode(bytes[i + 2], bytes[i + 3], bytes[i + 4]);
                if (docType === "web" || (bytes[i + 2] === 0x77 && bytes[i + 3] === 0x65 && bytes[i + 4] === 0x62)) {
                  return {
                    name: "WebM",
                    extension: "webm",
                    mime: "video/webm",
                    category: "video"
                  };
                }
              }
            }
          }
        }

        // MPEG-TS can appear at various offsets
        if (sig.name === "MPEG-TS") {
          // Check multiple packet positions
          let foundTs = false;
          for (let checkOffset = 0; checkOffset < Math.min(bytes.length, 1000); checkOffset++) {
            if (bytes[checkOffset] === 0x47) {
              // Check if it's a repeating pattern (TS packets are 188 bytes)
              let packetCount = 0;
              for (let p = checkOffset; p < Math.min(bytes.length, 1000); p += 188) {
                if (bytes[p] === 0x47) packetCount++;
              }
              if (packetCount >= 3) {
                foundTs = true;
                break;
              }
            }
          }
          if (!foundTs) continue;
        }

        // TIFF-like formats (TIFF, CR2, NEF, DNG, ARW)
        if ((sig.signature[0] === 0x49 && sig.signature[1] === 0x49) ||
            (sig.signature[0] === 0x4D && sig.signature[1] === 0x4D)) {
          // For RAW formats, we need additional checks
          if (sig.name === "CR2" || sig.name === "NEF" || sig.name === "DNG" || sig.name === "ARW") {
            if (sig.alternativeSignatures) {
              for (const altSig of sig.alternativeSignatures) {
                if (matchesSignature(bytes, altSig.signature, altSig.offset)) {
                  return {
                    name: sig.name,
                    extension: sig.extension,
                    mime: sig.mime,
                    category: sig.category
                  };
                }
              }
            }
          }
        }

        // MP4-based formats (MP4, M4A, MOV have some overlap)
        if (sig.signature[0] === 0x66 && sig.signature[1] === 0x74 && sig.signature[2] === 0x79 && sig.signature[3] === 0x70) {
          if (sig.name === "M4A" || sig.name === "MP4") {
            // Check the brand field
            const brand = String.fromCharCode(
              bytes[sig.offset + 4],
              bytes[sig.offset + 5],
              bytes[sig.offset + 6],
              bytes[sig.offset + 7]
            );
            const isM4A = brand === "M4A " || brand === "m4a " || brand === "isom" || brand === "mp42";
            const isMP4 = brand === "mp41" || brand === "mp42" || brand === "isom";

            if (sig.name === "M4A" && isM4A) {
              return {
                name: sig.name,
                extension: sig.extension,
                mime: sig.mime,
                category: sig.category
              };
            }
            if (sig.name === "MP4" && isMP4) {
              return {
                name: sig.name,
                extension: sig.extension,
                mime: sig.mime,
                category: sig.category
              };
            }
            continue; // Skip if brand doesn't match
          }
        }

        // HEIC/HEIF check
        if (sig.name === "HEIC" || sig.name === "HEIF") {
          if (sig.alternativeSignatures) {
            for (const altSig of sig.alternativeSignatures) {
              if (matchesSignature(bytes, altSig.signature, altSig.offset)) {
                return {
                  name: sig.name,
                  extension: sig.extension,
                  mime: sig.mime,
                  category: sig.category
                };
              }
            }
          }
        }

        // Default return for matching signature
        return {
          name: sig.name,
          extension: sig.extension,
          mime: sig.mime,
          category: sig.category
        };
      }
    }

    // Check alternative signatures if available
    if (sig.alternativeSignatures) {
      for (const altSig of sig.alternativeSignatures) {
        if (altSig.signature.length > 0 && matchesSignature(bytes, altSig.signature, altSig.offset, altSig.mask)) {
          return {
            name: sig.name,
            extension: sig.extension,
            mime: sig.mime,
            category: sig.category
          };
        }
      }
    }
  }

  return null;
}

/**
 * Extracts the file extension from a filename
 * @param filename The filename to parse
 * @returns The extension without the dot, or empty string
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  if (parts.length < 2) return "";
  return parts.pop()!.toLowerCase();
}

/**
 * Validates a file's signature matches its declared extension
 * @param file The File object to validate
 * @returns A ValidationResult with success status and details
 */
export async function validateFileSignature(file: File): Promise<ValidationResult> {
  // Handle empty files
  if (file.size === 0) {
    return {
      valid: false,
      detectedFormat: null,
      error: "The file is empty and cannot be processed."
    };
  }

  // Only read the minimum bytes needed for signature detection
  // Most signatures are within the first 12 bytes, but we need more for some formats
  const MAX_HEADER_SIZE = 4100; // Enough for ZIP structure checks and text content
  const bytesToRead = Math.min(file.size, MAX_HEADER_SIZE);

  let slice: Blob;
  try {
    slice = file.slice(0, bytesToRead);
  } catch {
    return {
      valid: false,
      detectedFormat: null,
      error: "Unable to read file. The file may be corrupted or inaccessible."
    };
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await slice.arrayBuffer();
  } catch {
    return {
      valid: false,
      detectedFormat: null,
      error: "Unable to read file content. The file may be corrupted."
    };
  }

  const bytes = new Uint8Array(buffer);

  // Detect the actual format from magic numbers
  const detectedFormat = detectFormatFromBytes(bytes);

  // Get the declared extension from the filename
  const declaredExtension = getFileExtension(file.name);

  // Handle unknown formats
  if (!detectedFormat) {
    return {
      valid: true, // We don't reject unknown formats, but flag them
      detectedFormat: null,
      error: null
    };
  }

  // Check for MIME type spoofing (declared extension doesn't match detected format)
  const detectedExtension = detectedFormat.extension.toLowerCase();

  // Build a set of compatible extensions (e.g., jpg = jpeg, tiff = tif)
  const compatibleExtensions = new Set<string>([
    detectedExtension,
    ...getCompatibleExtensions(detectedExtension)
  ]);

  const isExtensionCompatible = compatibleExtensions.has(declaredExtension);

  // Special cases where we allow mismatches
  const allowMismatch = shouldAllowExtensionMismatch(declaredExtension, detectedExtension);

  if (!isExtensionCompatible && !allowMismatch) {
    return {
      valid: false,
      detectedFormat,
      error: buildExtensionMismatchError(declaredExtension, detectedFormat)
    };
  }

  // Additional security checks for dangerous file types
  const securityCheck = checkForDangerousContent(bytes, detectedFormat);
  if (!securityCheck.safe) {
    return {
      valid: false,
      detectedFormat,
      error: securityCheck.error
    };
  }

  return {
    valid: true,
    detectedFormat,
    error: null
  };
}

/**
 * Returns compatible extensions for a given format
 * @param extension The base extension
 * @returns Array of compatible extensions
 */
function getCompatibleExtensions(extension: string): string[] {
  const compatibilityMap: Record<string, string[]> = {
    "jpg": ["jpeg", "jpe", "jfif"],
    "jpeg": ["jpg", "jpe", "jfif"],
    "tiff": ["tif"],
    "tif": ["tiff"],
    "mp3": ["mpga"],
    "mpga": ["mp3"],
    "txt": ["text"],
    "text": ["txt"],
    "htm": ["html"],
    "html": ["htm"],
    "m4a": ["m4b", "m4p", "m4r"],
    "m4v": ["mp4"],
    "mp4": ["m4v"],
    "doc": ["docx"],
    "xls": ["xlsx"],
    "ppt": ["pptx"]
  };

  return compatibilityMap[extension] || [];
}

/**
 * Determines if an extension mismatch should be allowed
 * @param declared The declared extension
 * @param detected The detected extension
 * @returns true if the mismatch should be allowed
 */
function shouldAllowExtensionMismatch(declared: string, detected: string): boolean {
  // Allow text files to have various extensions
  if (["txt", "csv", "md", "log"].includes(declared) && detected === "txt") {
    return true;
  }

  // Allow some container format variations
  const containerVariations: Record<string, string[]> = {
    "mp4": ["m4v", "m4a", "mov"],
    "mov": ["mp4", "m4v"],
    "m4v": ["mp4"],
    "m4a": ["mp3"]
  };

  for (const [, variants] of Object.entries(containerVariations)) {
    if (variants.includes(declared) && variants.includes(detected)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks for dangerous file content patterns
 * @param bytes The file bytes to check
 * @param detectedFormat The detected format
 * @returns Security check result
 */
function checkForDangerousContent(bytes: Uint8Array, detectedFormat: FileFormatInfo): { safe: boolean; error: string | null } {
  // Check for embedded scripts in image files
  if (detectedFormat.category === "image") {
    const slice = bytes.subarray(0, Math.min(bytes.length, 1000));
    const content = Array.from(slice).map(b => String.fromCharCode(b)).join("");

    // Check for script tags in supposed image files (unless SVG)
    if (detectedFormat.extension !== "svg") {
      if (content.includes("<script") || content.includes("javascript:")) {
        return {
          safe: false,
          error: "This file contains suspicious script content. For security reasons, it cannot be processed."
        };
      }
    }
  }

  // Check for suspicious patterns in archive files
  if (detectedFormat.category === "archive") {
    // Check for nested executable patterns in the header
    const exePattern = [0x4D, 0x5A]; // MZ header
    if (bytes.length > 100) {
      for (let i = 0; i < Math.min(bytes.length - 2, 1000); i++) {
        if (bytes[i] === exePattern[0] && bytes[i + 1] === exePattern[1]) {
          // Found MZ header - check if it's a legitimate SFX archive
          // SFX archives have MZ at the start, not embedded
          if (i > 0) {
            return {
              safe: false,
              error: "This archive contains embedded executable content. For security reasons, it cannot be processed."
            };
          }
        }
      }
    }
  }

  return { safe: true, error: null };
}

/**
 * Builds a user-friendly error message for extension mismatches
 * @param declaredExtension The extension declared by the filename
 * @param detectedFormat The actually detected format
 * @returns A user-friendly error message
 */
function buildExtensionMismatchError(declaredExtension: string, detectedFormat: FileFormatInfo): string {
  const declared = declaredExtension.toUpperCase() || "UNKNOWN";
  const detected = detectedFormat.name.toUpperCase();
  const detectedExt = detectedFormat.extension.toUpperCase();

  return `The file appears to be a ${detected} file (.${detectedExt}) but has a .${declared} extension. ` +
    `This mismatch could indicate:\n` +
    `• The file was renamed incorrectly\n` +
    `• The file content is corrupted\n` +
    `• The file may be malicious\n\n` +
    `Please ensure the file extension matches its actual type.`;
}

/**
 * Validates multiple files at once
 * @param files Array of File objects to validate
 * @returns Array of ValidationResults
 */
export async function validateMultipleFiles(files: File[]): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  for (const file of files) {
    const result = await validateFileSignature(file);
    results.push(result);
  }

  return results;
}

/**
 * Gets a friendly format name from a MIME type
 * @param mime The MIME type
 * @returns A friendly format name
 */
export function formatNameFromMime(mime: string): string {
  const mimeToName: Record<string, string> = {
    "image/png": "PNG",
    "image/jpeg": "JPEG",
    "image/gif": "GIF",
    "image/webp": "WebP",
    "image/bmp": "BMP",
    "image/tiff": "TIFF",
    "image/svg+xml": "SVG",
    "image/vnd.microsoft.icon": "ICO",
    "application/pdf": "PDF",
    "application/zip": "ZIP",
    "audio/mpeg": "MP3",
    "audio/wav": "WAV",
    "audio/ogg": "OGG",
    "audio/flac": "FLAC",
    "video/mp4": "MP4",
    "video/webm": "WebM",
    "video/quicktime": "MOV",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX"
  };

  return mimeToName[mime] || mime.split("/").pop()?.toUpperCase() || "Unknown";
}
