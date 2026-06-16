import { ImageResponse } from "next/og";

// Dynamically generated social-share image for the landing page. Served at
// /opengraph-image (allow-listed as public in auth.config.ts). CSS-only, no
// external fonts/assets, so it renders fast and never hits the DB.
export const alt = "QuoteSphere — Run your whole business in one place";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "linear-gradient(135deg,#0d1632 0%,#0a0f1e 45%,#0f0a2e 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 72,
              height: 72,
              borderRadius: 20,
              background: "linear-gradient(135deg,#6366f1,#818cf8)",
              color: "#fff",
              fontSize: 40,
              fontWeight: 700,
            }}
          >
            Q
          </div>
          <div style={{ display: "flex", color: "#eef0ff", fontSize: 36, fontWeight: 600 }}>
            QuoteSphere
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "flex",
              color: "#eef0ff",
              fontSize: 68,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
            }}
          >
            Run your whole business in one place
          </div>
          <div style={{ display: "flex", color: "rgba(210,216,255,0.72)", fontSize: 30 }}>
            Invoicing · Quotations · Expenses · Projects · Payroll · AI
          </div>
        </div>

        <div style={{ display: "flex", color: "#818cf8", fontSize: 26, fontWeight: 600 }}>
          Dual-currency · Pixel-perfect PDFs · Secure multi-tenant
        </div>
      </div>
    ),
    { ...size },
  );
}
