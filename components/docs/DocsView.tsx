"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, Menu, Search, X } from "lucide-react";
import { T1, T2, T3, GLASS, GLASS_BORDER, AC, TOPBAR_STYLE } from "@/lib/ds";
import { useIsMobile } from "@/hooks/use-mobile";
import type { DocSection, DocIndexEntry } from "@/lib/docs";
import { DocMarkdown } from "./DocMarkdown";

interface SearchHit { slug: string; title: string; section: string; snippet: string; score: number }

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** ~145-char window around the first body match, with leading/trailing ellipses. */
function makeSnippet(text: string, idx: number, len: number): string {
  const start = Math.max(0, idx - 55);
  const end = Math.min(text.length, idx + len + 90);
  return (start > 0 ? "… " : "") + text.slice(start, end).trim() + (end < text.length ? " …" : "");
}

/** Client-side AND search over the prebuilt index; title hits rank above body hits. */
function runSearch(index: DocIndexEntry[], q: string): SearchHit[] {
  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const hits: SearchHit[] = [];
  for (const e of index) {
    const titleLc = e.title.toLowerCase();
    const textLc = e.text.toLowerCase();
    if (!terms.every((t) => titleLc.includes(t) || textLc.includes(t))) continue;
    const titleMatches = terms.filter((t) => titleLc.includes(t)).length;
    const first = terms.find((t) => textLc.includes(t));
    const idx = first ? textLc.indexOf(first) : -1;
    const snippet = idx >= 0 ? makeSnippet(e.text, idx, first!.length) : e.text.slice(0, 150) + (e.text.length > 150 ? " …" : "");
    hits.push({ slug: e.slug, title: e.title, section: e.section, snippet, score: titleMatches * 100 + terms.length });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 12);
}

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;
  const re = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  const set = new Set(terms.map((t) => t.toLowerCase()));
  return (
    <>
      {text.split(re).map((part, i) =>
        set.has(part.toLowerCase())
          ? <mark key={i} style={{ background: `color-mix(in srgb,${AC} 28%,transparent)`, color: T1, borderRadius: 3, padding: "0 1px" }}>{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </>
  );
}

export function DocsView({ sections, current, content, index }: { sections: DocSection[]; current: string; content: string; index: DocIndexEntry[] }) {
  const isMobile = useIsMobile();
  const [navOpen, setNavOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const terms = useMemo(() => query.trim().toLowerCase().split(/\s+/).filter(Boolean), [query]);
  const results = useMemo(() => runSearch(index, query), [index, query]);
  const searching = terms.length > 0;

  // ⌘K / Ctrl-K focuses the search box from anywhere in the docs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const nav = (
    <nav style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {sections.map((s) => (
        <div key={s.title}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: T3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, padding: "0 10px" }}>{s.title}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {s.pages.map((p) => {
              const active = p.slug === current;
              return (
                <Link
                  key={p.slug}
                  href={`/docs/${p.slug}`}
                  onClick={() => setNavOpen(false)}
                  style={{ padding: "7px 10px", borderRadius: 8, fontSize: 12.5, color: active ? AC : T2, background: active ? `color-mix(in srgb,${AC} 10%,transparent)` : "transparent", textDecoration: "none", fontWeight: active ? 600 : 400, transition: "background 0.12s" }}
                >
                  {p.title}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const searchBox = (
    <div style={{ position: "relative", marginBottom: 14 }}>
      <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: T3, pointerEvents: "none" }} />
      <input
        ref={searchRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") setQuery(""); }}
        placeholder="Search guides…"
        aria-label="Search guides"
        style={{ width: "100%", boxSizing: "border-box", padding: "8px 32px 8px 31px", background: GLASS, border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 9, fontSize: 12.5, color: T1, outline: "none", fontFamily: "inherit" }}
      />
      {query ? (
        <button onClick={() => { setQuery(""); searchRef.current?.focus(); }} aria-label="Clear search" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T3, display: "flex", padding: 2 }}>
          <X size={13} />
        </button>
      ) : (
        !isMobile && <kbd style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", fontSize: 9.5, color: T3, border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 4, padding: "1px 4px", fontFamily: "inherit", pointerEvents: "none" }}>⌘K</kbd>
      )}
    </div>
  );

  const resultsList = (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ fontSize: 10.5, color: T3, padding: "0 2px 2px" }}>{results.length} result{results.length === 1 ? "" : "s"}</div>
      {results.length === 0 ? (
        <div style={{ fontSize: 12.5, color: T3, padding: "10px 4px", lineHeight: 1.5 }}>No guides match “{query.trim()}”. Try a different word.</div>
      ) : (
        results.map((r) => (
          <Link
            key={r.slug}
            href={`/docs/${r.slug}`}
            onClick={() => { setQuery(""); setNavOpen(false); }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = AC)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = GLASS_BORDER)}
            style={{ display: "block", padding: "9px 11px", borderRadius: 9, textDecoration: "none", border: `0.5px solid ${GLASS_BORDER}`, background: GLASS, transition: "border-color 0.12s" }}
          >
            <div style={{ fontSize: 12.5, fontWeight: 600, color: T1, marginBottom: 2 }}><Highlight text={r.title} terms={terms} /></div>
            <div style={{ fontSize: 10, color: AC, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{r.section}</div>
            <div style={{ fontSize: 11.5, color: T3, lineHeight: 1.55 }}><Highlight text={r.snippet} terms={terms} /></div>
          </Link>
        ))
      )}
    </div>
  );

  const navArea = (
    <>
      {searchBox}
      {searching ? resultsList : nav}
    </>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
      {/* Topbar */}
      <div style={{ ...TOPBAR_STYLE, gap: 10 }}>
        {isMobile && (
          <button onClick={() => setNavOpen((o) => !o)} aria-label="Browse guides" style={{ width: 32, height: 32, borderRadius: 8, background: GLASS, border: `0.5px solid ${GLASS_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T2 }}>
            <Menu size={16} />
          </button>
        )}
        <BookOpen size={16} style={{ color: AC, flexShrink: 0 }} />
        <span style={{ fontSize: 15, fontWeight: 600, color: T1 }}>Help &amp; Guides</span>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
        {/* Desktop sidebar */}
        {!isMobile && (
          <aside style={{ width: 256, flexShrink: 0, borderRight: `0.5px solid ${GLASS_BORDER}`, overflowY: "auto", padding: "18px 12px" }}>{navArea}</aside>
        )}

        {/* Mobile drawer */}
        {isMobile && navOpen && (
          <div style={{ position: "absolute", inset: 0, zIndex: 60, background: "var(--modal-bg)", backdropFilter: "blur(24px)", padding: "16px 14px", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: T1 }}>Browse guides</span>
              <button onClick={() => setNavOpen(false)} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: T3, display: "flex" }}><X size={18} /></button>
            </div>
            {navArea}
          </div>
        )}

        {/* Content */}
        <main style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: isMobile ? "20px 18px 60px" : "30px 44px 60px" }}>
          <article style={{ maxWidth: 760, margin: "0 auto" }}>
            <DocMarkdown content={content} />
          </article>
        </main>
      </div>
    </div>
  );
}
