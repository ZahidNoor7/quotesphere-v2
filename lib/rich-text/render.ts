import { renderToHTMLString } from "@tiptap/static-renderer/pm/html-string";
import type { JSONContent } from "@tiptap/core";
import DOMPurify from "isomorphic-dompurify";
import type { RichTextContent } from "@/types";
import { RENDER_EXTENSIONS } from "./extensions";
import { isRichTextJSON } from "./normalize";

// Dependency-free helpers live in ./normalize so server modules (e.g. the AI
// assistant) can import them without loading DOMPurify/jsdom or the renderer.
export { richTextToPlainText, isEmptyRichText } from "./normalize";

/**
 * ONE render utility for BOTH the live preview and the server-side Puppeteer PDF.
 * Flow: ProseMirror JSON → HTML (via the shared extension list, DOM-free) →
 * sanitized HTML string. Runs identically on the server (print route) and the
 * client (preview) — isomorphic-dompurify picks the right DOMPurify per runtime.
 */

// Allowlist is DERIVED from what the shared extensions legitimately emit. It is a
// fidelity contract as much as a security one: it must keep every tag/attr/style
// those extensions produce, and nothing else.
const ALLOWED_TAGS = [
  "p", "br",
  "strong", "b", "em", "i", "u", "s", "del",
  "a", "ul", "ol", "li",
  "h3", "h4",
  "mark", "span",
];
const ALLOWED_ATTR = ["href", "target", "rel", "style"];

// Only these inline-style properties survive (color/highlight + text alignment).
const SAFE_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$|^rgba?\(\s*[\d.\s,%]+\)$|^hsla?\(\s*[\d.\s,%]+\)$|^[a-z]{3,20}$/i;
const SAFE_ALIGN = /^(?:left|right|center|justify|start|end)$/i;

function filterStyle(raw: string): string {
  const kept: string[] = [];
  for (const decl of raw.split(";")) {
    const idx = decl.indexOf(":");
    if (idx < 0) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const val = decl.slice(idx + 1).trim();
    // Reject any value that could smuggle a fetch/exec vector.
    if (!val || /url\(|expression|javascript:|@import|[<>]/i.test(val)) continue;
    if ((prop === "color" || prop === "background-color") && SAFE_COLOR.test(val)) {
      kept.push(`${prop}: ${val}`);
    } else if (prop === "text-align" && SAFE_ALIGN.test(val)) {
      kept.push(`${prop}: ${val}`);
    }
  }
  return kept.join("; ");
}

let hooksRegistered = false;
function ensureHooks() {
  if (hooksRegistered) return;
  hooksRegistered = true;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    const el = node as Element;
    if (el.getAttribute && el.hasAttribute?.("style")) {
      const filtered = filterStyle(el.getAttribute("style") ?? "");
      if (filtered) el.setAttribute("style", filtered);
      else el.removeAttribute("style");
    }
    // Harden every anchor regardless of what the model emitted.
    if (el.tagName === "A") {
      el.setAttribute("rel", "noopener noreferrer nofollow");
      el.setAttribute("target", "_blank");
    }
  });
}

const SANITIZE_CONFIG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  // Block remote/exec URLs (javascript:, data:, etc.) on href — only safe schemes.
  ALLOWED_URI_REGEXP: /^(?:https?|mailto|tel):/i,
  ALLOW_DATA_ATTR: false,
  // Defence in depth: no remote-resource or active-content tags ever (SSRF guard
  // for the headless render — the browser must not fetch anything for rich text).
  FORBID_TAGS: ["img", "image", "svg", "math", "iframe", "video", "audio", "source", "object", "embed", "script", "style", "link", "base", "form", "input"],
};

function sanitize(html: string): string {
  ensureHooks();
  return DOMPurify.sanitize(html, SANITIZE_CONFIG) as string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Memoize rendered HTML. The live preview re-renders the whole document on every
// keystroke and DocumentRenderer renders each item several times (measurement +
// per-page pagination layers); without this, every pass rebuilds the ProseMirror
// schema and re-sanitizes unchanged content, which stalls the preview. Keyed by
// object reference for JSON (the editor returns a fresh object only on a real
// edit, so unchanged items hit the cache) and by value for legacy strings.
const jsonHtmlCache = new WeakMap<object, string>();
const stringHtmlCache = new Map<string, string>();

/**
 * JSON (or legacy string) → sanitized HTML string.
 * Returns "" for empty/missing content so callers can skip rendering the block.
 * Memoized — repeated renders of unchanged content are O(1).
 */
export function renderRichText(content: RichTextContent | null | undefined): string {
  if (content == null) return "";
  // Legacy plain string — render exactly as before (escaped text + <br> line
  // breaks), bypassing the schema so historical documents never reflow.
  if (typeof content === "string") {
    if (!content.trim()) return "";
    const cached = stringHtmlCache.get(content);
    if (cached !== undefined) return cached;
    const out = sanitize(`<p>${escapeHtml(content).replace(/\r\n|\n/g, "<br>")}</p>`);
    if (stringHtmlCache.size > 300) stringHtmlCache.clear();
    stringHtmlCache.set(content, out);
    return out;
  }
  if (!isRichTextJSON(content)) return "";
  const key = content as object;
  const cached = jsonHtmlCache.get(key);
  if (cached !== undefined) return cached;
  let out = "";
  try {
    // Boundary cast: RichTextJSON is structurally a Tiptap JSONContent doc, but
    // we keep the stored type provider-agnostic (no Tiptap import in @/types).
    out = sanitize(renderToHTMLString({
      content: content as unknown as JSONContent,
      extensions: RENDER_EXTENSIONS,
    }));
  } catch {
    out = "";
  }
  jsonHtmlCache.set(key, out);
  return out;
}

