"use client";
import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { T1, T2, T3 } from "@/lib/ds";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Global Error Boundary]", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        padding: "32px 16px",
        background: "var(--bg-primary, #0d1120)",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(239,68,68,0.12)",
          border: "0.5px solid rgba(239,68,68,0.3)",
        }}
      >
        <AlertTriangle className="w-8 h-8 text-destructive" />
      </div>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <h1 style={{ color: T1, fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
          Something went wrong
        </h1>
        <p style={{ color: T3, fontSize: 14, lineHeight: 1.6 }}>
          An unexpected error occurred. If this keeps happening, please contact support.
        </p>
        {error.digest && (
          <p style={{ color: T3, fontSize: 11, marginTop: 8 }}>
            Error ID: {error.digest}
          </p>
        )}
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <Button variant="outline" onClick={reset} className="gap-2">
          <RefreshCw className="w-3.5 h-3.5" />
          Try again
        </Button>
        <Button variant="ghost" onClick={() => (window.location.href = "/dashboard")} className="gap-2">
          <Home className="w-3.5 h-3.5" />
          Go home
        </Button>
      </div>
    </div>
  );
}
