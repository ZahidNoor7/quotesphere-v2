"use client";
import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, ShieldCheck, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PlatformFeaturePanel } from "@/components/platform/platform-feature-panel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const T1 = "#eef0ff";
const T3 = "rgba(160,170,255,0.42)";

export default function PlatformLoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.isPlatformAdmin)
      router.replace("/platform");
  }, [status, session, router]);
  if (
    status === "loading" ||
    (status === "authenticated" && session?.user?.isPlatformAdmin)
  )
    return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await signIn("platform-credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      toast.error("Invalid credentials.");
    } else {
      router.push("/platform");
      router.refresh();
    }
  }

  return (
    <>
      <div
        className="auth-page"
        style={{
          minHeight: "100dvh",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          background: "#0d1120",
        }}
      >
        {/* ── Left: Form ── */}
        <div
          className="auth-form-panel"
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "32px 48px",
            background: "#0d1120",
          }}
        >
          {/* Logo */}
          <div
            className="auth-logo"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 60,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "linear-gradient(135deg,#6366f1,#4f46e5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                boxShadow: "0 4px 14px rgba(99,102,241,0.4)",
              }}
            >
              <ShieldCheck size={18} />
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                lineHeight: 1.15,
              }}
            >
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: T1,
                  letterSpacing: "-0.01em",
                }}
              >
                Platform Console
              </span>
              <span style={{ fontSize: 10.5, color: T3 }}>QuoteSphere</span>
            </div>
          </div>

          <div
            className="auth-form-inner"
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              maxWidth: 380,
            }}
          >
            <h1
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: T1,
                letterSpacing: "-0.02em",
                marginBottom: 8,
              }}
            >
              Welcome back
            </h1>
            <p style={{ fontSize: 14, color: T3, marginBottom: 32 }}>
              Sign in to the platform console — super-admin access only.
            </p>

            <form
              onSubmit={handleSubmit}
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label
                  htmlFor="pf-email"
                  style={{ fontSize: 12, color: T3, fontWeight: 500 }}
                >
                  Email address
                </label>
                <Input
                  id="pf-email"
                  type="email"
                  value={email}
                  required
                  autoComplete="email"
                  placeholder="owner@company.com"
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    fontSize: 13,
                    borderRadius: 10,
                    padding: "10px 12px",
                  }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label
                  htmlFor="pf-password"
                  style={{ fontSize: 12, color: T3, fontWeight: 500 }}
                >
                  Password
                </label>
                <div style={{ position: "relative" }}>
                  <Input
                    id="pf-password"
                    type={showPw ? "text" : "password"}
                    value={password}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      fontSize: 13,
                      borderRadius: 10,
                      padding: "10px 12px",
                      paddingRight: 42,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                    style={{
                      position: "absolute",
                      right: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: T3,
                      display: "flex",
                    }}
                  >
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                loading={loading}
                className="w-full h-10.5 rounded-[10px] text-[13px] mt-1"
              >
                Sign in
              </Button>
            </form>

            <div
              style={{
                marginTop: 24,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Link
                href="/auth/login"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  color: "#818cf8",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                <ArrowLeft size={14} /> Not a platform admin? Sign in to your
                account
              </Link>
              <span
                style={{
                  fontSize: 11.5,
                  color: T3,
                  textAlign: "center",
                  lineHeight: 1.6,
                }}
              >
                Restricted area. Accounts are provisioned by the platform owner.
              </span>
            </div>
          </div>
        </div>

        {/* ── Right: Platform feature panel ── */}
        <PlatformFeaturePanel />
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
