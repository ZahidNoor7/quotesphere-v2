"use client";
import Link from "next/link";
import { FileText, Receipt, User, ArrowRight } from "lucide-react";
import { T1, T3, GLASS, GLASS_BORDER, AC } from "@/lib/ds";
import { formatCurrency, getInitials } from "@/lib/utils";
import type { AssistantDocumentCard } from "@/types";

const TYPE_META = {
  quotation: { label: "Quotation", color: "#6366f1", Icon: FileText },
  invoice: { label: "Invoice", color: "#16a34a", Icon: Receipt },
  customer: { label: "Customer", color: "#8b5cf6", Icon: User },
} as const;

function StatusPill({ status, color }: { status: string; color: string }) {
  return (
    <span
      style={{
        fontSize: 9.5,
        fontWeight: 600,
        textTransform: "capitalize",
        padding: "2px 7px",
        borderRadius: 999,
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        color,
        border: `0.5px solid color-mix(in srgb, ${color} 30%, transparent)`,
      }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

/** Rich preview card for a quotation / invoice / customer the assistant created or updated. */
export function DocumentCard({ card }: { card: AssistantDocumentCard }) {
  const meta = TYPE_META[card.type];
  const Icon = meta.Icon;
  const isCustomer = card.type === "customer";

  return (
    <Link href={card.link} style={{ textDecoration: "none", display: "block", marginTop: 8, maxWidth: 340 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", borderRadius: 12, background: GLASS, border: `0.5px solid ${GLASS_BORDER}` }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: isCustomer ? "50%" : 9,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `color-mix(in srgb, ${meta.color} 14%, transparent)`,
            border: `0.5px solid color-mix(in srgb, ${meta.color} 30%, transparent)`,
            color: meta.color,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {isCustomer ? getInitials(card.label || "?") : <Icon size={17} />}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: T3 }}>{meta.label}</span>
            {card.status && <StatusPill status={card.status} color={meta.color} />}
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: T1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.label}</div>
          {card.subtitle && (
            <div style={{ fontSize: 11.5, color: T3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.subtitle}</div>
          )}
        </div>

        {typeof card.amount === "number" ? (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: T1 }}>{formatCurrency(card.amount, card.currency || "PKR")}</div>
            <div style={{ fontSize: 10, color: AC, display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end", marginTop: 2 }}>
              View <ArrowRight size={11} />
            </div>
          </div>
        ) : (
          <ArrowRight size={15} style={{ color: AC, flexShrink: 0 }} />
        )}
      </div>
    </Link>
  );
}
