"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { T1, T3, GLASS, GLASS_BORDER } from "@/lib/ds";

const MEMBERS = [{ n: "You (Owner)", e: "admin@company.com", r: "Admin", rc: "#818cf8" }];

export default function TeamSettingsPage() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <>
      <div style={{ fontSize: 14, fontWeight: 500, color: T1, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: 8 }}>
        <span>Team & roles</span>
        <Button size="sm">+ Invite member</Button>
      </div>

      {isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {MEMBERS.map(u => (
            <div key={u.e} style={{ padding: "12px 14px", borderRadius: 10, border: `0.5px solid ${GLASS_BORDER}`, background: GLASS }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: T1 }}>{u.n}</div>
                <span style={{ fontSize: 10.5, padding: "2px 9px", borderRadius: 100, background: "rgba(99,102,241,0.15)", color: u.rc, border: "0.5px solid rgba(99,102,241,0.25)", flexShrink: 0 }}>{u.r}</span>
              </div>
              <div style={{ fontSize: 12, color: T3 }}>{u.e}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ borderRadius: 12, border: `0.5px solid ${GLASS_BORDER}`, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "var(--glass)" }}>
                {["Member", "Email", "Role", ""].map(h => (
                  <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 10.5, fontWeight: 500, color: T3, letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MEMBERS.map(u => (
                <tr key={u.e}>
                  <td style={{ padding: "10px 12px", borderTop: "0.5px solid var(--glass-border)", color: T1, fontWeight: 500 }}>{u.n}</td>
                  <td style={{ padding: "10px 12px", borderTop: "0.5px solid var(--glass-border)", color: T3 }}>{u.e}</td>
                  <td style={{ padding: "10px 12px", borderTop: "0.5px solid var(--glass-border)" }}>
                    <span style={{ fontSize: 10.5, padding: "2px 9px", borderRadius: 100, background: "rgba(99,102,241,0.15)", color: u.rc, border: "0.5px solid rgba(99,102,241,0.25)" }}>{u.r}</span>
                  </td>
                  <td style={{ padding: "10px 12px", borderTop: "0.5px solid var(--glass-border)", color: T3, fontSize: 11 }}>—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
