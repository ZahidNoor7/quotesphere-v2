"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, useEditorState, type Editor } from "@tiptap/react";
import type { Content } from "@tiptap/core";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Link as LinkIcon, RemoveFormatting,
  Heading3, Heading4, AlignLeft, AlignCenter, AlignRight,
  Highlighter, Baseline, Check, Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getRichTextExtensions, type RichTextVariant } from "@/lib/rich-text/extensions";
import { toEditorContent } from "@/lib/rich-text/normalize";
import type { RichTextContent, RichTextJSON } from "@/types";

const TEXT_COLORS = ["#111827", "#6b7280", "#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#0891b2", "#2563eb", "#7c3aed", "#db2777"];
const HIGHLIGHTS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#fed7aa", "#e9d5ff", "#fecaca"];

export interface RichTextEditorProps {
  value?: RichTextContent | null;
  onChange: (json: RichTextJSON) => void;
  variant: RichTextVariant;
  placeholder?: string;
  /** Active document-design font, so the editor matches the preview/PDF (WYSIWYG #4). */
  fontFamily?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  minHeight?: number;
}

export function RichTextEditor({
  value, onChange, variant, placeholder, fontFamily,
  disabled = false, className, ariaLabel, minHeight,
}: RichTextEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // Tracks the JSON we last emitted, so echoing parent state back in `value`
  // does not trigger a setContent() that would reset the caret mid-typing.
  const lastEmitted = useRef<string | null>(null);

  const isRemarks = variant === "remarks";
  const mh = minHeight ?? (isRemarks ? 96 : 40);

  const editor = useEditor({
    extensions: getRichTextExtensions(variant),
    // Boundary cast: our provider-agnostic JSON is structurally a Tiptap doc.
    content: toEditorContent(value) as unknown as Content,
    editable: !disabled,
    immediatelyRender: false, // SSR safety (App Router) — required.
    editorProps: {
      attributes: {
        class: "qs-rich qs-rich-editor",
        style: `min-height:${mh}px`,
        ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
      },
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON() as RichTextJSON;
      lastEmitted.current = JSON.stringify(json);
      onChangeRef.current(json);
    },
  });

  // Sync genuine external value changes (record load, template apply) only.
  useEffect(() => {
    if (!editor) return;
    const incoming = JSON.stringify(toEditorContent(value));
    if (incoming === lastEmitted.current) return;
    if (incoming === JSON.stringify(editor.getJSON())) return;
    editor.commands.setContent(toEditorContent(value) as unknown as Content, { emitUpdate: false });
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return null;
      return {
        empty: e.isEmpty,
        bold: e.isActive("bold"), italic: e.isActive("italic"),
        underline: e.isActive("underline"), strike: e.isActive("strike"),
        bullet: e.isActive("bulletList"), ordered: e.isActive("orderedList"),
        link: e.isActive("link"),
        h3: e.isActive("heading", { level: 3 }), h4: e.isActive("heading", { level: 4 }),
        alignLeft: e.isActive({ textAlign: "left" }),
        alignCenter: e.isActive({ textAlign: "center" }),
        alignRight: e.isActive({ textAlign: "right" }),
        highlight: e.isActive("highlight"),
      };
    },
  });

  return (
    <div
      className={cn(
        "rounded-md border bg-(--glass) border-(--glass-border) overflow-hidden transition-colors",
        "focus-within:border-(--accent2)/60 focus-within:ring-2 focus-within:ring-(--accent2)/25",
        disabled && "opacity-60 pointer-events-none",
        className,
      )}
      style={fontFamily ? { fontFamily } : undefined}
    >
      {!disabled && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-(--glass-border) px-1.5 py-1">
          <BarBtn icon={Bold} label="Bold" active={s?.bold} command onClick={() => editor?.chain().focus().toggleBold().run()} />
          <BarBtn icon={Italic} label="Italic" active={s?.italic} command onClick={() => editor?.chain().focus().toggleItalic().run()} />
          <BarBtn icon={UnderlineIcon} label="Underline" active={s?.underline} command onClick={() => editor?.chain().focus().toggleUnderline().run()} />
          <BarBtn icon={Strikethrough} label="Strikethrough" active={s?.strike} command onClick={() => editor?.chain().focus().toggleStrike().run()} />

          {isRemarks && <Sep />}
          {isRemarks && <BarBtn icon={Heading3} label="Heading 3" active={s?.h3} command onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} />}
          {isRemarks && <BarBtn icon={Heading4} label="Heading 4" active={s?.h4} command onClick={() => editor?.chain().focus().toggleHeading({ level: 4 }).run()} />}

          <Sep />
          <BarBtn icon={List} label="Bullet list" active={s?.bullet} command onClick={() => editor?.chain().focus().toggleBulletList().run()} />
          <BarBtn icon={ListOrdered} label="Numbered list" active={s?.ordered} command onClick={() => editor?.chain().focus().toggleOrderedList().run()} />

          {isRemarks && <Sep />}
          {isRemarks && <BarBtn icon={AlignLeft} label="Align left" active={s?.alignLeft} command onClick={() => editor?.chain().focus().setTextAlign("left").run()} />}
          {isRemarks && <BarBtn icon={AlignCenter} label="Align center" active={s?.alignCenter} command onClick={() => editor?.chain().focus().setTextAlign("center").run()} />}
          {isRemarks && <BarBtn icon={AlignRight} label="Align right" active={s?.alignRight} command onClick={() => editor?.chain().focus().setTextAlign("right").run()} />}

          {isRemarks && <Sep />}
          {isRemarks && <SwatchControl icon={Highlighter} label="Highlight" colors={HIGHLIGHTS} active={s?.highlight}
            onPick={(c) => editor?.chain().focus().toggleHighlight({ color: c }).run()}
            onClear={() => editor?.chain().focus().unsetHighlight().run()} />}
          {isRemarks && <SwatchControl icon={Baseline} label="Text color" colors={TEXT_COLORS}
            onPick={(c) => editor?.chain().focus().setColor(c).run()}
            onClear={() => editor?.chain().focus().unsetColor().run()} />}

          <Sep />
          <LinkControl editor={editor} active={s?.link} />
          <BarBtn icon={RemoveFormatting} label="Clear formatting" command onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()} />
        </div>
      )}

      <div className="relative">
        <EditorContent editor={editor} />
        {placeholder && (s?.empty ?? true) && (
          <div className="pointer-events-none absolute left-0 top-0 px-2.5 py-2 text-[13px] leading-[1.55] text-(--t3) select-none">
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
}

/** Toolbar button. `command` buttons preventDefault on mousedown to keep the editor selection. */
function BarBtn({
  icon: Icon, label, active, onClick, command,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick?: () => void;
  command?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={label}
      aria-pressed={!!active}
      title={label}
      onMouseDown={command ? (e) => e.preventDefault() : undefined}
      onClick={onClick}
      className={cn(
        "h-7 w-7 min-w-7 p-0 text-(--t2) hover:text-(--t1)",
        active && "bg-(--accent2)/15 text-(--accent2) hover:text-(--accent2)",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </Button>
  );
}

function Sep() {
  return <span className="mx-0.5 h-5 w-px shrink-0 bg-(--glass-border)" aria-hidden />;
}

function LinkControl({ editor, active }: { editor: Editor | null; active?: boolean }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (open) setUrl((editor?.getAttributes("link").href as string | undefined) ?? "");
  }, [open, editor]);

  const apply = () => {
    if (!editor) return;
    const href = url.trim();
    if (!href) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      const normalized = /^(https?:|mailto:|tel:)/i.test(href) ? href : `https://${href}`;
      editor.chain().focus().extendMarkRange("link").setLink({ href: normalized }).run();
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button" variant="ghost" size="sm" aria-label="Link" title="Link" aria-pressed={!!active}
          className={cn("h-7 w-7 min-w-7 p-0 text-(--t2) hover:text-(--t1)", active && "bg-(--accent2)/15 text-(--accent2)")}
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="flex items-center gap-1.5">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="h-8 text-xs"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); apply(); } }}
          />
          <Button type="button" size="sm" className="h-8 px-2" onClick={apply} aria-label="Apply link">
            <Check className="h-3.5 w-3.5" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SwatchControl({
  icon: Icon, label, colors, active, onPick, onClear,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  colors: string[];
  active?: boolean;
  onPick: (color: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button" variant="ghost" size="sm" aria-label={label} title={label} aria-pressed={!!active}
          className={cn("h-7 w-7 min-w-7 p-0 text-(--t2) hover:text-(--t1)", active && "bg-(--accent2)/15 text-(--accent2)")}
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <div className="flex items-center gap-1.5">
          {colors.map((c) => (
            <Button
              key={c}
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`${label} ${c}`}
              onClick={() => { onPick(c); setOpen(false); }}
              className="h-5 w-5 min-w-0 rounded-full border border-black/10 p-0 transition-transform hover:scale-110"
              style={{ background: c }}
            />
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Clear ${label.toLowerCase()}`}
            title={`Clear ${label.toLowerCase()}`}
            onClick={() => { onClear(); setOpen(false); }}
            className="h-5 w-5 min-w-0 rounded-full border border-(--glass-border) p-0 text-(--t3) hover:text-(--t1)"
          >
            <Ban className="h-3 w-3" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
