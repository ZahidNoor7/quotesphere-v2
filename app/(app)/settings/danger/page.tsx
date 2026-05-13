"use client";
import { Button } from "@/components/ui/button";
import { T3 } from "@/lib/ds";

export default function DangerSettingsPage() {
  return (
    <>
      <div style={{ fontSize: 14, fontWeight: 500, color: "#f87171", marginBottom: 16 }}>Danger zone</div>
      <div style={{ padding: 16, borderRadius: 10, border: "0.5px solid rgba(248,113,113,0.25)", background: "rgba(248,113,113,0.06)", marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#f87171", marginBottom: 6 }}>Delete all data</div>
        <div style={{ fontSize: 12, color: T3, marginBottom: 12 }}>This will permanently delete all invoices, quotations, clients, expenses and projects. This action cannot be undone.</div>
        <Button variant="destructive" size="sm">Delete all data</Button>
      </div>
      <div style={{ padding: 16, borderRadius: 10, border: "0.5px solid rgba(248,113,113,0.25)", background: "rgba(248,113,113,0.06)" }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#f87171", marginBottom: 6 }}>Delete account</div>
        <div style={{ fontSize: 12, color: T3, marginBottom: 12 }}>Permanently delete your account and all associated data.</div>
        <Button variant="destructive" size="sm">Delete account</Button>
      </div>
    </>
  );
}
