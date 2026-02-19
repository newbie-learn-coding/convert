# PWA Verification & Testing Checklist

## Lighthouse PWA Score Checklist

### PWA Criteria (100 points possible)

| Criterion | Status | Notes |
|-----------|--------|-------|
| **HTTP to HTTPS redirect** | N/A | Site uses HTTPS |
| **Configured for custom splash screen** | ✅ | `theme_color`, `background_color`, icons in manifest |
| **Has Apple touch icon** | ✅ | `/apple-touch-icon.png` exists |
| **Has maskable icon** | ✅ | SVG favicon with `purpose: "any maskable"` |
| **Has valid manifest.json** | ✅ | `/manifest.json` with all required fields |
| **Has service worker** | ✅ | `/sw.js` registered in main.ts |
| **Is installable** | ✅ | Manifest with start_url, icons, display mode |
| **Responds with a 200 when offline** | ✅ | SW provides offline fallback for HTML |
| **Contains a content security policy** | ✅ | CSP in `_headers` |
| **Does not register a service worker without JS** | ✅ | SW registered via module script |
| **Redirects HTTP traffic to HTTPS** | ✅ | Cloudflare handles HTTPS |
| **Sets a theme color** | ✅ | `#1C77FF` in manifest and meta |
| **Uses HTTPS** | ✅ | Deployed on Cloudflare Pages |

## Expected Lighthouse PWA Score: **100/100**

## Testing Strategy

### 1. Online Testing

```bash
# Serve locally with service worker support
npx vite serve --host

# Or preview production build
npx vite preview --host
```

**Tests:**
- [ ] App loads and functions normally
- [ ] Service worker registered (check DevTools > Application > Service Workers)
- [ ] Cache storage created (DevTools > Application > Cache Storage)
- [ ] File conversions work
- [ ] Install prompt appears (Chrome/Edge)

### 2. Offline Testing

**Using Chrome DevTools:**
1. Open DevTools > Network tab
2. Check "Offline" throttling
3. Refresh page

**Expected:**
- [ ] App shell loads from cache
- [ ] Offline indicator appears at top
- [ ] Pre-cached WASM modules available
- [ ] Conversions using cached WASM work offline

**Tests:**
- [ ] Navigate to site while offline
- [ ] Attempt image conversion (PNG to JPG) - should work if WASM cached
- [ ] See offline fallback page for uncached routes

### 3. Service Worker Update Testing

```bash
# 1. Register initial SW
# 2. Modify /public/sw.js (change CACHE_VERSION)
# 3. Rebuild
# 4. Refresh - new SW should be detected
# 5. Update notification should appear
# 6. Click update - page should reload
```

**Tests:**
- [ ] Update notification displays
- [ ] Update button activates new SW
- [ ] Old caches are cleaned up
- [ ] Page reloads with new version

### 4. Install Testing

**Desktop (Chrome/Edge):**
- [ ] Address bar shows install icon
- [ ] Click install opens native dialog
- [ ] App installs and opens in standalone window
- [ ] App has proper title and icon
- [ ] App works in standalone mode

**Mobile:**
- [ ] "Add to Home Screen" prompt appears
- [ ] App icon appears on home screen
- [ ] App launches in fullscreen/standalone mode
- [ ] Status bar uses theme color
- [ ] App handles file shares from other apps

### 5. Cache Testing

**Verification Commands (Console):**
```javascript
// Check cache contents
caches.keys().then(keys => console.log(keys));
caches.open('converttoit-precache-v1').then(cache => cache.keys());

// Check SW version
navigator.serviceWorker.controller.postMessage({type: 'GET_VERSION'}, []);

// Clear all caches
window.pwa.clearCache();
```

**Tests:**
- [ ] Static assets (JS, CSS) cached on first load
- [ ] WASM modules pre-cached
- [ ] Cache size limit enforced (50MB)
- [ ] Old caches deleted on update
- [ ] Runtime cache stores converted files

### 6. Cross-Browser Testing

| Browser | SW Support | Installable | Notes |
|---------|------------|-------------|-------|
| Chrome 90+ | ✅ | ✅ | Full support |
| Edge 90+ | ✅ | ✅ | Full support |
| Firefox 90+ | ✅ | ❌ | No install prompt |
| Safari 16.4+ | ✅ | ✅ | iOS install support |
| Samsung Internet | ✅ | ✅ | Full support |

## Browser Compatibility Notes

### Service Worker Support
- Chrome/Edge: Full support
- Firefox: Supported, no install UI
- Safari 16.4+: Supported on iOS/macOS
- Safari < 16.4: SW supported, but no install prompt

### Known Limitations

1. **Firefox Desktop**: No native install UI, users must manually add site
2. **Safari iOS < 16.4**: Service worker support limited, no install prompt
3. **Edge Legacy**: Not supported (use Edge Chromium)

### Progressive Enhancement
The app gracefully degrades:
- No SW: App works normally, just no offline support
- No install: Users can still use via browser
- Offline mode: Core conversions work if WASM pre-cached

## Cache Strategy Details

### Pre-Cache (v1)
```
/, style.css, cache.json, icons, favicon
```

### WASM Cache (v1)
```
reflo_bg.wasm, magick.wasm, libopenmpt.wasm
```

### Runtime Cache
- Network-first for: cache.json, dynamic content
- Cache-first for: JS, CSS, WASM, images, fonts
- Stale-while-revalidate for: HTML pages

### Cache Limits
- Max size: 50MB
- Expiration: 30 days
- Versioned cleanup on SW update

## CI/CD Integration

Add to build process:
```bash
# Generate PWA icons
bash scripts/generate-pwa-icons.sh

# Build with PWA files
npm run build

# Verify manifest syntax
cat dist/manifest.json | jq .

# Verify service worker syntax
node -c dist/sw.js
```

## Production Deployment

1. Deploy to Cloudflare Pages
2. Verify `_headers` includes SW headers
3. Test HTTPS redirect
4. Validate manifest at `https://converttoit.com/manifest.json`
5. Test install on real devices

## Troubleshooting

### SW not registering
- Check console for errors
- Verify `/sw.js` is accessible
- Check CSP allows `worker-src 'self'`

### App not installable
- Verify manifest at `/manifest.json`
- Check icons exist at specified paths
- Verify `start_url` returns 200
- Ensure HTTPS

### Offline not working
- Verify cache populated (DevTools > Application > Cache)
- Check SW is active (not just waiting)
- Verify assets are cacheable (not no-cache)

### Update not showing
- Force refresh (Ctrl+Shift+R)
- Check SW version changed
- Verify `skipWaiting()` called
