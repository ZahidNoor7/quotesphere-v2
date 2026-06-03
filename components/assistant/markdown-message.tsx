"use client";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { T1, T2, T3, GLASS, GLASS_BORDER, AC } from "@/lib/ds";

/** Renders assistant text as GitHub-flavored Markdown, styled for the chat surface. */
export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div dir="auto" style={{ fontSize: 13.5, color: T1, lineHeight: 1.6, wordBreak: "break-word", maxWidth: "100%", minWidth: 0 }}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p dir="auto" style={{ margin: "0 0 8px" }}>{children}</p>,
          ul: ({ children }) => (
            <ul dir="auto" style={{ margin: "0 0 8px", paddingInlineStart: 20, display: "flex", flexDirection: "column", gap: 3 }}>{children}</ul>
          ),
          ol: ({ children }) => (
            <ol dir="auto" style={{ margin: "0 0 8px", paddingInlineStart: 20, display: "flex", flexDirection: "column", gap: 3 }}>{children}</ol>
          ),
          li: ({ children }) => <li dir="auto" style={{ margin: 0 }}>{children}</li>,
          strong: ({ children }) => <strong style={{ fontWeight: 700, color: T1 }}>{children}</strong>,
          em: ({ children }) => <em>{children}</em>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" style={{ color: AC, textDecoration: "underline" }}>
              {children}
            </a>
          ),
          h1: ({ children }) => <h1 dir="auto" style={{ fontSize: 16, fontWeight: 700, margin: "10px 0 6px", color: T1 }}>{children}</h1>,
          h2: ({ children }) => <h2 dir="auto" style={{ fontSize: 15, fontWeight: 700, margin: "10px 0 6px", color: T1 }}>{children}</h2>,
          h3: ({ children }) => <h3 dir="auto" style={{ fontSize: 14, fontWeight: 600, margin: "8px 0 4px", color: T1 }}>{children}</h3>,
          code: ({ className, children }) => {
            const isBlock = /language-/.test(className ?? "");
            if (isBlock) {
              return (
                <code className={className} style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>
                  {children}
                </code>
              );
            }
            return (
              <code style={{ background: GLASS, border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 5, padding: "1px 5px", fontSize: 12, fontFamily: "var(--font-mono, monospace)" }}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre style={{ background: GLASS, border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 8, padding: "10px 12px", overflowX: "auto", margin: "0 0 8px" }}>
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote dir="auto" style={{ borderInlineStart: `2px solid ${GLASS_BORDER}`, paddingInlineStart: 10, margin: "0 0 8px", color: T2 }}>{children}</blockquote>
          ),
          hr: () => <hr style={{ border: "none", borderTop: `0.5px solid ${GLASS_BORDER}`, margin: "10px 0" }} />,
          table: ({ children }) => (
            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", maxWidth: "100%", margin: "0 0 8px", border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 8 }}>
              <table style={{ borderCollapse: "collapse", fontSize: 12.5, width: "100%" }}>{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th dir="auto" style={{ textAlign: "start", padding: "7px 11px", borderBottom: `0.5px solid ${GLASS_BORDER}`, background: GLASS, color: T3, fontWeight: 600 }}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td dir="auto" style={{ textAlign: "start", padding: "7px 11px", borderTop: `0.5px solid ${GLASS_BORDER}`, color: T1, wordBreak: "break-word" }}>{children}</td>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}
