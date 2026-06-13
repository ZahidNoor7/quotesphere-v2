import { StarterKit } from "@tiptap/starter-kit";
import { TextAlign } from "@tiptap/extension-text-align";
import { Highlight } from "@tiptap/extension-highlight";
import { TextStyle, Color } from "@tiptap/extension-text-style";
import type { AnyExtension } from "@tiptap/core";

/**
 * SINGLE SOURCE OF TRUTH for the rich-text schema.
 *
 * The same extension definitions drive (1) the editor, (2) the JSON→HTML render
 * utility, and (3) the sanitizer allowlist (derived from the marks/nodes these
 * extensions emit). If a formatting option is added/removed, it changes here and
 * nowhere else — this is what keeps editor ⇄ preview ⇄ PDF in lockstep.
 */
export type RichTextVariant = "lineItem" | "remarks";

/** Link config shared by both variants (open in a new tab, never auto-followed in the editor). */
const LINK_OPTIONS = {
  openOnClick: false,
  autolink: true,
  defaultProtocol: "https",
  protocols: ["http", "https", "mailto", "tel"],
  HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
};

function starterFor(variant: RichTextVariant) {
  return StarterKit.configure({
    // Nodes we never allow in either context — they'd blow out a PDF table cell
    // or the document footer. (Underline, Link, and the list extensions are all
    // bundled inside StarterKit v3, so they stay enabled by default.)
    codeBlock: false,
    code: false,
    blockquote: false,
    horizontalRule: false,
    // Headings: H3/H4 only in remarks; none inside a line-item cell.
    heading: variant === "remarks" ? { levels: [3, 4] } : false,
    link: LINK_OPTIONS,
  });
}

/** Build the extension array for an editor of the given variant. */
export function getRichTextExtensions(variant: RichTextVariant): AnyExtension[] {
  const exts: AnyExtension[] = [starterFor(variant)];
  if (variant === "remarks") {
    exts.push(
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    );
  }
  return exts;
}

/**
 * Superset used by the renderer + sanitizer. It is the `remarks` set because
 * that is a strict superset of the `lineItem` set — so JSON produced by EITHER
 * editor always round-trips through the renderer with zero dropped formatting.
 */
export const RENDER_EXTENSIONS: AnyExtension[] = getRichTextExtensions("remarks");
