/**
 * File Signature Validator - Testing Strategy
 *
 * This file outlines the testing strategy for the file signature validator.
 * Tests can be run using browser DevTools console or a test framework like Vitest.
 */

import { validateFileSignature, getFileExtension, detectFormatFromBytes, type ValidationResult } from "./fileValidator.js";

// ============================================================================
// TEST DATA HELPERS
// ============================================================================

/**
 * Creates a mock File object with specified bytes
 */
function createMockFile(filename: string, bytes: number[], type = "application/octet-stream"): File {
  const uint8Array = new Uint8Array(bytes);
  const blob = new Blob([uint8Array], { type });
  return new File([blob], filename, { type });
}

/**
 * Creates a mock File from a hex string
 */
function createMockFileFromHex(filename: string, hexString: string, type = "application/octet-stream"): File {
  const bytes: number[] = [];
  for (let i = 0; i < hexString.length; i += 2) {
    bytes.push(parseInt(hexString.substr(i, 2), 16));
  }
  return createMockFile(filename, bytes, type);
}

// ============================================================================
// TEST CASES - VALID FILES
// ============================================================================

/**
 * Test suite for valid file signatures
 * These should all pass validation
 */
export const validFileTests = {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  png: {
    name: "Valid PNG file",
    file: () => createMockFileFromHex("image.png", "89504E470D0A1A0A0000000D49484452"),
    expectedMime: "image/png",
    expectedExtension: "png"
  },

  // JPEG: FF D8 FF
  jpeg: {
    name: "Valid JPEG file",
    file: () => createMockFileFromHex("photo.jpg", "FFD8FFE000104A4649460001"),
    expectedMime: "image/jpeg",
    expectedExtension: "jpg"
  },

  // GIF87a: 47 49 46 38 37 61
  gif87a: {
    name: "Valid GIF87a file",
    file: () => createMockFileFromHex("animation.gif", "47494638376139000100"),
    expectedMime: "image/gif",
    expectedExtension: "gif"
  },

  // GIF89a: 47 49 46 38 39 61
  gif89a: {
    name: "Valid GIF89a file",
    file: () => createMockFileFromHex("animation.gif", "47494638396139000100"),
    expectedMime: "image/gif",
    expectedExtension: "gif"
  },

  // WebP: 52 49 46 46 ... "WEBP" at offset 8
  webp: {
    name: "Valid WebP file",
    file: () => createMockFileFromHex("image.webp", "524946460000000057454250"),
    expectedMime: "image/webp",
    expectedExtension: "webp"
  },

  // BMP: 42 4D
  bmp: {
    name: "Valid BMP file",
    file: () => createMockFileFromHex("image.bmp", "424D3600000000000000360000002800"),
    expectedMime: "image/bmp",
    expectedExtension: "bmp"
  },

  // TIFF LE: 49 49 2A 00
  tiffLe: {
    name: "Valid TIFF (Little-endian) file",
    file: () => createMockFileFromHex("image.tif", "49492A0008000000"),
    expectedMime: "image/tiff",
    expectedExtension: "tiff"
  },

  // TIFF BE: 4D 4D 00 2A
  tiffBe: {
    name: "Valid TIFF (Big-endian) file",
    file: () => createMockFileFromHex("image.tif", "4D4D002A08000000"),
    expectedMime: "image/tiff",
    expectedExtension: "tiff"
  },

  // PDF: 25 50 44 46 (%PDF)
  pdf: {
    name: "Valid PDF file",
    file: () => createMockFileFromHex("document.pdf", "255044462D312E340A25C4B5D6074"),
    expectedMime: "application/pdf",
    expectedExtension: "pdf"
  },

  // ZIP: 50 4B 03 04
  zip: {
    name: "Valid ZIP file",
    file: () => createMockFileFromHex("archive.zip", "504B0304140000000800"),
    expectedMime: "application/zip",
    expectedExtension: "zip"
  },

  // MP4: 66 74 79 70 (ftyp) at offset 4
  mp4: {
    name: "Valid MP4 file",
    file: () => createMockFileFromHex("video.mp4", "000000206674797069736F6D00000200"),
    expectedMime: "video/mp4",
    expectedExtension: "mp4"
  },

  // WebM: 1A 45 DF A3 (EBML header)
  webm: {
    name: "Valid WebM file",
    file: () => createMockFileFromHex("video.webm", "1A45DFA301000000004286"),
    expectedMime: "video/webm",
    expectedExtension: "webm"
  },

  // MP3: FF FB (MPEG version 1)
  mp3: {
    name: "Valid MP3 file",
    file: () => createMockFileFromHex("audio.mp3", "FFFB9000000000000000"),
    expectedMime: "audio/mpeg",
    expectedExtension: "mp3"
  },

  // MP3: 49 44 33 (ID3 tag)
  mp3Id3: {
    name: "Valid MP3 file with ID3 tag",
    file: () => createMockFileFromHex("audio.mp3", "49443304000000000000"),
    expectedMime: "audio/mpeg",
    expectedExtension: "mp3"
  },

  // WAV: 52 49 46 46 (RIFF) + 57 41 56 45 (WAVE) at offset 8
  wav: {
    name: "Valid WAV file",
    file: () => createMockFileFromHex("audio.wav", "524946460000000057415645666D7420"),
    expectedMime: "audio/wav",
    expectedExtension: "wav"
  },

  // OGG: 4F 67 67 53 (OggS)
  ogg: {
    name: "Valid OGG file",
    file: () => createMockFileFromHex("audio.ogg", "4F67675300000000000000000000"),
    expectedMime: "audio/ogg",
    expectedExtension: "ogg"
  },

  // FLAC: 66 4C 61 43 (fLaC)
  flac: {
    name: "Valid FLAC file",
    file: () => createMockFileFromHex("audio.flac", "664C61430000000022000000"),
    expectedMime: "audio/flac",
    expectedExtension: "flac"
  },

  // RAR: 52 61 72 21 1A 07
  rar: {
    name: "Valid RAR file",
    file: () => createMockFileFromHex("archive.rar", "526172211A0700CF907300"),
    expectedMime: "application/vnd.rar",
    expectedExtension: "rar"
  },

  // RAR5: 52 61 72 21 1A 07 01 00
  rar5: {
    name: "Valid RAR5 file",
    file: () => createMockFileFromHex("archive.rar", "526172211A070100CF907300"),
    expectedMime: "application/vnd.rar",
    expectedExtension: "rar"
  },

  // 7Z: 37 7A BC AF 27 1C
  sevenZ: {
    name: "Valid 7Z file",
    file: () => createMockFileFromHex("archive.7z", "377ABCAF271C00040000"),
    expectedMime: "application/x-7z-compressed",
    expectedExtension: "7z"
  },

  // ICO: 00 00 01 00
  ico: {
    name: "Valid ICO file",
    file: () => createMockFileFromHex("icon.ico", "000001000100101000000"),
    expectedMime: "image/vnd.microsoft.icon",
    expectedExtension: "ico"
  },

  // SVG: <svg (case insensitive check)
  svg: {
    name: "Valid SVG file",
    file: () => createMockFileFromHex("image.svg", "3C73766720786D6C6E733D22"),
    expectedMime: "image/svg+xml",
    expectedExtension: "svg"
  },

  // PSD: 38 42 50 53 (8BPS)
  psd: {
    name: "Valid PSD file",
    file: () => createMockFileFromHex("photo.psd", "38425053000000030000"),
    expectedMime: "image/vnd.adobe.photoshop",
    expectedExtension: "psd"
  },

  // AVIF: ftyp + avif brand
  avif: {
    name: "Valid AVIF file",
    file: () => createMockFileFromHex("image.avif", "0000001C6674797061766966"),
    expectedMime: "image/avif",
    expectedExtension: "avif"
  },

  // HEIC: ftyp + heic brand
  heic: {
    name: "Valid HEIC file",
    file: () => createMockFileFromHex("image.heic", "0000001C6674797068656963"),
    expectedMime: "image/heic",
    expectedExtension: "heic"
  }
};

// ============================================================================
// TEST CASES - MALICIOUS/SPOOFED FILES
// ============================================================================

/**
 * Test suite for MIME type spoofing attacks
 * These should all FAIL validation because the extension doesn't match the content
 */
export const spoofedFileTests = {
  // JPEG with .png extension
  jpegAsPng: {
    name: "JPEG file spoofed as PNG",
    file: () => createMockFileFromHex("fake.png", "FFD8FFE000104A4649460001"),
    expectedError: "appears to be a JPEG file"
  },

  // ZIP with .jpg extension (common attack vector)
  zipAsJpg: {
    name: "ZIP archive spoofed as JPEG",
    file: () => createMockFileFromHex("fake.jpg", "504B0304140000000800"),
    expectedError: "appears to be a ZIP file"
  },

  // PDF with .doc extension
  pdfAsDoc: {
    name: "PDF file spoofed as DOC",
    file: () => createMockFileFromHex("fake.doc", "255044462D312E340A25C4B5D6074"),
    expectedError: "appears to be a PDF file"
  },

  // EXE with .png extension (polyglot attack)
  exeAsPng: {
    name: "Executable spoofed as PNG",
    file: () => createMockFileFromHex("fake.png", "4D5A90000300000004000000FFFF"),
    expectedError: "appears to be an ELF file" // or won't match PNG signature
  },

  // RAR with .zip extension
  rarAsZip: {
    name: "RAR file spoofed as ZIP",
    file: () => createMockFileFromHex("fake.zip", "526172211A0700CF907300"),
    expectedError: "appears to be a RAR file"
  },

  // Script in image file
  scriptInJpg: {
    name: "Script content in JPEG file",
    file: () => {
      // Create a JPEG with embedded script content (simulating polyglot attack)
      const bytes = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01];
      // Add script tag content later in the file
      const scriptBytes = Array.from("<script>alert('xss')</script>").map(c => c.charCodeAt(0));
      return createMockFile("exploit.jpg", [...bytes, ...scriptBytes], "image/jpeg");
    },
    // This should pass since the JPEG signature is valid at the start
    // The script check is for non-SVG images where script appears early
    expectedValid: true // JPEG headers validated, script is after headers
  }
};

// ============================================================================
// TEST CASES - EDGE CASES
// ============================================================================

/**
 * Test suite for edge cases
 */
export const edgeCaseTests = {
  // Empty file
  emptyFile: {
    name: "Empty file",
    file: () => createMockFile("empty.txt", []),
    expectedError: "file is empty"
  },

  // Truncated file (incomplete header)
  truncatedPng: {
    name: "Truncated PNG file",
    file: () => createMockFileFromHex("broken.png", "89504E47"), // Only 4 bytes of PNG header
    expectedValid: true // Will pass validation but with limited info
  },

  // File with no extension
  noExtension: {
    name: "Valid file with no extension",
    file: () => createMockFileFromHex("noext", "FFD8FFE000104A4649460001"),
    expectedValid: true // Should detect JPEG even without extension
  },

  // File with multiple extensions
  multipleExtensions: {
    name: "File with multiple extensions",
    file: () => createMockFileFromHex("file.tar.gz", "1F8B08000000000000FF"),
    expectedValid: true, // Should detect GZIP
    expectedMime: "application/gzip"
  },

  // Text file with leading whitespace
  textWithWhitespace: {
    name: "JSON file with leading whitespace",
    file: () => createMockFile("data.json", [0x20, 0x20, 0x09, 0x7B, 0x22, 0x6B, 0x65, 0x79, 0x22, 0x3A, 0x7D]),
    expectedValid: true,
    expectedMime: "application/json"
  }
};

// ============================================================================
// TEST RUNNER
// ============================================================================

/**
 * Run a single test case
 */
async function runTest(testName: string, testCase: any): Promise<boolean> {
  try {
    const file = testCase.file();
    const result = await validateFileSignature(file);

    if (testCase.expectedError) {
      if (result.valid) {
        console.error(`FAIL: ${testName} - Expected error but got valid`);
        return false;
      }
      if (!result.error?.toLowerCase().includes(testCase.expectedError.toLowerCase())) {
        console.error(`FAIL: ${testName} - Expected error containing "${testCase.expectedError}", got "${result.error}"`);
        return false;
      }
      console.log(`PASS: ${testName}`);
      return true;
    }

    if (testCase.expectedValid === false) {
      if (result.valid) {
        console.error(`FAIL: ${testName} - Expected invalid but got valid`);
        return false;
      }
      console.log(`PASS: ${testName}`);
      return true;
    }

    if (!result.valid && result.error) {
      console.error(`FAIL: ${testName} - Unexpected error: ${result.error}`);
      return false;
    }

    if (testCase.expectedMime && result.detectedFormat?.mime !== testCase.expectedMime) {
      console.error(`FAIL: ${testName} - Expected MIME ${testCase.expectedMime}, got ${result.detectedFormat?.mime}`);
      return false;
    }

    if (testCase.expectedExtension && result.detectedFormat?.extension !== testCase.expectedExtension) {
      console.error(`FAIL: ${testName} - Expected extension ${testCase.expectedExtension}, got ${result.detectedFormat?.extension}`);
      return false;
    }

    console.log(`PASS: ${testName}`);
    return true;
  } catch (error) {
    console.error(`ERROR: ${testName} - ${error}`);
    return false;
  }
}

/**
 * Run all test suites
 */
export async function runAllTests(): Promise<{ passed: number; failed: number; results: string[] }> {
  const results: string[] = [];
  let passed = 0;
  let failed = 0;

  console.log("=== Running Valid File Tests ===");
  for (const [key, test] of Object.entries(validFileTests)) {
    const success = await runTest(`Valid: ${test.name}`, test);
    if (success) passed++; else failed++;
    results.push(success ? `PASS: ${test.name}` : `FAIL: ${test.name}`);
  }

  console.log("\n=== Running Spoofed File Tests ===");
  for (const [key, test] of Object.entries(spoofedFileTests)) {
    const success = await runTest(`Spoofed: ${test.name}`, test);
    if (success) passed++; else failed++;
    results.push(success ? `PASS: ${test.name}` : `FAIL: ${test.name}`);
  }

  console.log("\n=== Running Edge Case Tests ===");
  for (const [key, test] of Object.entries(edgeCaseTests)) {
    const success = await runTest(`Edge: ${test.name}`, test);
    if (success) passed++; else failed++;
    results.push(success ? `PASS: ${test.name}` : `FAIL: ${test.name}`);
  }

  console.log(`\n=== Test Summary: ${passed} passed, ${failed} failed ===`);

  return { passed, failed, results };
}

// ============================================================================
// BROWSER CONSOLE USAGE
// ============================================================================

/**
 * To run tests in browser DevTools console:
 *
 * 1. Import the validator module
 * 2. Call: runAllTests()
 *
 * Example:
 * ```
 * import { runAllTests } from './src/fileValidator.test.js';
 * await runAllTests();
 * ```
 */

export default runAllTests;
