// Brand mark for the marketing surface. No "use client" so it can render inside
// both the server footer and the client nav. Theme-aware via ds.ts accent tokens.
export function Logo({ size = 32, withWordmark = true }: { size?: number; withWordmark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        aria-hidden
        className="inline-flex items-center justify-center font-bold"
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.28),
          fontSize: Math.round(size * 0.46),
          color: "var(--on-accent)",
          background: "linear-gradient(135deg, var(--accent), var(--accent2))",
          boxShadow: "0 4px 14px var(--accent-glow)",
        }}
      >
        Q
      </span>
      {withWordmark && (
        <span className="text-[17px] font-semibold tracking-tight" style={{ color: "var(--t1)" }}>
          QuoteSphere
        </span>
      )}
    </span>
  );
}
