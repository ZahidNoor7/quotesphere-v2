"use client";
import { useState, useEffect, useRef, useCallback } from "react";

const T1 = "#eef0ff";
const T2 = "rgba(210,216,255,0.72)";
const T3 = "rgba(160,170,255,0.42)";

const STATUS: Record<string, { c: string; bg: string; label: string }> = {
  active:   { c: "#6ee7b7", bg: "rgba(52,211,153,0.14)", label: "Active" },
  trialing: { c: "#a5b4fc", bg: "rgba(129,140,248,0.14)", label: "Trialing" },
  past_due: { c: "#fcd34d", bg: "rgba(251,191,36,0.16)", label: "Past due" },
  expired:  { c: "#fca5a5", bg: "rgba(248,113,113,0.15)", label: "Expired" },
};

function Badge({ s }: { s: keyof typeof STATUS | string }) {
  const st = STATUS[s] ?? STATUS.expired;
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 999, background: st.bg, color: st.c, whiteSpace: "nowrap" }}>
      {st.label}
    </span>
  );
}

function OverviewMock() {
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: T1 }}>Platform overview</span>
        <span style={{ fontSize: 12, color: T3 }}>124 tenants</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        {[
          { v: "124", l: "Total", c: T1 },
          { v: "18", l: "Trialing", c: "#a5b4fc" },
          { v: "92", l: "Active", c: "#6ee7b7" },
          { v: "6", l: "Past due", c: "#fcd34d" },
        ].map((s) => (
          <div key={s.l} style={{ background: "rgba(255,255,255,0.055)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 11, padding: "11px 10px" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: s.c }}>{s.v}</div>
            <div style={{ fontSize: 11, color: T3, marginTop: 2 }}>{s.l}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        {[{ v: "PKR 1.86M", l: "PKR collected" }, { v: "$4,820", l: "USD collected" }].map((r) => (
          <div key={r.l} style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "13px 15px" }}>
            <div style={{ fontSize: 11, color: T3, marginBottom: 4 }}>{r.l}</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: "#818cf8" }}>{r.v}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 15px" }}>
        <div style={{ fontSize: 11.5, color: T3, marginBottom: 8 }}>Trials expiring soon</div>
        {[["Nova Labs", "2d"], ["Orbit Co", "4d"], ["Zen Works", "6d"]].map(([n, d]) => (
          <div key={n} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
            <span style={{ fontSize: 12, color: T2 }}>{n}</span>
            <span style={{ fontSize: 12, color: "#fca5a5" }}>{d} left</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TenantsMock() {
  const rows = [
    { n: "Acme Studio", p: "Premium", s: "active" },
    { n: "Nova Labs", p: "Basic", s: "trialing" },
    { n: "Orbit Co", p: "Free", s: "past_due" },
    { n: "Zen Works", p: "Premium", s: "active" },
    { n: "Pixel Form", p: "Basic", s: "trialing" },
  ];
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: T1 }}>Tenants</span>
        <span style={{ fontSize: 12, color: T3 }}>All organizations</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r) => (
          <div key={r.n} style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.09)", borderRadius: 11, padding: "10px 13px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T1 }}>{r.n}</div>
              <div style={{ fontSize: 11, color: T3, marginTop: 2 }}>{r.p}</div>
            </div>
            <Badge s={r.s} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PlansMock() {
  const plans = [
    { n: "Free", price: "Free", sub: "forever", feats: "5 features", current: false },
    { n: "Basic", price: "Rs 2,500", sub: "/mo · $9", feats: "9 features", current: false },
    { n: "Premium", price: "Rs 6,000", sub: "/mo · $22", feats: "12 features", current: true },
  ];
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: T1 }}>Plans</span>
        <span style={{ fontSize: 12, color: T3 }}>PKR + USD</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {plans.map((p) => (
          <div key={p.n} style={{ background: "rgba(255,255,255,0.05)", border: `0.5px solid ${p.current ? "rgba(129,140,248,0.5)" : "rgba(255,255,255,0.09)"}`, borderRadius: 12, padding: "13px 15px", boxShadow: p.current ? "0 0 0 3px rgba(129,140,248,0.14)" : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: T1 }}>{p.n}</span>
                {p.current && <span style={{ fontSize: 10, fontWeight: 600, color: "#a5b4fc", background: "rgba(129,140,248,0.14)", padding: "1px 7px", borderRadius: 999 }}>Popular</span>}
              </div>
              <span style={{ fontSize: 11, color: T3 }}>{p.feats}</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: "#818cf8" }}>{p.price}</span>
              <span style={{ fontSize: 12, color: T3 }}>{p.sub}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SubscriptionsMock() {
  const rows = [
    { n: "Acme Studio", p: "Premium", s: "active", req: null },
    { n: "Nova Labs", p: "Basic", s: "trialing", req: "Premium" },
    { n: "Orbit Co", p: "Free", s: "past_due", req: "Basic" },
    { n: "Metro Works", p: "Premium", s: "active", req: null },
  ];
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: T1 }}>Subscriptions</span>
        <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, background: "#818cf8", color: "#fff", fontWeight: 600 }}>2 requests</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r) => (
          <div key={r.n} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.09)", borderRadius: 11, padding: "10px 13px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T1 }}>{r.n}</div>
              <div style={{ fontSize: 11, color: T3, marginTop: 2 }}>{r.p}</div>
            </div>
            {r.req && (
              <span style={{ fontSize: 10.5, fontWeight: 600, color: "#a5b4fc", background: "rgba(129,140,248,0.14)", padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>
                ↑ {r.req}
              </span>
            )}
            <Badge s={r.s} />
          </div>
        ))}
      </div>
    </div>
  );
}

const SLIDES = [
  { id: "overview", title: "The whole platform at a glance", subtitle: "Tenants by status, revenue per currency, and the trials about to expire.", Component: OverviewMock },
  { id: "tenants", title: "Every tenant in one place", subtitle: "Search, filter and manage each organization's plan, status and billing.", Component: TenantsMock },
  { id: "plans", title: "Plans & pricing, your way", subtitle: "Compose feature tiers and set PKR + USD pricing for every plan.", Component: PlansMock },
  { id: "subscriptions", title: "Subscriptions & requests", subtitle: "Approve upgrades, mark payments and act on renewal requests in a click.", Component: SubscriptionsMock },
];

export function PlatformFeaturePanel() {
  const [displayActive, setDisplayActive] = useState(0);
  const [visible, setVisible] = useState(true);
  const activeRef = useRef(0);
  const isPausedRef = useRef(false);

  const goTo = useCallback((idx: number) => {
    if (idx === activeRef.current) return;
    setVisible(false);
    setTimeout(() => {
      activeRef.current = idx;
      setDisplayActive(idx);
      setVisible(true);
    }, 220);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!isPausedRef.current) goTo((activeRef.current + 1) % SLIDES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [goTo]);

  const slide = SLIDES[displayActive];

  return (
    <div
      className="auth-carousel-panel"
      onMouseEnter={() => { isPausedRef.current = true; }}
      onMouseLeave={() => { isPausedRef.current = false; }}
      style={{
        background: "linear-gradient(135deg,#0d1632 0%,#0a0f1e 40%,#0f0a2e 100%)",
        display: "flex", flexDirection: "column", position: "relative", overflow: "hidden",
      }}
    >
      {/* Glow orbs */}
      <div style={{ position: "absolute", width: 600, height: 600, background: "radial-gradient(circle,rgba(99,102,241,0.18) 0%,transparent 70%)", top: -200, right: -100, pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 400, height: 400, background: "radial-gradient(circle,rgba(167,139,250,0.12) 0%,transparent 70%)", bottom: -100, left: 40, pointerEvents: "none" }} />

      {/* Slide mock */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "36px 52px", position: "relative", zIndex: 5 }}>
        <div style={{ opacity: visible ? 1 : 0, transition: "opacity 0.22s ease", width: "100%", maxWidth: 460 }}>
          <slide.Component />
        </div>
      </div>

      {/* Title / subtitle / dots */}
      <div style={{ padding: "0 52px 40px", position: "relative", zIndex: 5 }}>
        <div style={{ opacity: visible ? 1 : 0, transition: "opacity 0.22s ease", minHeight: 80 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: T1, letterSpacing: "-0.02em", lineHeight: 1.3, marginBottom: 8 }}>{slide.title}</h2>
          <p style={{ fontSize: 13.5, color: T3, lineHeight: 1.7, margin: 0 }}>{slide.subtitle}</p>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 18, alignItems: "center" }}>
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Slide ${i + 1}`}
              style={{
                width: i === displayActive ? 24 : 8, height: 8, borderRadius: 4,
                background: i === displayActive ? "#6366f1" : "rgba(255,255,255,0.2)",
                border: "none", cursor: "pointer", transition: "all 0.3s ease", padding: 0,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
