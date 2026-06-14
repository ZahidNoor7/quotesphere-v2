"use client";
import { Lock } from "lucide-react";
import { getFeatureDef } from "@/lib/entitlements/features";
import { T1, T3, AC } from "@/lib/ds";
import type { FeatureKey } from "@/types";

/**
 * Centered "this module isn't in your plan" screen, rendered by a gateable
 * module's guard when the tenant's plan doesn't include the feature. Styled to
 * match the existing IntegrationGateNotice gating UX.
 */
export function FeatureLocked({ feature }: { feature: FeatureKey }) {
  const def = getFeatureDef(feature);
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        height: "100%", minHeight: 360, gap: 12, textAlign: "center", padding: 24,
      }}
    >
      <div
        style={{
          width: 48, height: 48, borderRadius: 14, marginBottom: 4,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(129,140,248,0.14)",
        }}
      >
        <Lock size={22} style={{ color: AC }} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: T1 }}>
        {def?.label ?? "This feature"} isn’t in your plan
      </div>
      <div style={{ fontSize: 13, color: T3, maxWidth: 380, lineHeight: 1.6 }}>
        {def?.description ? `${def.description}. ` : ""}
        Ask your administrator to upgrade your plan to unlock it.
      </div>
    </div>
  );
}
