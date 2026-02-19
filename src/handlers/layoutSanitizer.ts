const BASE_BLOCKED_TAGS = new Set([
  "script",
  "iframe",
  "object",
  "embed",
  "frame",
  "frameset"
]);

const SVG_EXTRA_BLOCKED_TAGS = new Set([
  "foreignobject",
  "animate",
  "animatemotion",
  "animatetransform",
  "set"
]);

const URL_ATTRIBUTES = new Set([
  "href",
  "xlink:href",
  "src",
  "action",
  "formaction",
  "poster"
]);

const UNSAFE_STYLE_PATTERN = /(?:expression\s*\(|url\s*\(\s*["']?\s*(?:javascript:|vbscript:))/i;

function normalizedUrlValue (value: string): string {
  return value.replace(/[\u0000-\u0020\u007f-\u009f]/g, "").toLowerCase();
}

function isUnsafeUrlValue (value: string): boolean {
  const normalized = normalizedUrlValue(value);
  return normalized.startsWith("javascript:") || normalized.startsWith("vbscript:");
}

function hasUnsafeSrcset (value: string): boolean {
  return value
    .split(",")
    .map(candidate => candidate.trim().split(/\s+/)[0])
    .some(url => url.length > 0 && isUnsafeUrlValue(url));
}

function sanitizeAttributes (element: Element): void {
  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name.toLowerCase();
    const value = attribute.value;

    if (name.startsWith("on")) {
      element.removeAttribute(attribute.name);
      continue;
    }

    if (name === "srcdoc") {
      element.removeAttribute(attribute.name);
      continue;
    }

    if (URL_ATTRIBUTES.has(name) && isUnsafeUrlValue(value)) {
      element.removeAttribute(attribute.name);
      continue;
    }

    if (name === "srcset" && hasUnsafeSrcset(value)) {
      element.removeAttribute(attribute.name);
      continue;
    }

    if (name === "style" && UNSAFE_STYLE_PATTERN.test(value)) {
      element.removeAttribute(attribute.name);
    }
  }
}

function sanitizeElementTree (element: Element, blockedTags: ReadonlySet<string>): void {
  if (blockedTags.has(element.tagName.toLowerCase())) {
    element.remove();
    return;
  }

  sanitizeAttributes(element);

  for (const child of Array.from(element.children)) {
    sanitizeElementTree(child, blockedTags);
  }
}

function sanitizeTree (root: ParentNode, blockedTags: ReadonlySet<string>): void {
  for (const child of Array.from(root.children)) {
    sanitizeElementTree(child, blockedTags);
  }
}

export interface LayoutSandbox {
  container: HTMLDivElement;
  cleanup: () => void;
}

export function createLayoutSandbox (styleText?: string): LayoutSandbox {
  const host = document.createElement("div");
  host.style.all = "initial";
  host.style.visibility = "hidden";
  host.style.position = "fixed";
  host.style.inset = "0";
  host.style.pointerEvents = "none";
  host.setAttribute("aria-hidden", "true");
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "closed" });
  if (styleText) {
    const style = document.createElement("style");
    style.textContent = styleText;
    shadow.appendChild(style);
  }

  const container = document.createElement("div");
  shadow.appendChild(container);

  return {
    container,
    cleanup: () => {
      host.remove();
    }
  };
}

export function sanitizeHtmlToFragment (html: string): DocumentFragment {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  sanitizeTree(parsed.body, BASE_BLOCKED_TAGS);

  const fragment = document.createDocumentFragment();
  for (const node of Array.from(parsed.body.childNodes)) {
    fragment.appendChild(document.importNode(node, true));
  }
  return fragment;
}

export function sanitizeSvgToElement (svg: string): SVGSVGElement {
  const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (parsed.querySelector("parsererror")) {
    throw new Error("Invalid SVG markup: parser error.");
  }

  const root = parsed.documentElement;
  if (root.tagName.toLowerCase() !== "svg") {
    throw new Error("Invalid SVG markup: expected an <svg> root element.");
  }

  const blockedTags = new Set([...BASE_BLOCKED_TAGS, ...SVG_EXTRA_BLOCKED_TAGS]);
  sanitizeElementTree(root, blockedTags);

  const importedRoot = document.importNode(root, true);
  if (!(importedRoot instanceof SVGSVGElement)) {
    throw new Error("Invalid SVG markup: could not import <svg> root element.");
  }

  return importedRoot;
}
