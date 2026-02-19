# Content Security Policy (CSP) Documentation

## Overview

This document describes the Content Security Policy implementation for ConvertToIt, including hash-based inline script whitelisting, removed unsafe directives, and violation reporting.

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
| index.html | `N5iTI6wKna0KeIBJxVOJVkzhYC0SdHxiDKGG15mrehA=` | WebSite + SoftwareApplication + Organization schema |
| compare/index.html | `XJnAliKXVdY3YT+PVbV17QiqFCa95KROtjGWDOkvUi4=` | CollectionPage schema |
| compare/jpg-vs-webp/index.html | `JYTvlv8ZqY6bzaECQUYc3yRxbuug7KjZ4WmNQO+LTyA=` | CollectionPage schema |
| compare/mov-vs-mp4/index.html | `pB/W/4UOZYuGHjdnLNo6SqVDVvCCoecqkQPjys2e534=` | CollectionPage schema |
| compare/pdf-vs-docx/index.html | `fEBLoLVZE43OpSts8Sx6NVsPgSEyHt8RuvT33GS0nyo=` | CollectionPage schema |
| compare/png-vs-jpg/index.html | `UuCf+nekhV69i2vyd+MbtJWeZo2mKRd8UCVfqlL8r1o=` | CollectionPage schema |
| compare/svg-vs-png/index.html | `TktyofWuuXgsaEsOyXQUI9gGVW8pXY0AYXBjArzSnvw=` | CollectionPage schema |
| compare/wav-vs-mp3/index.html | `m2wexLISFCJ7zK3uGBHJ4iKKaD0UjTZR4O0r/1LrTeg=` | CollectionPage schema |
| format/index.html | `c6PGswtVvYbMS3FRFEMTmYXoC62DpH4CQGHFUvAixZs=` | CollectionPage schema |
| format/jpg-to-png/index.html | `x6WKV/Y9gBMGTBAdP/p7tRvLh1d10oBNvizdOIh1dh8=` | Article + HowTo + FAQPage schema |
| format/mov-to-mp4/index.html | `vYHPiXJOmeEY7V+PSGd/kd8C08Rqn+PBqlbshS8CMHE=` | Article + HowTo + FAQPage schema |
| format/pdf-to-jpg/index.html | `wtYLGjwyQPeAHKrAzr3GBa1lLlS+DcioRryGVhfJmTE=` | Article + HowTo + FAQPage schema |
| format/png-to-jpg/index.html | `6q8JdtM8SfqyxcZ+zxZVNO34R+psWKKx3m2ayUdrqaQ=` | Article + HowTo + FAQPage schema |
| format/svg-to-png/index.html | `wV9hSj6oThh3bzpcTYP0P+n6hh+8QmQGxAgpmAAU4fM=` | Article + HowTo + FAQPage schema |
| format/wav-to-mp3/index.html | `eqPg6w1+Yvpelk9PXZc33vZSEGzVyhPek7YxMP7BRqk=` | Article + HowTo + FAQPage schema |
| format/webp-to-png/index.html | `MayO28U9URWWmvbu4LQ6SKPCkQDg7FbHw6FyI/P5KKU=` | Article + HowTo + FAQPage schema |

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
