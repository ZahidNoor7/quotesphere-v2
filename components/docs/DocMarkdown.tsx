"use client";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { T1, T2, T3, GLASS, GLASS_BORDER, AC } from "@/lib/ds";

/** Documentation-styled Markdown (larger, more spacious than the chat renderer). */
export function DocMarkdown({ content }: { content: string }) {
  return (
    <div style={{ fontSize: 14.5, color: T2, lineHeight: 1.7, wordBreak: "break-word" }}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 style={{ fontSize: 27, fontWeight: 700, color: T1, margin: "0 0 10px", letterSpacing: "-0.02em", lineHeight: 1.2 }}>{children}</h1>,
          h2: ({ children }) => <h2 style={{ fontSize: 19, fontWeight: 700, color: T1, margin: "30px 0 10px", letterSpacing: "-0.01em" }}>{children}</h2>,
          h3: ({ children }) => <h3 style={{ fontSize: 15.5, fontWeight: 600, color: T1, margin: "22px 0 8px" }}>{children}</h3>,
          p: ({ children }) => <p style={{ margin: "0 0 14px" }}>{children}</p>,
          ul: ({ children }) => <ul style={{ margin: "0 0 14px", paddingLeft: 22, display: "flex", flexDirection: "column", gap: 6 }}>{children}</ul>,
          ol: ({ children }) => <ol style={{ margin: "0 0 14px", paddingLeft: 22, display: "flex", flexDirection: "column", gap: 7 }}>{children}</ol>,
          li: ({ children }) => <li style={{ margin: 0, paddingLeft: 2 }}>{children}</li>,
          strong: ({ children }) => <strong style={{ fontWeight: 700, color: T1 }}>{children}</strong>,
          em: ({ children }) => <em>{children}</em>,
          a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer" style={{ color: AC, textDecoration: "underline" }}>{children}</a>,
          code: ({ className, children }) =>
            /language-/.test(className ?? "") ? (
              <code className={className} style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 13 }}>{children}</code>
            ) : (
              <code style={{ background: GLASS, border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 5, padding: "1px 6px", fontSize: 12.5, fontFamily: "var(--font-mono, monospace)", color: T1 }}>{children}</code>
            ),
          pre: ({ children }) => <pre style={{ background: GLASS, border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 10, padding: "14px 16px", overflowX: "auto", margin: "0 0 16px", fontSize: 13, lineHeight: 1.55 }}>{children}</pre>,
          blockquote: ({ children }) => <blockquote style={{ borderLeft: `3px solid ${AC}`, margin: "0 0 16px", color: T2, background: `color-mix(in srgb,${AC} 7%,transparent)`, padding: "10px 16px", borderRadius: "0 8px 8px 0" }}>{children}</blockquote>,
          hr: () => <hr style={{ border: "none", borderTop: `0.5px solid ${GLASS_BORDER}`, margin: "26px 0" }} />,
          table: ({ children }) => (
            <div style={{ overflowX: "auto", margin: "0 0 16px", border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 8 }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>{children}</table>
            </div>
          ),
          th: ({ children }) => <th style={{ textAlign: "left", padding: "8px 12px", borderBottom: `0.5px solid ${GLASS_BORDER}`, background: GLASS, color: T3, fontWeight: 600, whiteSpace: "nowrap" }}>{children}</th>,
          td: ({ children }) => <td style={{ padding: "8px 12px", borderTop: `0.5px solid ${GLASS_BORDER}`, color: T2, verticalAlign: "top" }}>{children}</td>,
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}
