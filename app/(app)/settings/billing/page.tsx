"use client";
import { PlanSelector } from "@/components/billing/plan-selector";
import { T1, T3 } from "@/lib/ds";

export default function BillingPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1040 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: T1 }}>Plan &amp; billing</div>
        <div style={{ fontSize: 12.5, color: T3, marginTop: 2 }}>View your current plan and request an upgrade or downgrade.</div>
      </div>
      <PlanSelector />
    </div>
  );
}
