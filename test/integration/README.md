# Integration Tests

This directory contains comprehensive integration tests for the file conversion application using Puppeteer for browser automation.

## Test Structure

```
test/integration/
├── test-helpers.ts           # Common utilities and fixtures
├── conversion-flows.test.ts  # Tests for format conversions
├── error-handling.test.ts    # Tests for error scenarios
├── ui-interactions.test.ts   # Tests for UI interactions
├── accessibility.test.ts     # WCAG accessibility tests
├── large-files.test.ts       # Memory and performance tests
├── browser-compatibility.test.ts # Cross-browser compatibility tests
└── index.test.ts             # Test suite entry point
```

## Prerequisites

1. **Build the application first**: Tests require a built `dist/` directory
   ```bash
   bun run build
   ```

2. **Install dependencies**:
   ```bash
   bun install
   ```

## Running Tests

### Run All Integration Tests
```bash
bun run test:integration
```

### Run Specific Test Suites
```bash
# Conversion flow tests
bun run test:integration:flows

# Error handling tests
bun run test:integration:errors

# UI interaction tests
bun run test:integration:ui

# Accessibility tests
bun run test:integration:a11y

# Large file handling tests
bun run test:integration:large

# Browser compatibility tests
bun run test:integration:compat
```

### Run with Debug Output
```bash
DEBUG=true bun test test/integration/conversion-flows.test.ts
```

## Test Coverage

### Conversion Flows (`conversion-flows.test.ts`)
- PNG to JPEG, WEBP, SVG conversions
- MP4 to GIF, PNG conversions
- MP3 to WAV, OGG conversions
- DOCX to PDF conversion
- Markdown to HTML conversion
- Cross-category conversions (image to video, audio to image)
- Multi-step conversion paths

### Error Handling (`error-handling.test.ts`)
- File validation and MIME spoofing detection
- Unsupported format handling
- Corrupted file handling
- Large file memory management
- Special characters in filenames
- Unicode filename support
- Resource cleanup verification

### UI Interactions (`ui-interactions.test.ts`)
- File upload methods (click, drag-drop, input)
- Format selection and auto-detection
- Search functionality
- Convert button state management
- Mode toggle (simple/advanced)
- Popup and notifications
- Keyboard navigation

### Accessibility (`accessibility.test.ts`)
- ARIA labels and roles
- Keyboard navigation
- Screen reader support
- Color and contrast
- Semantic HTML
- Reduced motion support
- WCAG compliance (via axe-core)

### Large Files (`large-files.test.ts`)
- Memory management for 1MB+ files
- File size limit enforcement
- Performance benchmarks
- Concurrent operation handling
- Virtual list efficiency

### Browser Compatibility (`browser-compatibility.test.ts`)
- Modern JavaScript feature detection
- Web API support (File, Blob, Clipboard, DnD)
- CSS feature support (Grid, Flexbox, Variables)
- Cross-browser conversion tests
- Graceful degradation
- Mobile browser compatibility

## Writing New Tests

1. **Use the test helpers** from `test-helpers.ts`:
   ```typescript
   import {
     createTestContext,
     cleanupTestContext,
     waitForAppReady,
     attemptConversion,
     TestFixtures
   } from "./test-helpers.js";
   ```

2. **Follow the test structure**:
   ```typescript
   describe("Integration: My Feature", () => {
     let context: Awaited<ReturnType<typeof createTestContext>>;

     beforeAll(async () => {
       context = await createTestContext(8087); // Unique port
       await waitForAppReady(context.page);
     }, 60000);

     afterAll(async () => {
       await cleanupTestContext(context);
     });

     test("my test case", async () => {
       // Test code here
     });
   });
   ```

3. **Use appropriate timeouts** - Browser tests can be slow:
   ```typescript
   test("slow conversion", async () => {
     // ...
   }, 60000); // 60 second timeout
   ```

## Test Fixtures

Test files are located in `test/resources/`:
- `colors_50x50.png` - Small PNG image for quick tests
- `doom.mp4` - Sample video file
- `gaster.mp3` - Sample audio file
- `word.docx` - Sample Word document
- `markdown.md` - Sample markdown file

## Troubleshooting

### Tests Fail with "App did not initialize"
- Ensure you've built the application: `bun run build`
- Check that `dist/convert/index.html` exists

### Browser Launch Errors
- Ensure Puppeteer is installed: `bun install`
- On some systems, you may need additional system libraries for Chromium

### Port Already in Use
- Each test suite uses a different port (8080-8087)
- If running multiple suites simultaneously, ports may conflict
- Wait for previous test run to complete

## CI/CD Integration

The integration tests are configured to run in GitHub Actions via `.github/workflows/integration-tests.yml`. They run on:
- Pull requests
- Push to master branch
- Manual workflow dispatch

## Coverage

To generate a coverage report:
```bash
bun run test:integration --coverage
```

## License

MIT
