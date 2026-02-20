/**
 * Unit Tests for File Validator Module
 * Tests file signature validation, format detection, and security checks
 */

import { describe, it, expect, beforeEach } from "bun:test";
import {
  validateFileSignature,
  getFileExtension,
  formatNameFromMime,
  validateMultipleFiles,
  type ValidationResult,
  type FileFormatInfo
} from "./fileValidator.js";

// ============================================================================
// TEST HELPERS
// ============================================================================

function createMockFile(filename: string, bytes: number[], type = "application/octet-stream"): File {
  const uint8Array = new Uint8Array(bytes);
  const blob = new Blob([uint8Array], { type });
  return new File([blob], filename, { type });
}

function createMockFileFromHex(filename: string, hexString: string, type = "application/octet-stream"): File {
  let normalizedHex = hexString.replace(/[^0-9a-f]/gi, "");
  // For test fixtures, tolerate accidental odd-length inputs by dropping the trailing nibble.
  if (normalizedHex.length % 2 !== 0) {
    normalizedHex = normalizedHex.slice(0, -1);
  }
  const bytes: number[] = [];
  for (let i = 0; i < normalizedHex.length; i += 2) {
    bytes.push(parseInt(normalizedHex.substr(i, 2), 16));
  }
  return createMockFile(filename, bytes, type);
}

// ============================================================================
// VALID FILE SIGNATURE TESTS
// ============================================================================

describe("File Validator - Valid File Signatures", () => {
  it("should validate PNG files correctly", async () => {
    const file = createMockFileFromHex("image.png", "89504E47 0D0A1A0A 0000000D 49484452");
    const result = await validateFileSignature(file);

    expect(result.valid).toBe(true);
    expect(result.detectedFormat).not.toBeNull();
    expect(result.detectedFormat?.name).toBe("PNG");
    expect(result.detectedFormat?.extension).toBe("png");
    expect(result.detectedFormat?.mime).toBe("image/png");
    expect(result.detectedFormat?.category).toBe("image");
  });

  it("should validate JPEG files correctly", async () => {
    const file = createMockFileFromHex("photo.jpg", "FFD8FFE000104A4649460001");
    const result = await validateFileSignature(file);

    expect(result.valid).toBe(true);
    expect(result.detectedFormat?.name).toBe("JPEG");
    expect(result.detectedFormat?.extension).toBe("jpg");
    expect(result.detectedFormat?.mime).toBe("image/jpeg");
  });

  it("should validate GIF87a files correctly", async () => {
    const file = createMockFileFromHex("animation.gif", "47494638376139000100");
    const result = await validateFileSignature(file);

    expect(result.valid).toBe(true);
    expect(result.detectedFormat?.name).toBe("GIF");
    expect(result.detectedFormat?.extension).toBe("gif");
  });

  it("should validate GIF89a files correctly", async () => {
    const file = createMockFileFromHex("animation.gif", "47494638396139000100");
    const result = await validateFileSignature(file);

    expect(result.valid).toBe(true);
    expect(result.detectedFormat?.name).toBe("GIF");
  });

  it("should validate WebP files correctly", async () => {
    const file = createMockFileFromHex("image.webp", "524946460000000057454250");
    const result = await validateFileSignature(file);

    expect(result.valid).toBe(true);
    expect(result.detectedFormat?.name).toBe("WebP");
    expect(result.detectedFormat?.extension).toBe("webp");
  });

  it("should validate BMP files correctly", async () => {
    const file = createMockFileFromHex("image.bmp", "424D3600 00000000 00003600 00002800");
    const result = await validateFileSignature(file);

    expect(result.valid).toBe(true);
    expect(result.detectedFormat?.name).toBe("BMP");
  });

  it("should validate PDF files correctly", async () => {
    const file = createMockFileFromHex("document.pdf", "255044462D312E340A25C4B5D6074");
    const result = await validateFileSignature(file);

    expect(result.valid).toBe(true);
    expect(result.detectedFormat?.name).toBe("PDF");
    expect(result.detectedFormat?.extension).toBe("pdf");
    expect(result.detectedFormat?.mime).toBe("application/pdf");
  });

  it("should validate MP3 files with MPEG header", async () => {
    const file = createMockFileFromHex("audio.mp3", "FFFB9000000000000000");
    const result = await validateFileSignature(file);

    expect(result.valid).toBe(true);
    expect(result.detectedFormat?.name).toBe("MP3");
  });

  it("should validate MP3 files with ID3 tag", async () => {
    const file = createMockFileFromHex("audio.mp3", "49443304000000000000");
    const result = await validateFileSignature(file);

    expect(result.valid).toBe(true);
    expect(result.detectedFormat?.name).toBe("MP3");
  });

  it("should validate OGG files correctly", async () => {
    const file = createMockFileFromHex("audio.ogg", "4F67675300000000000000000000");
    const result = await validateFileSignature(file);

    expect(result.valid).toBe(true);
    expect(result.detectedFormat?.name).toBe("OGG");
  });

  it("should validate FLAC files correctly", async () => {
    const file = createMockFileFromHex("audio.flac", "664C61430000000022000000");
    const result = await validateFileSignature(file);

    expect(result.valid).toBe(true);
    expect(result.detectedFormat?.name).toBe("FLAC");
  });

  it("should validate RAR files correctly", async () => {
    const file = createMockFileFromHex("archive.rar", "526172211A0700CF907300");
    const result = await validateFileSignature(file);

    expect(result.valid).toBe(true);
    expect(result.detectedFormat?.name).toBe("RAR");
  });

  it("should validate 7Z files correctly", async () => {
    const file = createMockFileFromHex("archive.7z", "377ABCAF271C00040000");
    const result = await validateFileSignature(file);

    expect(result.valid).toBe(true);
    expect(result.detectedFormat?.name).toBe("7Z");
  });

  it("should validate ICO files correctly", async () => {
    const file = createMockFileFromHex("icon.ico", "000001000100101000000");
    const result = await validateFileSignature(file);

    expect(result.valid).toBe(true);
    expect(result.detectedFormat?.name).toBe("ICO");
  });

  it("should validate SVG files correctly", async () => {
    const file = createMockFileFromHex("image.svg", "3C73766720786D6C6E733D22");
    const result = await validateFileSignature(file);

    expect(result.valid).toBe(true);
    expect(result.detectedFormat?.name).toBe("SVG");
  });

  it("should validate PSD files correctly", async () => {
    const file = createMockFileFromHex("photo.psd", "38425053000000030000");
    const result = await validateFileSignature(file);

    expect(result.valid).toBe(true);
    expect(result.detectedFormat?.name).toBe("PSD");
  });

  it("should validate JSON files correctly", async () => {
    const file = createMockFile("data.json", [0x7B, 0x22, 0x6B, 0x65, 0x79, 0x22, 0x3A, 0x7D]);
    const result = await validateFileSignature(file);

    expect(result.valid).toBe(true);
    expect(result.detectedFormat?.name).toBe("JSON");
  });

  it("should validate JSON array files correctly", async () => {
    const file = createMockFile("data.json", [0x5B, 0x5D]);
    const result = await validateFileSignature(file);

    expect(result.valid).toBe(true);
    expect(result.detectedFormat?.name).toBe("JSON");
  });
});

// ============================================================================
// EXTENSION SPOOFING DETECTION TESTS
// ============================================================================

describe("File Validator - MIME Type Spoofing Detection", () => {
  it("should detect JPEG file spoofed as PNG", async () => {
    const file = createMockFileFromHex("fake.png", "FFD8FFE000104A4649460001");
    const result = await validateFileSignature(file);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("JPEG");
    expect(result.detectedFormat?.name).toBe("JPEG");
  });

  it("should detect PDF file spoofed as DOC", async () => {
    const file = createMockFileFromHex("fake.doc", "255044462D312E340A25C4B5D6074");
    const result = await validateFileSignature(file);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("PDF");
  });

  it("should detect RAR file spoofed as ZIP", async () => {
    const file = createMockFileFromHex("fake.zip", "526172211A0700CF907300");
    const result = await validateFileSignature(file);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("RAR");
  });
});

// ============================================================================
// EDGE CASE TESTS
// ============================================================================

describe("File Validator - Edge Cases", () => {
  it("should reject empty files", async () => {
    const file = createMockFile("empty.txt", []);
    const result = await validateFileSignature(file);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("empty");
    expect(result.detectedFormat).toBeNull();
  });

  it("should handle truncated files gracefully", async () => {
    const file = createMockFileFromHex("broken.png", "89504E47");
    const result = await validateFileSignature(file);

    // Should pass validation but with limited info (truncated PNG)
    expect(result.valid).toBe(true);
  });

  it("should handle files with leading whitespace for JSON", async () => {
    const file = createMockFile("data.json", [0x20, 0x20, 0x09, 0x7B, 0x22, 0x6B, 0x65, 0x79, 0x22, 0x3A, 0x7D]);
    const result = await validateFileSignature(file);

    expect(result.valid).toBe(true);
    expect(result.detectedFormat?.name).toBe("JSON");
  });

  it("should allow unknown formats to pass", async () => {
    // Create a file with unknown signature
    const file = createMockFile("unknown.xyz", [0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
    const result = await validateFileSignature(file);

    // Unknown formats should pass (valid: true) but with null detectedFormat
    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe("File Validator - Helper Functions", () => {
  describe("getFileExtension", () => {
    it("should extract extension from simple filename", () => {
      expect(getFileExtension("image.png")).toBe("png");
    });

    it("should extract extension and convert to lowercase", () => {
      expect(getFileExtension("image.PNG")).toBe("png");
    });

    it("should handle files with multiple dots", () => {
      expect(getFileExtension("archive.tar.gz")).toBe("gz");
    });

    it("should return empty string for files without extension", () => {
      expect(getFileExtension("README")).toBe("");
    });

    it("should return extension for dotfiles with extension", () => {
      // .gitignore actually has "gitignore" as extension after the dot
      expect(getFileExtension(".gitignore")).toBe("gitignore");
    });

    it("should handle empty string", () => {
      expect(getFileExtension("")).toBe("");
    });
  });

  describe("formatNameFromMime", () => {
    it("should return correct name for common MIME types", () => {
      expect(formatNameFromMime("image/png")).toBe("PNG");
      expect(formatNameFromMime("image/jpeg")).toBe("JPEG");
      expect(formatNameFromMime("image/gif")).toBe("GIF");
      expect(formatNameFromMime("image/webp")).toBe("WebP");
      expect(formatNameFromMime("application/pdf")).toBe("PDF");
      expect(formatNameFromMime("application/zip")).toBe("ZIP");
    });

    it("should handle unknown MIME types gracefully", () => {
      expect(formatNameFromMime("application/x-custom")).toBe("X-CUSTOM");
    });

    it("should handle SVG MIME type", () => {
      expect(formatNameFromMime("image/svg+xml")).toBe("SVG");
    });
  });

  describe("validateMultipleFiles", () => {
    it("should validate multiple files in parallel", async () => {
      const files = [
        createMockFileFromHex("image1.png", "89504E47 0D0A1A0A 0000000D 49484452"),
        createMockFileFromHex("image2.jpg", "FFD8FFE000104A4649460001"),
        createMockFileFromHex("doc.pdf", "255044462D312E340A25C4B5D6074")
      ];

      const results = await validateMultipleFiles(files);

      expect(results).toHaveLength(3);
      expect(results[0].valid).toBe(true);
      expect(results[0].detectedFormat?.name).toBe("PNG");
      expect(results[1].valid).toBe(true);
      expect(results[1].detectedFormat?.name).toBe("JPEG");
      expect(results[2].valid).toBe(true);
      expect(results[2].detectedFormat?.name).toBe("PDF");
    });

    it("should handle mixed valid and invalid files", async () => {
      const files = [
        createMockFileFromHex("valid.png", "89504E47 0D0A1A0A 0000000D 49484452"),
        createMockFileFromHex("spoofed.png", "FFD8FFE000104A4649460001"), // JPEG as PNG
        createMockFile("empty.txt", [])
      ];

      const results = await validateMultipleFiles(files);

      expect(results[0].valid).toBe(true);
      expect(results[1].valid).toBe(false);
      expect(results[2].valid).toBe(false);
    });
  });
});

// ============================================================================
// COMPATIBLE EXTENSION TESTS
// ============================================================================

describe("File Validator - Compatible Extensions", () => {
  it("should allow jpg/jpeg interchangeably", async () => {
    const jpegFile = createMockFileFromHex("image.jpeg", "FFD8FFE000104A4649460001");
    const result = await validateFileSignature(jpegFile);

    expect(result.valid).toBe(true);
  });

  it("should allow jpg/jfif interchangeably", async () => {
    const jfifFile = createMockFileFromHex("image.jfif", "FFD8FFE000104A4649460001");
    const result = await validateFileSignature(jfifFile);

    expect(result.valid).toBe(true);
  });

  it("should allow tiff/tif interchangeably", async () => {
    const tifFile = createMockFileFromHex("image.tif", "49492A0008000000");
    const result = await validateFileSignature(tifFile);

    expect(result.valid).toBe(true);
    expect(result.detectedFormat?.name).toBe("TIFF");
  });

  it("should allow htm/html interchangeably", async () => {
    const htmFile = createMockFileFromHex("page.htm", "3C68746D6C3E");
    const result = await validateFileSignature(htmFile);

    expect(result.valid).toBe(true);
  });
});
