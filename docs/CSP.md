# Content Security Policy (CSP) Documentation

## Overview

This document describes the Content Security Policy implementation for Convert To It, including hash-based inline script whitelisting, removed unsafe directives, and violation reporting.

## CSP Directives

### Removed Unsafe Directives

The following previously unsafe directives have been **removed**:

1. **`'unsafe-inline'` from `script-src`**: Replaced with SHA-256 hashes for all inline JSON-LD scripts
2. **`'unsafe-inline'` from `style-src`**: Removed by externalizing inline styles to `/legal.css`

### Required Unsafe Directives (Remaining)

The following unsafe directives remain **necessary** for functionality:

1. **`'wasm-unsafe-eval'` in `script-src`**:
   - **Reason**: Required for WebAssembly module instantiation in the browser
   - **Use Case**: FFmpeg and other WASM-based conversion handlers
   - **Risk Level**: Low - WASM modules are loaded from same-origin or trusted blob URLs
   - **Mitigation**: All WASM modules are bundled with the application and served from 'self'

2. **`blob:` in `script-src`**:
   - **Reason**: Required for dynamic worker scripts and module loading
   - **Use Case**: Service worker communication and dynamic script execution
   - **Risk Level**: Low - only application-generated blobs are used

## Hash-Based Script Whitelisting

All inline JSON-LD structured data scripts are whitelisted using SHA-256 hashes:

| Page | Hash | Content |
|------|------|---------|
| index.html | `sha256:N5iTI6wK…` | WebSite + SoftwareApplication + Organization schema |
| compare/index.html | `sha256:XJnAliKX…` | CollectionPage schema |
| compare/jpg-vs-webp/index.html | `sha256:JYTvlv8Z…` | CollectionPage schema |
| compare/mov-vs-mp4/index.html | `sha256:pB/W/4UO…` | CollectionPage schema |
| compare/pdf-vs-docx/index.html | `sha256:fEBLoLVZ…` | CollectionPage schema |
| compare/png-vs-jpg/index.html | `sha256:UuCf+nek…` | CollectionPage schema |
| compare/svg-vs-png/index.html | `sha256:TktyofWu…` | CollectionPage schema |
| compare/wav-vs-mp3/index.html | `sha256:m2wexLIS…` | CollectionPage schema |
| format/index.html | `sha256:c6PGswtV…` | CollectionPage schema |
| format/jpg-to-png/index.html | `sha256:x6WKV/Y9…` | Article + HowTo + FAQPage schema |
| format/mov-to-mp4/index.html | `sha256:vYHPiXJO…` | Article + HowTo + FAQPage schema |
| format/pdf-to-jpg/index.html | `sha256:wtYLGjwy…` | Article + HowTo + FAQPage schema |
| format/png-to-jpg/index.html | `sha256:6q8JdtM8…` | Article + HowTo + FAQPage schema |
| format/svg-to-png/index.html | `sha256:wV9hSj6o…` | Article + HowTo + FAQPage schema |
| format/wav-to-mp3/index.html | `sha256:eqPg6w1+…` | Article + HowTo + FAQPage schema |
| format/webp-to-png/index.html | `sha256:MayO28U9…` | Article + HowTo + FAQPage schema |

> Note: hashes are shown truncated in this document to avoid triggering secret scanners.

## Violation Reporting

CSP violations are reported to `/csp-violation-report-endpoint` using both:

1. **`report-uri` directive**: Legacy reporting format (widely supported)
2. **`report-to` directive**: Modern Reporting API (with `Reporting-Endpoints` header)

### Viewing Violation Reports

In Cloudflare Pages, violation reports can be monitored through:

1. **Cloudflare Analytics**: Check Real-Time Logs for POST requests to the report endpoint
2. **Browser DevTools**: Open Console to see CSP violation messages in real-time
3. **Cloudflare Workers**: For advanced logging, you can add a Worker function to process reports

## Adding New Inline Scripts

When adding new inline JSON-LD or scripts to pages:

1. **For JSON-LD scripts**: Calculate SHA-256 hash:
   ```bash
   echo -n 'YOUR_SCRIPT_CONTENT' | openssl dgst -sha256 -binary | openssl base64 -A
   ```

2. **Add to CSP**: Append the hash to the `script-src` directive in `public/_headers`:
   ```
   script-src 'self' blob: 'wasm-unsafe-eval'
     'sha256-YOUR_NEW_HASH_HERE'
     # ... existing hashes
   ```

3. **For executable JavaScript**: Prefer external files or modules instead of inline scripts

## Testing CSP

### Manual Testing

1. Open DevTools Console
2. Reload any page
3. Check for CSP violation messages

### Automated Testing

```bash
# Test CSP headers
curl -I https://converttoit.com/ | grep -i content-security-policy
```

## Security Considerations

### Why `wasm-unsafe-eval` is Acceptable

- WebAssembly modules are compiled from our own source code
- All WASM files are bundled during build (Vite/Rollup)
- No arbitrary WASM execution from external sources
- The `wasm-unsafe-eval` keyword only allows WebAssembly instantiation, not arbitrary JavaScript eval

### Future Improvements

1. **Nonce-based CSP**: Consider moving to nonce-based CSP for more dynamic content:
   - Requires server-side rendering or build-time injection
   - More flexible than hash-based CSP for frequently changing content

2. **Strict-dynamic**: For external script loading (if needed in the future)

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| SHA-256 hashes | 40+ | 48+ | 10+ | 79+ |
| report-to | 96+ | 115+ | 16.4+ | 96+ |
| wasm-unsafe-eval | 57+ | 52+ | 11+ | 79+ |

All modern browsers support the current CSP configuration.

## References

- [CSP Level 3 Specification](https://w3c.github.io/webappsec-csp/)
- [MDN: Content-Security-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Reporting API](https://w3c.github.io/reporting/)
