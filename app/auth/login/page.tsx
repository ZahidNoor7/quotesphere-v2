"use client";
import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

const T1 = "#eef0ff";
const T2 = "rgba(210,216,255,0.72)";
const T3 = "rgba(160,170,255,0.42)";

export default function LoginPage() {
  const router = useRouter();
  const { status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);
  if (status === "loading" || status === "authenticated") return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      toast.error("Invalid email or password.");
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  const inputStyle = {
    width: "100%", background: "rgba(255,255,255,0.055)",
    border: "0.5px solid rgba(255,255,255,0.11)", borderRadius: 10,
    padding: "10px 12px", color: T1, fontSize: 13, outline: "none",
  } as const;

  return (
    <div style={{
      minHeight: "100vh", display: "grid",
      gridTemplateColumns: "1fr 1fr",
      background: "#0d1120",
    }}>
      {/* ── Left: Form ── */}
      <div style={{ display: "flex", flexDirection: "column", padding: "32px 48px", background: "#0d1120" }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 60 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: "#6366f1",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 700, color: "#fff",
            boxShadow: "0 4px 14px rgba(99,102,241,0.4)",
          }}>Q</div>
          <span style={{ fontSize: 16, fontWeight: 600, color: T1, letterSpacing: "-0.01em" }}>QuoteSphere</span>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 360 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: T1, letterSpacing: "-0.02em", marginBottom: 8 }}>
            Welcome back
          </h1>
          <p style={{ fontSize: 14, color: T3, marginBottom: 32 }}>
            Sign in to your QuoteSphere account
          </p>

          {/* Google */}
          <button
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
              gap: 10, height: 42, borderRadius: 10, cursor: "pointer",
              background: "rgba(255,255,255,0.055)", border: "0.5px solid rgba(255,255,255,0.14)",
              color: T2, fontSize: 13, fontWeight: 500, marginBottom: 24,
              transition: "all 0.15s",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <div style={{ flex: 1, height: "0.5px", background: "rgba(255,255,255,0.09)" }} />
            <span style={{ fontSize: 12, color: T3 }}>or</span>
            <div style={{ flex: 1, height: "0.5px", background: "rgba(255,255,255,0.09)" }} />
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 12, color: T3, fontWeight: 500 }}>Email address</label>
              <input
                type="email" value={email} required placeholder="you@company.com"
                onChange={e => setEmail(e.target.value)}
                style={inputStyle}
                onFocus={e => { (e.target as any).style.borderColor = "rgba(99,102,241,0.55)"; (e.target as any).style.background = "rgba(255,255,255,0.08)"; }}
                onBlur={e => { (e.target as any).style.borderColor = "rgba(255,255,255,0.11)"; (e.target as any).style.background = "rgba(255,255,255,0.055)"; }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 12, color: T3, fontWeight: 500 }}>Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPw ? "text" : "password"} value={password} required placeholder="••••••••"
                  onChange={e => setPassword(e.target.value)}
                  style={{ ...inputStyle, paddingRight: 42 }}
                  onFocus={e => { (e.target as any).style.borderColor = "rgba(99,102,241,0.55)"; (e.target as any).style.background = "rgba(255,255,255,0.08)"; }}
                  onBlur={e => { (e.target as any).style.borderColor = "rgba(255,255,255,0.11)"; (e.target as any).style.background = "rgba(255,255,255,0.055)"; }}
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T3, display: "flex" }}>
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <button
              type="submit" disabled={loading}
              style={{
                height: 42, borderRadius: 10, border: "none", cursor: loading ? "not-allowed" : "pointer",
                background: "linear-gradient(135deg,#6366f1,rgba(129,140,248,0.9))",
                color: "#fff", fontSize: 13, fontWeight: 600,
                boxShadow: "0 2px 14px rgba(99,102,241,0.4), 0 0 0 1px rgba(255,255,255,0.1) inset",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                opacity: loading ? 0.7 : 1, marginTop: 4,
              }}
            >
              {loading && <span style={{ width: 15, height: 15, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />}
              Sign in
            </button>
          </form>

          <p style={{ fontSize: 13, color: T3, marginTop: 24, textAlign: "center" }}>
            No account?{" "}
            <Link href="/auth/register" style={{ color: "#818cf8", textDecoration: "none", fontWeight: 500 }}>
              Sign up for free
            </Link>
          </p>
        </div>
      </div>

      {/* ── Right: Decorative ── */}
      <div style={{
        background: "linear-gradient(135deg,#0d1632 0%,#0a0f1e 40%,#0f0a2e 100%)",
        display: "flex", flexDirection: "column", position: "relative", overflow: "hidden",
      }}>
        {/* Glow orb */}
        <div style={{
          position: "absolute", width: 500, height: 500,
          background: "radial-gradient(circle,rgba(99,102,241,0.18) 0%,transparent 70%)",
          top: -150, right: -80, pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", width: 350, height: 350,
          background: "radial-gradient(circle,rgba(167,139,250,0.12) 0%,transparent 70%)",
          bottom: -80, left: 50, pointerEvents: "none",
        }} />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 48px", position: "relative", zIndex: 5 }}>
          {/* Mock invoice card */}
          <div style={{
            width: "100%", maxWidth: 340,
            background: "rgba(255,255,255,0.06)", backdropFilter: "blur(20px)",
            border: "0.5px solid rgba(255,255,255,0.14)", borderRadius: 16, padding: 20,
            marginBottom: 16,
            boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
            position: "relative", overflow: "hidden",
          }}>
            {/* Specular */}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,rgba(255,255,255,0.08) 0%,transparent 50%)", borderRadius: "inherit", pointerEvents: "none" }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: T3, marginBottom: 3, letterSpacing: "0.05em" }}>INVOICE</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: T1 }}>INV-00042</div>
                  <div style={{ fontSize: 11, color: T3, marginTop: 2 }}>Farooqi Interiors</div>
                </div>
                <span style={{
                  fontSize: 10.5, padding: "3px 9px", borderRadius: 100,
                  background: "rgba(52,211,153,0.15)", color: "#6ee7b7",
                  border: "0.5px solid rgba(52,211,153,0.25)", fontWeight: 500,
                }}>Paid</span>
              </div>
              {[["Office renovation work", "PKR 45,000"], ["Electrical installations", "PKR 12,000"], ["Paint & finishing", "PKR 8,500"]].map(([item, amt]) => (
                <div key={item} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
                  <span style={{ fontSize: 12, color: T2 }}>{item}</span>
                  <span style={{ fontSize: 12, color: T1, fontWeight: 500 }}>{amt}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(99,102,241,0.3)" }}>
                <span style={{ fontSize: 12, color: T3 }}>Total</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#818cf8" }}>PKR 65,500</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, width: "100%", maxWidth: 340 }}>
            {[
              { v: "PKR 2.4M", l: "Revenue", c: "#34d399" },
              { v: "148", l: "Invoices", c: "#60a5fa" },
              { v: "47", l: "Clients", c: "#a78bfa" },
            ].map(({ v, l, c }) => (
              <div key={l} style={{
                background: "rgba(255,255,255,0.055)", border: "0.5px solid rgba(255,255,255,0.11)",
                borderRadius: 12, padding: "12px 10px", textAlign: "center",
              }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: c }}>{v}</div>
                <div style={{ fontSize: 10, color: T3, marginTop: 3 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: "0 48px 48px", position: "relative", zIndex: 5 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: T1, letterSpacing: "-0.02em", lineHeight: 1.3, marginBottom: 10 }}>
            Manage your business<br />from one place
          </h2>
          <p style={{ fontSize: 14, color: T3, lineHeight: 1.7 }}>
            Invoices, quotations, expenses, clients and projects — all in QuoteSphere.
          </p>
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
