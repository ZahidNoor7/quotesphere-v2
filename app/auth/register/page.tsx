"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";

const T1 = "#eef0ff", T2 = "rgba(210,216,255,0.72)", T3 = "rgba(160,170,255,0.42)";

export default function RegisterPage() {
  const router = useRouter();
  const { status } = useSession();
  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);
  if (status === "loading" || status === "authenticated") return null;
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) { toast.error(data.error || "Registration failed."); setLoading(false); return; }
      toast.success("Account created! Signing you in…");
      await signIn("credentials", { email: form.email, password: form.password, callbackUrl: "/dashboard" });
    } catch { toast.error("Something went wrong."); setLoading(false); }
  }

  const inputStyle = {
    width: "100%", background: "rgba(255,255,255,0.055)", border: "0.5px solid rgba(255,255,255,0.11)",
    borderRadius: 10, padding: "10px 12px", color: T1, fontSize: 13, outline: "none",
  } as const;

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#0d1632 0%,#0a0f1e 40%,#0f0a2e 100%)", padding: "20px", position: "relative" }}>
      <div style={{ position: "absolute", width: 500, height: 500, background: "radial-gradient(circle,rgba(99,102,241,0.14) 0%,transparent 70%)", top: -150, right: "10%", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 380, position: "relative", zIndex: 5 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 32 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 700, color: "#fff", boxShadow: "0 4px 16px rgba(99,102,241,0.4)" }}>Q</div>
          <span style={{ fontSize: 17, fontWeight: 700, color: T1, letterSpacing: "-0.01em" }}>QuoteSphere</span>
        </div>

        <div style={{ background: "rgba(18,22,40,0.85)", backdropFilter: "blur(40px) saturate(180%)", WebkitBackdropFilter: "blur(40px) saturate(180%)", border: "0.5px solid rgba(255,255,255,0.13)", borderRadius: 18, padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: T1, letterSpacing: "-0.02em", marginBottom: 6 }}>Create your account</h1>
          <p style={{ fontSize: 13, color: T3, marginBottom: 24 }}>Free to get started, no credit card needed</p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { key: "name" as const, label: "Full name", type: "text", placeholder: "Jane Smith" },
              { key: "email" as const, label: "Email", type: "email", placeholder: "jane@company.com" },
              { key: "password" as const, label: "Password", type: "password", placeholder: "Min. 8 characters" },
            ].map(({ key, label, type, placeholder }) => (
              <div key={key} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 12, color: T3, fontWeight: 500 }}>{label}</label>
                <input type={type} required placeholder={placeholder} value={form[key]}
                  onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  style={inputStyle}
                  onFocus={e => { (e.target as any).style.borderColor = "rgba(99,102,241,0.55)"; (e.target as any).style.background = "rgba(255,255,255,0.08)"; }}
                  onBlur={e => { (e.target as any).style.borderColor = "rgba(255,255,255,0.11)"; (e.target as any).style.background = "rgba(255,255,255,0.055)"; }}
                />
              </div>
            ))}
            <button type="submit" disabled={loading}
              style={{ height: 42, borderRadius: 10, border: "none", cursor: loading ? "not-allowed" : "pointer", background: "linear-gradient(135deg,#6366f1,rgba(129,140,248,0.9))", color: "#fff", fontSize: 13, fontWeight: 600, boxShadow: "0 2px 14px rgba(99,102,241,0.4), 0 0 0 1px rgba(255,255,255,0.1) inset", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: loading ? 0.7 : 1, marginTop: 4 }}
            >
              {loading ? <span style={{ width: 15, height: 15, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} /> : <>Create account<ArrowRight size={14} /></>}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", fontSize: 13, color: T3, marginTop: 20 }}>
          Already have an account?{" "}
          <Link href="/auth/login" style={{ color: "#818cf8", textDecoration: "none", fontWeight: 500 }}>Sign in</Link>
        </p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
