"use client";
import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { T1, T3, GLASS, GLASS_BORDER, AC } from "@/lib/ds";

/**
 * Inline notice shown where a feature is unavailable because its integration
 * (Cloudinary, Currency exchange, …) isn't configured. Links straight to setup.
 */
export function IntegrationGateNotice({ title, detail }: { title: string; detail?: string }) {
  return (
    <Link
      href="/settings/integrations"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 10,
        border: `0.5px solid ${GLASS_BORDER}`,
        background: GLASS,
        textDecoration: "none",
        color: T1,
      }}
    >
      <AlertTriangle size={15} style={{ color: "#f59e0b", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: T1 }}>{title}</div>
        {detail && <div style={{ fontSize: 11.5, color: T3, marginTop: 1, lineHeight: 1.45 }}>{detail}</div>}
      </div>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600, color: AC, flexShrink: 0 }}>
        Configure <ArrowRight size={13} />
      </span>
    </Link>
  );
}
