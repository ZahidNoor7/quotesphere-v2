"use client";
import { useState } from "react";
import { FileText, MapPin, Download, User, X } from "lucide-react";
import type { WhatsAppMessage } from "@/types";
import { T1, T3, GLASS_BORDER } from "@/lib/ds";

/** Resolve a displayable source URL for a message's media. */
function mediaSrc(msg: WhatsAppMessage): string | undefined {
  if (msg.mediaUrl) return msg.mediaUrl;               // outbound (Cloudinary, public)
  if (msg.mediaId) return `/api/whatsapp/media/${msg.mediaId}`; // inbound (authed proxy)
  return undefined;
}

function humanSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MIME_EXT: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "text/plain": ".txt",
  "text/csv": ".csv",
};

/** Best filename (with extension) for a download. */
function downloadName(msg: WhatsAppMessage): string {
  if (msg.mediaFilename) return msg.mediaFilename;
  const ext = msg.mediaMime ? (MIME_EXT[msg.mediaMime] ?? `.${msg.mediaMime.split("/")[1] ?? "bin"}`) : "";
  return `${msg.messageType ?? "file"}${ext}`;
}

/** Force a proper download with a correct name — works cross-origin (Cloudinary) and via the proxy. */
async function downloadMedia(url: string | undefined, filename: string) {
  if (!url) return;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = filename || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objUrl);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}

/**
 * Renders the media portion of a WhatsApp message based on its `messageType`.
 * Caption, timestamp and status ticks are rendered by the surrounding bubble.
 */
export function MediaBubble({ msg, isOut }: { msg: WhatsAppMessage; isOut: boolean }) {
  const [lightbox, setLightbox] = useState(false);
  const src = mediaSrc(msg);
  const type = msg.messageType;
  const fg = isOut ? "#fff" : T1;
  const sub = isOut ? "rgba(255,255,255,0.7)" : T3;
  const cardBg = isOut ? "rgba(255,255,255,0.14)" : "var(--glass)";
  const cardBorder = isOut ? "rgba(255,255,255,0.22)" : GLASS_BORDER;

  if (type === "image" && src) {
    return (
      <>
        <img
          src={src}
          alt={msg.caption ?? "Image"}
          onClick={() => setLightbox(true)}
          style={{ maxWidth: "100%", width: 240, maxHeight: 280, objectFit: "cover", borderRadius: 10, cursor: "zoom-in", display: "block" }}
        />
        {lightbox && (
          <div
            onClick={() => setLightbox(false)}
            style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, cursor: "zoom-out" }}
          >
            <button onClick={() => setLightbox(false)} style={{ position: "absolute", top: 18, right: 18, background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 8, padding: 8, cursor: "pointer", color: "#fff", display: "flex" }}><X size={18} /></button>
            <img src={src} alt={msg.caption ?? "Image"} style={{ maxWidth: "92vw", maxHeight: "88vh", borderRadius: 8, objectFit: "contain" }} />
          </div>
        )}
      </>
    );
  }

  if (type === "sticker" && src) {
    return <img src={src} alt="Sticker" style={{ width: 120, height: 120, objectFit: "contain", display: "block" }} />;
  }

  if (type === "video" && src) {
    return <video src={src} controls style={{ maxWidth: "100%", width: 260, borderRadius: 10, display: "block" }} />;
  }

  if (type === "audio" && src) {
    return <audio src={src} controls style={{ width: 240, maxWidth: "100%" }} />;
  }

  if (type === "document") {
    const name = msg.mediaFilename ?? "Document";
    const ext = name.includes(".") ? name.split(".").pop()!.toUpperCase() : (msg.mediaMime?.split("/")[1]?.toUpperCase() ?? "FILE");
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 12px", borderRadius: 10, background: cardBg, border: `0.5px solid ${cardBorder}`, minWidth: 200, maxWidth: 280 }}>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          title="View"
          style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, textDecoration: "none", minWidth: 0 }}
        >
          <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: isOut ? "rgba(255,255,255,0.18)" : "rgba(99,102,241,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FileText size={16} color={isOut ? "#fff" : "#818cf8"} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
            <div style={{ fontSize: 10.5, color: sub }}>{ext} · Tap to view</div>
          </div>
        </a>
        <button
          onClick={() => downloadMedia(src, downloadName(msg))}
          title="Download"
          aria-label="Download"
          style={{ background: "none", border: "none", cursor: "pointer", color: sub, display: "flex", flexShrink: 0, padding: 4 }}
        >
          <Download size={15} />
        </button>
      </div>
    );
  }

  if (type === "location" && msg.location) {
    const { lat, lng, name, address } = msg.location;
    const href = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: cardBg, border: `0.5px solid ${cardBorder}`, textDecoration: "none", minWidth: 180, maxWidth: 260 }}
      >
        <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: isOut ? "rgba(255,255,255,0.18)" : "rgba(37,211,102,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <MapPin size={16} color={isOut ? "#fff" : "#25d366"} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name || "Shared location"}</div>
          <div style={{ fontSize: 10.5, color: sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{address || "Open in Maps"}</div>
        </div>
      </a>
    );
  }

  if (type === "contacts") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: cardBg, border: `0.5px solid ${cardBorder}`, minWidth: 180, maxWidth: 260 }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, background: isOut ? "rgba(255,255,255,0.18)" : "rgba(99,102,241,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <User size={16} color={isOut ? "#fff" : "#818cf8"} />
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{msg.body || "Contact"}</div>
      </div>
    );
  }

  // Media expected but source unavailable (e.g. inbound link expired)
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: sub }}>
      <FileText size={14} /> Attachment unavailable
    </div>
  );
}

export { humanSize };
