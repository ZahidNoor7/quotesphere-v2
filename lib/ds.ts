// Design System tokens – use CSS custom properties so all components respond to theme changes.
// The actual values are set per-theme via [data-theme="X"] selectors in globals.css.
export const T1 = "var(--t1)";
export const T2 = "var(--t2)";
export const T3 = "var(--t3)";
export const AC = "var(--accent)";
export const AC2 = "var(--accent2)";
export const GLASS = "var(--glass)";
export const GLASS_HOVER = "var(--glass-hover)";
export const GLASS_BORDER = "var(--glass-border)";
export const GLASS_BORDER_STRONG = "var(--glass-border-strong)";

export const TOPBAR_STYLE: React.CSSProperties = {
  display: "flex", alignItems: "center", padding: "12px 20px", gap: 12,
  backdropFilter: "blur(24px) saturate(160%)", WebkitBackdropFilter: "blur(24px) saturate(160%)",
  background: "var(--glass-surface-bg)", borderBottom: "0.5px solid var(--glass-border)",
  flexWrap: "wrap" as const, flexShrink: 0,
};

export const TABLE_STYLE: React.CSSProperties = {
  width: "100%", borderCollapse: "collapse", fontSize: 12,
};
export const TH_STYLE: React.CSSProperties = {
  background: "var(--glass)", padding: "9px 12px", textAlign: "left",
  fontSize: 10.5, fontWeight: 500, color: "var(--t3)", letterSpacing: "0.05em", textTransform: "uppercase",
};
export const TD_STYLE: React.CSSProperties = {
  padding: "10px 12px", borderTop: "0.5px solid var(--glass-border)", color: "var(--t2)",
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};

export const GLASS_INPUT: React.CSSProperties = {
  background: "var(--glass)", border: "0.5px solid var(--glass-border)",
  borderRadius: 100, padding: "7px 13px", color: "var(--t1)", fontSize: 12, outline: "none",
};
export const GLASS_SELECT: React.CSSProperties = {
  background: "var(--glass)", border: "0.5px solid var(--glass-border)",
  borderRadius: 100, padding: "7px 12px", color: "var(--t2)", fontSize: 12, outline: "none", cursor: "pointer",
};
export const FIELD_INPUT: React.CSSProperties = {
  background: "var(--glass)", border: "0.5px solid var(--glass-border)",
  borderRadius: 8, padding: "7px 10px", color: "var(--t1)", fontSize: 12, outline: "none", width: "100%",
};
export const TABLE_WRAP: React.CSSProperties = {
  borderRadius: 12, border: "0.5px solid var(--glass-border)", overflow: "hidden",
  backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
};

export const ICON_PILL: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 100, display: "flex", alignItems: "center",
  justifyContent: "center", background: "var(--glass)", border: "0.5px solid var(--glass-border)",
  cursor: "pointer", color: "var(--t2)", fontSize: 12, transition: "all 0.15s",
};

export const CARD: React.CSSProperties = {
  background: "var(--glass)", backdropFilter: "blur(20px) saturate(160%)",
  WebkitBackdropFilter: "blur(20px) saturate(160%)",
  border: "0.5px solid var(--glass-border)", borderRadius: 12, overflow: "hidden",
};
