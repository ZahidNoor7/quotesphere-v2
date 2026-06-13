import type { RichTextContent, RichTextJSON } from "@/types";

/** A minimal empty ProseMirror document (one empty paragraph). */
export function emptyDoc(): RichTextJSON {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

/** True when the value is a ProseMirror/Tiptap JSON document. */
export function isRichTextJSON(v: unknown): v is RichTextJSON {
  return (
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    (v as RichTextJSON).type === "doc"
  );
}

/**
 * Convert a legacy plain string into a single paragraph, preserving line breaks
 * as hard breaks (mirrors the old `white-space: pre-wrap` rendering as closely as
 * possible, so an old record opened in the editor looks the same as before).
 */
export function stringToDoc(s: string): RichTextJSON {
  const text = s.replace(/\r\n/g, "\n");
  if (!text.trim()) return emptyDoc();
  const inline: RichTextJSON[] = [];
  text.split("\n").forEach((line, i) => {
    if (i > 0) inline.push({ type: "hardBreak" });
    if (line) inline.push({ type: "text", text: line });
  });
  return { type: "doc", content: [{ type: "paragraph", content: inline }] };
}

/**
 * Canonical content for the EDITOR: string → doc, JSON → as-is, empty → empty doc.
 * (Legacy plain-string records are upgraded to a doc only in-memory for editing;
 * nothing is persisted until the user saves — historical documents are untouched.)
 */
export function toEditorContent(content: RichTextContent | null | undefined): RichTextJSON {
  if (content == null) return emptyDoc();
  if (typeof content === "string") return stringToDoc(content);
  if (isRichTextJSON(content)) return content;
  return emptyDoc();
}

/**
 * Recursively collect text from a doc for non-HTML consumers (export/AI/search).
 * Lives here (not in render.ts) so server modules can import it WITHOUT pulling
 * in DOMPurify/jsdom or the static renderer.
 */
export function richTextToPlainText(content: RichTextContent | null | undefined): string {
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (!isRichTextJSON(content)) return "";
  const out: string[] = [];
  const walk = (node: RichTextJSON | undefined) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "hardBreak") { out.push("\n"); return; }
    if (typeof node.text === "string") { out.push(node.text); return; }
    const kids = Array.isArray(node.content) ? (node.content as RichTextJSON[]) : [];
    kids.forEach(walk);
    if (node.type === "paragraph" || node.type === "heading" || node.type === "listItem") {
      out.push("\n");
    }
  };
  walk(content);
  return out.join("").replace(/\n{3,}/g, "\n\n").trim();
}

/** True when the field has no meaningful text (empty doc, empty/whitespace string). */
export function isEmptyRichText(content: RichTextContent | null | undefined): boolean {
  if (content == null) return true;
  if (typeof content === "string") return !content.trim();
  if (!isRichTextJSON(content)) return true;
  return !richTextToPlainText(content).trim();
}
