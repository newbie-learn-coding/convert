import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PRIMARY_DOMAIN = "https://converttoit.com";
const LEGACY_HOST = "converttoit.app";
const LEGACY_HOST_ALLOWLIST = new Set([
  "public/seo/domain-policy.json",
  "scripts/build-pseo.mjs"
]);

const errors = [];

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function readFile(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  try {
    return fs.readFileSync(absolutePath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`${relativePath}: unable to read file (${message})`);
    return "";
  }
}

function listFiles(relativeDir, predicate) {
  const dir = path.join(ROOT, relativeDir);
  if (!fs.existsSync(dir)) return [];

  const output = [];
  const stack = [dir];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }
      const relativePath = toPosix(path.relative(ROOT, absolutePath));
      if (!predicate || predicate(relativePath)) {
        output.push(relativePath);
      }
    }
  }

  return output.sort();
}

function expectedCanonicalForFile(relativePath) {
  if (relativePath === "index.html") {
    return `${PRIMARY_DOMAIN}/`;
  }

  const publicPrefix = "public/";
  if (!relativePath.startsWith(publicPrefix)) {
    return null;
  }

  const publicRelative = relativePath.slice(publicPrefix.length);
  if (publicRelative.endsWith("/index.html")) {
    const routePath = publicRelative.slice(0, -"index.html".length);
    return `${PRIMARY_DOMAIN}/${routePath}`;
  }

  return `${PRIMARY_DOMAIN}/${publicRelative}`;
}

function getMatch(content, regex) {
  const match = content.match(regex);
  return match?.[1] ?? null;
}

function getAllMatches(content, regex) {
  return [...content.matchAll(regex)].map((match) => match[1]);
}

function getAlternateLinks(content) {
  const tags = [...content.matchAll(/<link[^>]*rel=["']alternate["'][^>]*>/gi)].map((match) => match[0]);
  return tags
    .map((tag) => {
      const hreflang = getMatch(tag, /hreflang=["']([^"']+)["']/i);
      const href = getMatch(tag, /href=["']([^"']+)["']/i);
      if (!hreflang || !href) return null;
      return { hreflang: hreflang.toLowerCase(), href };
    })
    .filter(Boolean);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasMetaContentTag(html, attr, value) {
  const pattern = new RegExp(
    `<meta[^>]*${attr}=["']${escapeRegex(value)}["'][^>]*content=["']([^"']+)["']`,
    "i"
  );
  return pattern.test(html);
}

function getMetaContent(html, attr, value) {
  const pattern = new RegExp(
    `<meta[^>]*${attr}=["']${escapeRegex(value)}["'][^>]*content=["']([^"']+)["']`,
    "i"
  );
  return getMatch(html, pattern);
}

function collectInternalLinks(html) {
  const hrefTargets = getAllMatches(html, /href=["']([^"']+)["']/gi);
  return hrefTargets
    .filter((href) => href.startsWith("/") || href.startsWith(`${PRIMARY_DOMAIN}/`))
    .map((href) => href.startsWith(PRIMARY_DOMAIN) ? href.slice(PRIMARY_DOMAIN.length) : href);
}

function requiresStructuredData(relativePath) {
  return (
    relativePath === "index.html"
    || relativePath.startsWith("public/format/")
    || relativePath.startsWith("public/compare/")
  );
}

function hasStructuredData(html) {
  return (
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?"@context"\s*:\s*"https:\/\/schema\.org"/i.test(html)
    || /<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?"@context"\s*:\s*"http:\/\/schema\.org"/i.test(html)
  );
}

function requiresFaqValidation(html) {
  return (
    /itemtype=["']https:\/\/schema\.org\/FAQPage["']/i.test(html)
    || /<h2[^>]*>\s*FAQ\b/i.test(html)
  );
}

function hasFaqSchema(html) {
  return (
    /"@type"\s*:\s*"FAQPage"/i.test(html)
    || /itemtype=["']https:\/\/schema\.org\/FAQPage["']/i.test(html)
  );
}

function checkHtmlDomainPolicy(relativePath) {
  const html = readFile(relativePath);
  const title = getMatch(html, /<title>([^<]+)<\/title>/i);
  if (!title) {
    errors.push(`${relativePath}: missing title tag`);
  } else if (title.trim().length < 20 || title.trim().length > 70) {
    errors.push(`${relativePath}: title length should stay between 20 and 70 characters (found ${title.trim().length})`);
  }

  const metaDescription = getMatch(html, /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  if (!metaDescription) {
    errors.push(`${relativePath}: missing meta description`);
  } else if (metaDescription.trim().length < 80 || metaDescription.trim().length > 180) {
    errors.push(
      `${relativePath}: meta description length should stay between 80 and 180 characters (found ${metaDescription.trim().length})`
    );
  }

  const robotsMeta = getMatch(html, /<meta[^>]*name=["']robots["'][^>]*content=["']([^"']+)["']/i);
  if (!robotsMeta) {
    errors.push(`${relativePath}: missing robots meta tag`);
  } else if (/noindex/i.test(robotsMeta)) {
    errors.push(`${relativePath}: robots meta must not contain noindex (${robotsMeta})`);
  }

  const canonical = getMatch(html, /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  const expectedCanonical = expectedCanonicalForFile(relativePath);

  if (!canonical) {
    errors.push(`${relativePath}: missing canonical link`);
  } else {
    if (!canonical.startsWith(PRIMARY_DOMAIN)) {
      errors.push(`${relativePath}: canonical must use ${PRIMARY_DOMAIN} (found: ${canonical})`);
    }

    if (canonical.includes(LEGACY_HOST)) {
      errors.push(`${relativePath}: canonical leaks legacy host (${canonical})`);
    }

    if (expectedCanonical && canonical !== expectedCanonical) {
      errors.push(`${relativePath}: canonical mismatch (expected ${expectedCanonical}, found ${canonical})`);
    }
  }

  const alternates = getAlternateLinks(html);
  for (const requiredLanguage of ["en", "x-default"]) {
    const match = alternates.find((entry) => entry.hreflang === requiredLanguage);
    if (!match) {
      errors.push(`${relativePath}: missing hreflang alternate for ${requiredLanguage}`);
      continue;
    }
    if (!match.href.startsWith(PRIMARY_DOMAIN)) {
      errors.push(`${relativePath}: hreflang ${requiredLanguage} must use ${PRIMARY_DOMAIN} (found: ${match.href})`);
    }
    if (match.href.includes(LEGACY_HOST)) {
      errors.push(`${relativePath}: hreflang ${requiredLanguage} leaks legacy host (${match.href})`);
    }
    if (expectedCanonical && match.href !== expectedCanonical) {
      errors.push(
        `${relativePath}: hreflang ${requiredLanguage} mismatch (expected ${expectedCanonical}, found ${match.href})`
      );
    }
  }

  const ogUrl = getMatch(html, /<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["']/i);
  if (ogUrl) {
    if (!ogUrl.startsWith(PRIMARY_DOMAIN)) {
      errors.push(`${relativePath}: og:url must use ${PRIMARY_DOMAIN} (found: ${ogUrl})`);
    }
    if (expectedCanonical && ogUrl !== expectedCanonical) {
      errors.push(`${relativePath}: og:url mismatch (expected ${expectedCanonical}, found ${ogUrl})`);
    }
  }

  for (const ogTag of ["og:title", "og:description", "og:image", "og:url"]) {
    if (!hasMetaContentTag(html, "property", ogTag)) {
      errors.push(`${relativePath}: missing Open Graph tag ${ogTag}`);
    }
  }

  for (const twitterTag of ["twitter:card", "twitter:title", "twitter:description", "twitter:image"]) {
    if (!hasMetaContentTag(html, "name", twitterTag)) {
      errors.push(`${relativePath}: missing Twitter tag ${twitterTag}`);
    }
  }

  const twitterCard = getMetaContent(html, "name", "twitter:card");
  if (twitterCard && twitterCard !== "summary_large_image") {
    errors.push(`${relativePath}: twitter:card should be summary_large_image (found ${twitterCard})`);
  }

  if (requiresStructuredData(relativePath) && !hasStructuredData(html)) {
    errors.push(`${relativePath}: missing schema.org JSON-LD structured data`);
  }

  if (requiresFaqValidation(html) && !hasFaqSchema(html)) {
    errors.push(`${relativePath}: FAQ section detected but FAQ schema is missing`);
  }

  const internalLinks = collectInternalLinks(html);
  if (relativePath === "index.html") {
    if (!internalLinks.some((href) => href.startsWith("/format/"))) {
      errors.push("index.html: missing internal links to /format/ pages");
    }
    if (!internalLinks.some((href) => href.startsWith("/compare/"))) {
      errors.push("index.html: missing internal links to /compare/ pages");
    }
  }

  if (relativePath.startsWith("public/format/") || relativePath.startsWith("public/compare/")) {
    if (internalLinks.length < 5) {
      errors.push(`${relativePath}: expected at least 5 internal links, found ${internalLinks.length}`);
    }
    if (!internalLinks.some((href) => href.startsWith("/format/"))) {
      errors.push(`${relativePath}: missing internal reference to /format/`);
    }
    if (!internalLinks.some((href) => href.startsWith("/compare/"))) {
      errors.push(`${relativePath}: missing internal reference to /compare/`);
    }
  }

  const hrefTargets = getAllMatches(html, /href=["']([^"']+)["']/gi);
  for (const href of hrefTargets) {
    if (href.includes(LEGACY_HOST)) {
      errors.push(`${relativePath}: leaked legacy host in href (${href})`);
      break;
    }
  }

  const srcTargets = getAllMatches(html, /src=["']([^"']+)["']/gi);
  for (const src of srcTargets) {
    if (src.includes(LEGACY_HOST)) {
      errors.push(`${relativePath}: leaked legacy host in src (${src})`);
      break;
    }
  }
}

function checkRedirectFile(relativePath, expectedRules) {
  const lines = readFile(relativePath)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  for (const rule of expectedRules) {
    if (!lines.includes(rule)) {
      errors.push(`${relativePath}: missing redirect rule -> ${rule}`);
    }
  }

  for (const line of lines) {
    if (line.includes(LEGACY_HOST) && !line.includes("https://converttoit.com/:splat")) {
      errors.push(`${relativePath}: invalid legacy-host redirect target -> ${line}`);
    }
  }
}

const SEO_EXCLUDE_PREFIXES = [
  "public/csp-",  // CSP test and violation report endpoints are utility pages
];

function shouldSkipSeoCheck(relativePath) {
  return SEO_EXCLUDE_PREFIXES.some(prefix => relativePath.startsWith(prefix));
}

const htmlFiles = [
  "index.html",
  ...listFiles("public", (relativePath) => relativePath.endsWith(".html"))
].filter(path => !shouldSkipSeoCheck(path));

for (const htmlFile of htmlFiles) {
  checkHtmlDomainPolicy(htmlFile);
}

const robots = readFile("public/robots.txt");
if (!robots.includes(`Sitemap: ${PRIMARY_DOMAIN}/sitemap.xml`)) {
  errors.push("public/robots.txt: missing or incorrect sitemap URL");
}
if (robots.includes(LEGACY_HOST)) {
  errors.push("public/robots.txt: legacy host leak detected");
}
for (const requiredRule of ["Allow: /", "Disallow: /*?*", "Disallow: /csp-violation-report-endpoint/"]) {
  if (!robots.includes(requiredRule)) {
    errors.push(`public/robots.txt: missing crawl rule -> ${requiredRule}`);
  }
}

const sitemapXml = readFile("public/sitemap.xml");
const sitemapLocs = getAllMatches(sitemapXml, /<loc>([^<]+)<\/loc>/g);
if (sitemapLocs.length === 0) {
  errors.push("public/sitemap.xml: no <loc> entries found");
}
for (const loc of sitemapLocs) {
  if (!loc.startsWith(`${PRIMARY_DOMAIN}/`)) {
    errors.push(`public/sitemap.xml: non-primary domain URL -> ${loc}`);
  }
  if (loc.includes(LEGACY_HOST)) {
    errors.push(`public/sitemap.xml: legacy host leak -> ${loc}`);
  }
}

const sitemapLocSet = new Set(sitemapLocs);
for (const requiredUrl of [
  `${PRIMARY_DOMAIN}/`,
  `${PRIMARY_DOMAIN}/format/`,
  `${PRIMARY_DOMAIN}/compare/`,
  `${PRIMARY_DOMAIN}/privacy.html`,
  `${PRIMARY_DOMAIN}/terms.html`
]) {
  if (!sitemapLocSet.has(requiredUrl)) {
    errors.push(`public/sitemap.xml: missing required URL -> ${requiredUrl}`);
  }
}

const keywordIntentRaw = readFile("public/seo/keyword-intent-map.json");
if (keywordIntentRaw) {
  try {
    const keywordIntentMap = JSON.parse(keywordIntentRaw);
    const entries = Array.isArray(keywordIntentMap?.entries) ? keywordIntentMap.entries : [];
    const seenUrls = new Set();

    for (const entry of entries) {
      if (!entry?.url || typeof entry.url !== "string") {
        errors.push("public/seo/keyword-intent-map.json: each entry must include a url string");
        continue;
      }
      if (!entry.url.startsWith("/format/") && !entry.url.startsWith("/compare/")) {
        errors.push(`public/seo/keyword-intent-map.json: invalid entry URL family -> ${entry.url}`);
      }
      if (!entry.url.endsWith("/")) {
        errors.push(`public/seo/keyword-intent-map.json: entry URL must end with '/' -> ${entry.url}`);
      }
      if (seenUrls.has(entry.url)) {
        errors.push(`public/seo/keyword-intent-map.json: duplicate entry URL -> ${entry.url}`);
      }
      seenUrls.add(entry.url);

      const expectedSitemapUrl = `${PRIMARY_DOMAIN}${entry.url}`;
      if (!sitemapLocSet.has(expectedSitemapUrl)) {
        errors.push(`public/sitemap.xml: missing keyword-intent URL -> ${expectedSitemapUrl}`);
      }

      const relativeFile =
        entry.url.startsWith("/format/")
          ? `public/format/${entry.slug}/index.html`
          : `public/compare/${entry.slug}/index.html`;
      if (!fs.existsSync(path.join(ROOT, relativeFile))) {
        errors.push(`public/seo/keyword-intent-map.json: generated page missing for ${entry.url} (${relativeFile})`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`public/seo/keyword-intent-map.json: invalid JSON (${message})`);
  }
}

const domainSensitiveFiles = [
  "index.html",
  ...listFiles("public", (relativePath) => /\.(html|txt|xml|json)$/.test(relativePath))
    .filter(path => !shouldSkipSeoCheck(path)),
  "scripts/build-pseo.mjs"
];

for (const relativePath of domainSensitiveFiles) {
  const content = readFile(relativePath);
  if (content.includes(LEGACY_HOST) && !LEGACY_HOST_ALLOWLIST.has(relativePath)) {
    errors.push(`${relativePath}: contains forbidden legacy host token (${LEGACY_HOST})`);
  }
}

const domainPolicyJson = readFile("public/seo/domain-policy.json");
if (domainPolicyJson) {
  for (const requiredLegacySource of [
    "https://converttoit.app",
    "http://converttoit.app",
    "https://www.converttoit.app",
    "http://www.converttoit.app"
  ]) {
    if (!domainPolicyJson.includes(requiredLegacySource)) {
      errors.push(`public/seo/domain-policy.json: missing redirect source host ${requiredLegacySource}`);
    }
  }
}

const pseoGenerator = readFile("scripts/build-pseo.mjs");
if (pseoGenerator) {
  if (!/const\s+REDIRECT_SOURCE_HOSTS\s*=\s*\[/.test(pseoGenerator)) {
    errors.push("scripts/build-pseo.mjs: REDIRECT_SOURCE_HOSTS declaration is missing.");
  }
}

const buildPseo = readFile("scripts/build-pseo.mjs");
if (!/const BASE_URL\s*=\s*["']https:\/\/converttoit\.com["']/.test(buildPseo)) {
  errors.push("scripts/build-pseo.mjs: BASE_URL must be https://converttoit.com");
}

const appRedirectRules = [
  "https://converttoit.app/* https://converttoit.com/:splat 301!",
  "http://converttoit.app/* https://converttoit.com/:splat 301!",
  "https://www.converttoit.app/* https://converttoit.com/:splat 301!",
  "http://www.converttoit.app/* https://converttoit.com/:splat 301!"
];

checkRedirectFile("cloudflare/redirects/" + "converttoit.app/_redirects", appRedirectRules);
checkRedirectFile("public/_redirects", ["/index.html / 301"]);

const siteRedirects = readFile("public/_redirects");
for (const line of siteRedirects.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
  if (/^https?:\/\//i.test(trimmed)) {
    errors.push(`public/_redirects: host-based redirect rules are not allowed in Workers assets (_redirects) -> ${trimmed}`);
  }
}

const workerSource = readFile("cloudflare/worker/index.mjs");
for (const requiredToken of [
  "CANONICAL_ORIGIN = \"https://converttoit.com\"",
  "\"converttoit.app\"",
  "\"www.converttoit.app\"",
  "\"www.converttoit.com\"",
  "Response.redirect(canonicalUrl.toString(), 301)"
]) {
  if (!workerSource.includes(requiredToken)) {
    errors.push(`cloudflare/worker/index.mjs: missing canonical redirect token -> ${requiredToken}`);
  }
}

if (errors.length > 0) {
  console.error("SEO/domain policy check failed:\n");
  for (const [index, error] of errors.entries()) {
    console.error(`${index + 1}. ${error}`);
  }
  process.exit(1);
}

console.log(`SEO/domain policy check passed (${htmlFiles.length} HTML files, ${sitemapLocs.length} sitemap URLs).`);
