"use client";
import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { FeatureCarousel } from "@/components/auth/feature-carousel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const T1 = "#eef0ff";
const T3 = "rgba(160,170,255,0.42)";

export default function RegisterPage() {
  const router = useRouter();
  const { status } = useSession();
  const [name, setName] = useState("");
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
    if (password.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!data.success) { toast.error(data.error || "Registration failed."); setLoading(false); return; }
      toast.success("Account created! Signing you in…");
      await signIn("credentials", { email, password, callbackUrl: "/dashboard" });
    } catch { toast.error("Something went wrong."); setLoading(false); }
  }

  return (
    <>
      <div className="auth-page" style={{ minHeight: "100dvh", display: "grid", gridTemplateColumns: "1fr 1fr", background: "#0d1120" }}>

        {/* ── Left: Form ── */}
        <div className="auth-form-panel" style={{ display: "flex", flexDirection: "column", padding: "32px 48px", background: "#0d1120" }}>
          {/* Logo */}
          <div className="auth-logo" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 60 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff", boxShadow: "0 4px 14px rgba(99,102,241,0.4)" }}>Q</div>
            <span style={{ fontSize: 16, fontWeight: 600, color: T1, letterSpacing: "-0.01em" }}>QuoteSphere</span>
          </div>

          <div className="auth-form-inner" style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 360 }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: T1, letterSpacing: "-0.02em", marginBottom: 8 }}>
              Create your account
            </h1>
            <p style={{ fontSize: 14, color: T3, marginBottom: 32 }}>
              Free to get started, no credit card needed
            </p>

            {/* Google */}
            <Button
              variant="outline"
              type="button"
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
              className="w-full h-10.5 rounded-[10px] text-[13px] justify-center gap-2.5 mb-6"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </Button>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <div style={{ flex: 1, height: "0.5px", background: "rgba(255,255,255,0.09)" }} />
              <span style={{ fontSize: 12, color: T3 }}>or</span>
              <div style={{ flex: 1, height: "0.5px", background: "rgba(255,255,255,0.09)" }} />
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 12, color: T3, fontWeight: 500 }}>Full name</label>
                <Input
                  type="text" value={name} required placeholder="Jane Smith"
                  onChange={e => setName(e.target.value)}
                  style={{ fontSize: 13, borderRadius: 10, padding: "10px 12px" }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 12, color: T3, fontWeight: 500 }}>Email address</label>
                <Input
                  type="email" value={email} required placeholder="you@company.com"
                  onChange={e => setEmail(e.target.value)}
                  style={{ fontSize: 13, borderRadius: 10, padding: "10px 12px" }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 12, color: T3, fontWeight: 500 }}>Password</label>
                <div style={{ position: "relative" }}>
                  <Input
                    type={showPw ? "text" : "password"} value={password} required placeholder="Min. 8 characters"
                    onChange={e => setPassword(e.target.value)}
                    style={{ fontSize: 13, borderRadius: 10, padding: "10px 12px", paddingRight: 42 }}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T3, display: "flex" }}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <Button
                type="submit" loading={loading}
                className="w-full h-10.5 rounded-[10px] text-[13px] mt-1"
              >
                Create account
              </Button>
            </form>

            <p style={{ fontSize: 13, color: T3, marginTop: 24, textAlign: "center" }}>
              Already have an account?{" "}
              <Link href="/auth/login" style={{ color: "#818cf8", textDecoration: "none", fontWeight: 500 }}>
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* ── Right: Feature Carousel ── */}
        <FeatureCarousel />
      </div>

      <style>{`
        @media (max-width: 768px) {
          .auth-page { grid-template-columns: 1fr !important; }
          .auth-carousel-panel { display: none !important; }
          .auth-form-panel { padding: 28px 24px !important; min-height: 100dvh; box-sizing: border-box; }
          .auth-form-inner { max-width: 100% !important; }
          .auth-logo { margin-bottom: 36px !important; }
        }
        @media (max-width: 400px) {
          .auth-form-panel { padding: 24px 18px !important; }
        }
      `}</style>
    </>
  );
}
