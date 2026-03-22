import { cn } from "@/lib/utils";

const T1 = "#eef0ff";
const T2 = "rgba(210,216,255,0.72)";
const T3 = "rgba(160,170,255,0.42)";

export function PageContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div style={{ padding: "18px 20px" }} className={cn("space-y-4", className)}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", justifyContent: "space-between",
      gap: 12, padding: "12px 20px",
      backdropFilter: "blur(24px) saturate(160%)",
      WebkitBackdropFilter: "blur(24px) saturate(160%)",
      background: "rgba(10,15,30,0.5)",
      borderBottom: "0.5px solid rgba(255,255,255,0.08)",
      flexWrap: "wrap",
      flexShrink: 0,
    }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: T1, letterSpacing: "-0.01em" }}>{title}</div>
        {description && <div style={{ fontSize: 12, color: T3, marginTop: 2 }}>{description}</div>}
      </div>
      {children && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {children}
        </div>
      )}
    </div>
  );
}

export function StatCard({
  label, value, sub, icon, color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  color?: string;
  valueClassName?: string;
}) {
  return (
    <div className="kpi-card" style={{ padding: "14px 16px" }}>
      {icon && (
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: "rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 10, fontSize: 14, color: T2,
        }}>{icon}</div>
      )}
      <div style={{ fontSize: 20, fontWeight: 600, color: color || T1, letterSpacing: "-0.02em", lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: T3, marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: T3, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export function EmptyState({
  icon, title, description, action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 16px", textAlign: "center" }}>
      <div style={{ color: "rgba(160,170,255,0.2)", marginBottom: 14 }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: T2, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, color: T3, maxWidth: 280, lineHeight: 1.6 }}>{description}</div>
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
    </div>
  );
}
