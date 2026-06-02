/**
 * Global loading UI — the App Router Suspense fallback shown while the app
 * (or a route segment) is resolving. Branded, theme-aware, full-screen.
 * Server component: pure presentation, animations via CSS only.
 */
export default function Loading() {
  return (
    <div
      className="animate-in fade-in duration-500"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 22,
        background:
          "radial-gradient(120% 120% at 50% 0%, var(--app-bg-from), var(--app-bg-to))",
      }}
    >
      {/* Logo + orbiting ring */}
      <div
        style={{
          position: "relative",
          width: 72,
          height: 72,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* spinning accent ring */}
        <div
          className="animate-spin"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "2.5px solid color-mix(in srgb, var(--accent) 14%, transparent)",
            borderTopColor: "var(--accent)",
          }}
        />
        {/* Q brand badge — matches the sidebar mark */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 13,
            background: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 19,
            fontWeight: 600,
            color: "#fff",
            boxShadow:
              "0 0 0 1px rgba(255,255,255,0.15) inset, 0 6px 18px var(--accent-glow)",
          }}
        >
          Q
        </div>
      </div>

      {/* Wordmark */}
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 4 }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--t1)",
            letterSpacing: "-0.01em",
          }}
        >
          QuoteSphere
        </div>
        <div className="animate-pulse" style={{ fontSize: 12.5, color: "var(--t3)" }}>
          Loading your workspace…
        </div>
      </div>
    </div>
  );
}
