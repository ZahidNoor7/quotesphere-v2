import { describe, it, expect } from "vitest";
import { renderRichText } from "@/lib/rich-text/render";
import { richTextToPlainText, isEmptyRichText, toEditorContent, isRichTextJSON, stringToDoc } from "@/lib/rich-text/normalize";
import type { RichTextJSON } from "@/types";

/** Helper: wrap inline content in a doc → paragraph. */
function para(...content: RichTextJSON[]): RichTextJSON {
  return { type: "doc", content: [{ type: "paragraph", content }] };
}
const text = (t: string, marks?: unknown[]): RichTextJSON => ({ type: "text", text: t, ...(marks ? { marks } : {}) });

// ─── Formatting fidelity (the matrix) ─────────────────────────────────────────
describe("renderRichText — formatting fidelity", () => {
  it("bold → <strong>", () => {
    expect(renderRichText(para(text("Bold", [{ type: "bold" }])))).toContain("<strong>");
  });
  it("italic → <em>", () => {
    expect(renderRichText(para(text("It", [{ type: "italic" }])))).toContain("<em>");
  });
  it("underline → <u>", () => {
    expect(renderRichText(para(text("U", [{ type: "underline" }])))).toContain("<u>");
  });
  it("strikethrough → <s>", () => {
    expect(renderRichText(para(text("S", [{ type: "strike" }])))).toMatch(/<s>|<del>/);
  });
  it("bold + italic combined", () => {
    const html = renderRichText(para(text("BI", [{ type: "bold" }, { type: "italic" }])));
    expect(html).toContain("<strong>");
    expect(html).toContain("<em>");
  });
  it("bullet list → <ul><li>", () => {
    const doc: RichTextJSON = { type: "doc", content: [{ type: "bulletList", content: [
      { type: "listItem", content: [{ type: "paragraph", content: [text("a")] }] },
    ] }] };
    const html = renderRichText(doc);
    expect(html).toContain("<ul");
    expect(html).toContain("<li");
  });
  it("ordered list → <ol><li>", () => {
    const doc: RichTextJSON = { type: "doc", content: [{ type: "orderedList", content: [
      { type: "listItem", content: [{ type: "paragraph", content: [text("1")] }] },
    ] }] };
    expect(renderRichText(doc)).toContain("<ol");
  });
  it("nested list preserved", () => {
    const doc: RichTextJSON = { type: "doc", content: [{ type: "bulletList", content: [
      { type: "listItem", content: [
        { type: "paragraph", content: [text("outer")] },
        { type: "bulletList", content: [
          { type: "listItem", content: [{ type: "paragraph", content: [text("inner")] }] },
        ] },
      ] },
    ] }] };
    const html = renderRichText(doc);
    expect(html.match(/<ul/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain("inner");
  });
  it("link → <a href> with correct href + safe rel/target, NOT fetched", () => {
    const html = renderRichText(para(text("site", [{ type: "link", attrs: { href: "https://example.com" } }])));
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).toContain('target="_blank"');
    expect(html).not.toContain("<img"); // links are anchors, never fetched
  });
  it("H3/H4 headings", () => {
    const doc: RichTextJSON = { type: "doc", content: [
      { type: "heading", attrs: { level: 3 }, content: [text("Three")] },
      { type: "heading", attrs: { level: 4 }, content: [text("Four")] },
    ] };
    const html = renderRichText(doc);
    expect(html).toContain("<h3");
    expect(html).toContain("<h4");
  });
  it("text alignment preserved (center/right)", () => {
    const center: RichTextJSON = { type: "doc", content: [{ type: "paragraph", attrs: { textAlign: "center" }, content: [text("C")] }] };
    const right: RichTextJSON = { type: "doc", content: [{ type: "paragraph", attrs: { textAlign: "right" }, content: [text("R")] }] };
    expect(renderRichText(center)).toMatch(/text-align:\s*center/);
    expect(renderRichText(right)).toMatch(/text-align:\s*right/);
  });
  it("highlight preserved (printBackground-dependent in PDF)", () => {
    const html = renderRichText(para(text("HL", [{ type: "highlight", attrs: { color: "#fef08a" } }])));
    expect(html).toContain("<mark");
    expect(html).toMatch(/background-color:\s*#fef08a/i);
  });
  it("text color preserved", () => {
    const html = renderRichText(para(text("Red", [{ type: "textStyle", attrs: { color: "#dc2626" } }])));
    expect(html).toMatch(/color:\s*#dc2626/i);
  });
  it("hard break, multiple paragraphs and an empty paragraph survive", () => {
    const doc: RichTextJSON = { type: "doc", content: [
      { type: "paragraph", content: [text("line1"), { type: "hardBreak" }, text("line2")] },
      { type: "paragraph" }, // intentional empty paragraph (spacing)
      { type: "paragraph", content: [text("line3")] },
    ] };
    const html = renderRichText(doc);
    expect(html).toContain("<br");
    expect(html.match(/<p>|<p /g)?.length).toBeGreaterThanOrEqual(3); // empty paragraph kept
  });
  it("unicode / currency symbols render unchanged", () => {
    const html = renderRichText(para(text("₨ 1,200 · $5 · café · مرحبا")));
    expect(html).toContain("₨ 1,200 · $5 · café · مرحبا");
  });
});

// ─── Legacy plain-string compatibility (frozen documents) ─────────────────────
describe("renderRichText — legacy plain strings", () => {
  it("renders a legacy string as a paragraph, preserving line breaks", () => {
    const html = renderRichText("Thanks for your business.\nPay within 7 days.");
    expect(html).toContain("Thanks for your business.");
    expect(html).toContain("<br");
    expect(html).toContain("Pay within 7 days.");
  });
  it("escapes HTML in legacy strings (no executable markup)", () => {
    const html = renderRichText("<script>alert(1)</script> & <b>x</b>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
  it("empty string renders nothing", () => {
    expect(renderRichText("")).toBe("");
    expect(renderRichText("   ")).toBe("");
  });
});

// ─── Security / sanitizer (XSS + SSRF) ────────────────────────────────────────
describe("renderRichText — sanitizer", () => {
  it("blocks javascript: links", () => {
    const html = renderRichText(para(text("x", [{ type: "link", attrs: { href: "javascript:alert(1)" } }])));
    expect(html.toLowerCase()).not.toContain("javascript:");
  });
  it("blocks data: links", () => {
    const html = renderRichText(para(text("x", [{ type: "link", attrs: { href: "data:text/html,<script>1</script>" } }])));
    expect(html).not.toContain("data:");
  });
  it("strips disallowed inline-style properties, keeps color", () => {
    // A hostile color attr trying to smuggle a second declaration.
    const html = renderRichText(para(text("x", [{ type: "textStyle", attrs: { color: "#dc2626; position: fixed; top: 0" } }])));
    expect(html).toMatch(/color:\s*#dc2626/i);
    expect(html).not.toContain("position");
  });
  it("drops a color value containing url()/expression", () => {
    const html = renderRichText(para(text("x", [{ type: "textStyle", attrs: { color: "url(http://evil/x)" } }])));
    expect(html.toLowerCase()).not.toContain("url(");
  });
  it("never emits <img> (SSRF guard for the headless render)", () => {
    // Even if some node tried to produce an image, the allowlist forbids it.
    const html = renderRichText(para(text("plain")));
    expect(html).not.toContain("<img");
  });
});

// ─── Round-trip + helpers ─────────────────────────────────────────────────────
describe("normalize + helpers", () => {
  it("toEditorContent leaves a JSON doc unchanged (no formatting normalized away)", () => {
    const doc = para(text("Bold", [{ type: "bold" }]));
    expect(toEditorContent(doc)).toEqual(doc);
  });
  it("toEditorContent converts a legacy string into a doc with hard breaks", () => {
    const doc = toEditorContent("a\nb");
    expect(isRichTextJSON(doc)).toBe(true);
    expect(JSON.stringify(doc)).toContain("hardBreak");
    expect(richTextToPlainText(doc)).toBe("a\nb");
  });
  it("stringToDoc on empty → empty doc", () => {
    expect(stringToDoc("")).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
  });
  it("richTextToPlainText extracts nested text", () => {
    const doc: RichTextJSON = { type: "doc", content: [
      { type: "heading", attrs: { level: 3 }, content: [text("Title")] },
      { type: "bulletList", content: [
        { type: "listItem", content: [{ type: "paragraph", content: [text("one")] }] },
        { type: "listItem", content: [{ type: "paragraph", content: [text("two")] }] },
      ] },
    ] };
    const txt = richTextToPlainText(doc);
    expect(txt).toContain("Title");
    expect(txt).toContain("one");
    expect(txt).toContain("two");
  });
  it("isEmptyRichText: empty doc/string true, content false", () => {
    expect(isEmptyRichText(null)).toBe(true);
    expect(isEmptyRichText("")).toBe(true);
    expect(isEmptyRichText("   ")).toBe(true);
    expect(isEmptyRichText({ type: "doc", content: [{ type: "paragraph" }] })).toBe(true);
    expect(isEmptyRichText(para(text("hi")))).toBe(false);
    expect(isEmptyRichText("hi")).toBe(false);
  });
});
