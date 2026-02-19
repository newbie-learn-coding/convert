# CSP Security Hardening - Changes Summary

## Date: 2026-02-19

## Overview

Strengthened the Content Security Policy to remove `'unsafe-inline'` from both `script-src` and `style-src` directives by implementing hash-based whitelisting for static JSON-LD scripts and externalizing inline styles.

## Files Changed

### 1. `/public/_headers` (and `/dist/_headers`)
**Changes:**
- **REMOVED** `'unsafe-inline'` from `script-src` directive
- **REMOVED** `'unsafe-inline'` from `style-src` directive
- **KEPT** `'wasm-unsafe-eval'` in `script-src` (required for WebAssembly)
- **KEPT** `'unsafe-eval'` was NOT present (only `'wasm-unsafe-eval'` for WASM)
- **ADDED** SHA-256 hashes for all inline JSON-LD structured data scripts (16 hashes total)
- **ADDED** CSP violation reporting with both `report-uri` and `report-to` directives
- **ADDED** `Reporting-Endpoints` header for modern browser reporting

**Before:**
```
script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:
style-src 'self' 'unsafe-inline'
```

**After:**
```
script-src 'self' blob: 'wasm-unsafe-eval' 'sha256-...' (16 hashes)
style-src 'self'
```

### 2. `/public/privacy.html` and `/public/terms.html`
**Changes:**
- **REMOVED** Inline `<style>` blocks
- **ADDED** Link to external stylesheet `/legal.css`

### 3. `/public/legal.css` (NEW FILE)
**Purpose:**
- Externalized styles that were previously inline in privacy.html and terms.html
- Removes need for `'unsafe-inline'` in `style-src` directive

### 4. `/public/_redirects`
**Changes:**
- **ADDED** redirect rule for CSP violation endpoint

### 5. `/public/csp-test.html` (NEW FILE)
**Purpose:**
- Test page to verify CSP implementation
- Can be accessed at `/csp-test.html` to check if CSP is working correctly

### 6. `/docs/CSP.md` (NEW FILE)
**Purpose:**
- Complete documentation of CSP implementation
- Includes hash reference table, testing guide, and security considerations

### 7. `/public/csp-violation-report-endpoint/index.html` (NEW FILE)
**Purpose:**
- Endpoint for CSP violation reports
- Returns 204 status for valid reports

## Security Improvements

### What Was Removed

| Directive | Previous Value | New Value | Security Impact |
|-----------|---------------|-----------|-----------------|
| `script-src` | `'unsafe-inline'` | Hash-based whitelisting | **HIGH** - Prevents XSS from injecting inline scripts |
| `style-src` | `'unsafe-inline'` | `'self'` only | **MEDIUM** - Prevents injected styles |

### What Remains (and why)

| Directive | Value | Reason | Risk Level |
|-----------|-------|--------|------------|
| `script-src` | `'wasm-unsafe-eval'` | Required for WebAssembly modules (FFmpeg, etc.) | **LOW** - WASM is from our own bundled code |
| `script-src` | `blob:` | Required for dynamic workers and module loading | **LOW** - Only app-generated blobs |
| `worker-src` | `blob:` | Required for service workers | **LOW** - Service worker is from same origin |

## Hash-Based Whitelisting

All 16 inline JSON-LD scripts (for SEO structured data) are now whitelisted using SHA-256 hashes:

| Hash | Page |
|------|------|
| `N5iTI6wKna0KeIBJxVOJVkzhYC0SdHxiDKGG15mrehA=` | index.html (main) |
| `XJnAliKXVdY3YT+PVbV17QiqFCa95KROtjGWDOkvUi4=` | compare/index.html |
| `JYTvlv8ZqY6bzaECQUYc3yRxbuug7KjZ4WmNQO+LTyA=` | compare/jpg-vs-webp/ |
| `pB/W/4UOZYuGHjdnLNo6SqVDVvCCoecqkQPjys2e534=` | compare/mov-vs-mp4/ |
| `fEBLoLVZE43OpSts8Sx6NVsPgSEyHt8RuvT33GS0nyo=` | compare/pdf-vs-docx/ |
| `UuCf+nekhV69i2vyd+MbtJWeZo2mKRd8UCVfqlL8r1o=` | compare/png-vs-jpg/ |
| `TktyofWuuXgsaEsOyXQUI9gGVW8pXY0AYXBjArzSnvw=` | compare/svg-vs-png/ |
| `m2wexLISFCJ7zK3uGBHJ4iKKaD0UjTZR4O0r/1LrTeg=` | compare/wav-vs-mp3/ |
| `c6PGswtVvYbMS3FRFEMTmYXoC62DpH4CQGHFUvAixZs=` | format/index.html |
| `x6WKV/Y9gBMGTBAdP/p7tRvLh1d10oBNvizdOIh1dh8=` | format/jpg-to-png/ |
| `vYHPiXJOmeEY7V+PSGd/kd8C08Rqn+PBqlbshS8CMHE=` | format/mov-to-mp4/ |
| `wtYLGjwyQPeAHKrAzr3GBa1lLlS+DcioRryGVhfJmTE=` | format/pdf-to-jpg/ |
| `6q8JdtM8SfqyxcZ+zxZVNO34R+psWKKx3m2ayUdrqaQ=` | format/png-to-jpg/ |
| `wV9hSj6oThh3bzpcTYP0P+n6hh+8QmQGxAgpmAAU4fM=` | format/svg-to-png/ |
| `eqPg6w1+Yvpelk9PXZc33vZSEGzVyhPek7YxMP7BRqk=` | format/wav-to-mp3/ |
| `MayO28U9URWWmvbu4LQ6SKPCkQDg7FbHw6FyI/P5KKU=` | format/webp-to-png/ |

## Testing Strategy

### 1. Manual Testing
```bash
# Check CSP headers are present
curl -I https://converttoit.com/ | grep -i content-security-policy

# Visit csp-test.html in browser
open https://converttoit.com/csp-test.html
```

### 2. Browser DevTools
1. Open DevTools Console
2. Reload any page
3. Check for CSP violations

### 3. Test XSS Prevention
The following should now be **blocked**:
- Inline `<script>alert('XSS')</script>` injected via innerHTML
- Inline `<style>` tags injected dynamically
- `eval()` and `new Function()` calls

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| SHA-256 hashes | 40+ | 48+ | 10+ | 79+ |
| report-to | 96+ | 115+ | 16.4+ | 96+ |
| wasm-unsafe-eval | 57+ | 52+ | 11+ | 79+ |

## Deployment

1. Files are updated in both `public/` and `dist/` directories
2. Cloudflare Pages will pick up the new `_headers` file on next deploy
3. No code changes required to the application logic
4. CSP changes take effect immediately on deployment

## Monitoring

CSP violations can be monitored via:
1. **Browser Console**: Real-time violations during development
2. **Cloudflare Analytics**: POST requests to `/csp-violation-report-endpoint`
3. **Future**: Cloudflare Worker function for structured logging

## Remaining Limitations

1. **`wasm-unsafe-eval` Required**: WebAssembly conversion modules require this flag
   - Mitigation: All WASM is bundled during build from our own source

2. **`blob:` in script-src**: Required for dynamic worker creation
   - Mitigation: Only application-generated blobs, never user input

3. **Hash Maintenance**: New JSON-LD scripts require adding hashes
   - Documented process in `/docs/CSP.md`

## Success Criteria

- [x] `'unsafe-inline'` removed from `script-src`
- [x] `'unsafe-inline'` removed from `style-src`
- [x] Hash-based whitelisting for all inline scripts
- [x] CSP violation reporting configured
- [x] Documentation created
- [x] Test page created
- [x] Build verification passed
