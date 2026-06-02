"use client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { T1, T2, T3, GLASS, GLASS_BORDER, AC } from "@/lib/ds";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ImportField { key: string; label: string; required?: boolean }
export interface ImportConfig {
  resource: string;
  title: string;
  endpoint: string;
  fields: ImportField[];
  aliases: Record<string, string>;
}

const norm = (s: string) => s.toLowerCase().trim().replace(/[\s_-]+/g, "_");

export const IMPORT_CONFIGS: Record<"customers" | "products" | "services", ImportConfig> = {
  customers: {
    resource: "customers", title: "Import customers", endpoint: "/api/customers/bulk",
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "phone_no", label: "Phone", required: true },
      { key: "email", label: "Email" }, { key: "company", label: "Company" },
      { key: "address", label: "Address" }, { key: "notes", label: "Notes" },
    ],
    aliases: { name: "name", full_name: "name", customer_name: "name", phone: "phone_no", phone_no: "phone_no", mobile: "phone_no", tel: "phone_no", email: "email", email_address: "email", company: "company", company_name: "company", organisation: "company", organization: "company", address: "address", location: "address", notes: "notes", note: "notes", comments: "notes" },
  },
  products: {
    resource: "products", title: "Import products", endpoint: "/api/products/bulk",
    fields: [
      { key: "name", label: "Name", required: true }, { key: "sku", label: "SKU" },
      { key: "default_price", label: "Price" }, { key: "stock_qty", label: "Stock" },
      { key: "low_stock_threshold", label: "Low-stock level" }, { key: "category", label: "Category" },
      { key: "unit", label: "Unit" }, { key: "description", label: "Description" },
    ],
    aliases: { name: "name", product_name: "name", title: "name", item: "name", sku: "sku", code: "sku", item_code: "sku", barcode: "sku", price: "default_price", default_price: "default_price", unit_price: "default_price", rate: "default_price", selling_price: "default_price", stock: "stock_qty", stock_qty: "stock_qty", stock_quantity: "stock_qty", quantity: "stock_qty", qty: "stock_qty", low_stock: "low_stock_threshold", low_stock_threshold: "low_stock_threshold", reorder_level: "low_stock_threshold", category: "category", type: "category", unit: "unit", uom: "unit", description: "description", desc: "description", details: "description" },
  },
  services: {
    resource: "services", title: "Import services", endpoint: "/api/services/bulk",
    fields: [
      { key: "name", label: "Name", required: true }, { key: "default_price", label: "Price" },
      { key: "category", label: "Category" }, { key: "unit", label: "Unit" }, { key: "description", label: "Description" },
    ],
    aliases: { name: "name", service_name: "name", title: "name", item: "name", price: "default_price", default_price: "default_price", unit_price: "default_price", rate: "default_price", category: "category", type: "category", unit: "unit", uom: "unit", description: "description", desc: "description", details: "description" },
  },
};

const selectStyle: React.CSSProperties = { padding: "5px 8px", background: "var(--glass)", border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 7, fontSize: 12, color: T1, outline: "none", fontFamily: "inherit", maxWidth: 180 };

export function ImportSheet({ open, onOpenChange, config, onDone }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  config: ImportConfig;
  onDone?: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{ created: number; skipped: number; errors: number; errorRows: any[] } | null>(null);

  function reset() { setRows([]); setHeaders([]); setMapping({}); setReport(null); }
  function close() { reset(); onOpenChange(false); }

  async function onFile(file: File) {
    try {
      const X: any = await import("xlsx");
      const XLSX = X.read ? X : X.default;
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, any>[];
      if (!json.length) { toast.error("No rows found in that file."); return; }
      const hdrs = Object.keys(json[0]);
      const map: Record<string, string> = {};
      for (const h of hdrs) map[h] = config.aliases[norm(h)] ?? "";
      setRows(json); setHeaders(hdrs); setMapping(map); setReport(null);
    } catch {
      toast.error("Couldn't read that file. Use a .csv or .xlsx export.");
    }
  }

  const mappedFields = new Set(Object.values(mapping).filter(Boolean));
  const missingRequired = config.fields.filter((f) => f.required && !mappedFields.has(f.key));
  const canImport = rows.length > 0 && missingRequired.length === 0 && !busy;

  async function runImport() {
    setBusy(true);
    try {
      const mapped = rows.map((r) => {
        const o: Record<string, string> = {};
        for (const h of headers) {
          const field = mapping[h];
          if (field) o[field] = r[h] == null ? "" : String(r[h]);
        }
        return o;
      });
      const agg = { created: 0, skipped: 0, errors: 0, errorRows: [] as any[] };
      for (let i = 0; i < mapped.length; i += 500) {
        const res = await fetch(config.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: mapped.slice(i, i + 500) }),
        });
        const j = await res.json();
        if (!res.ok || !j.success) throw new Error(typeof j.error === "string" ? j.error : "Import failed");
        agg.created += j.data.created; agg.skipped += j.data.skipped; agg.errors += j.data.errors;
        agg.errorRows.push(...j.data.results.filter((x: any) => x.status === "error").slice(0, 20));
      }
      setReport(agg);
      onDone?.();
      toast.success(`Imported ${agg.created} ${config.resource}`);
    } catch (e: any) {
      toast.error(e.message ?? "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent style={{ maxWidth: 720 }}>
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>Upload a .csv or .xlsx file. Columns are matched automatically — adjust below if needed.</DialogDescription>
        </DialogHeader>

        {/* Step: result */}
        {report ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "8px 0" }}>
            <div style={{ display: "flex", gap: 10 }}>
              <Stat icon={<CheckCircle2 size={15} />} color="#22c55e" label="Created" value={report.created} />
              <Stat icon={<X size={15} />} color={T3} label="Skipped" value={report.skipped} />
              <Stat icon={<AlertTriangle size={15} />} color="#f59e0b" label="Errors" value={report.errors} />
            </div>
            {report.errorRows.length > 0 && (
              <div style={{ maxHeight: 180, overflowY: "auto", border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 8 }}>
                {report.errorRows.map((e, i) => (
                  <div key={i} style={{ padding: "7px 11px", borderBottom: `0.5px solid ${GLASS_BORDER}`, fontSize: 12, color: T2 }}>
                    Row {e.row}{e.name ? ` (${e.name})` : ""}: <span style={{ color: "#f59e0b" }}>{e.reason}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={close} style={primaryBtn}>Done</button>
            </div>
          </div>
        ) : rows.length === 0 ? (
          /* Step: upload */
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) void onFile(f); }}
            style={{ marginTop: 8, padding: "36px 20px", border: `1px dashed ${GLASS_BORDER}`, borderRadius: 12, textAlign: "center", cursor: "pointer", background: "var(--glass)" }}
          >
            <UploadCloud size={28} style={{ color: AC, marginBottom: 10 }} />
            <div style={{ fontSize: 13.5, fontWeight: 500, color: T1 }}>Click to choose, or drag a file here</div>
            <div style={{ fontSize: 12, color: T3, marginTop: 4 }}>.csv or .xlsx — up to 500 rows per import</div>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ""; }} />
          </div>
        ) : (
          /* Step: map + preview */
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T2 }}>
              <FileSpreadsheet size={14} style={{ color: AC }} /> {rows.length} row(s) detected
              <button onClick={reset} style={{ marginLeft: "auto", background: "none", border: "none", color: T3, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>Choose a different file</button>
            </div>

            {/* Column mapping */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: T3, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Column mapping</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 160, overflowY: "auto" }}>
                {headers.map((h) => (
                  <div key={h} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: T1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h}</span>
                    <span style={{ color: T3 }}>→</span>
                    <select value={mapping[h] ?? ""} onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value }))} style={selectStyle}>
                      <option value="">— Ignore —</option>
                      {config.fields.map((f) => <option key={f.key} value={f.key}>{f.label}{f.required ? " *" : ""}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div style={{ overflowX: "auto", border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 8 }}>
              <table style={{ borderCollapse: "collapse", fontSize: 11.5, width: "100%" }}>
                <thead>
                  <tr>{headers.map((h) => <th key={h} style={{ textAlign: "left", padding: "6px 9px", borderBottom: `0.5px solid ${GLASS_BORDER}`, background: GLASS, color: T3, whiteSpace: "nowrap" }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((r, i) => (
                    <tr key={i}>{headers.map((h) => <td key={h} style={{ padding: "6px 9px", borderTop: `0.5px solid ${GLASS_BORDER}`, color: T2, whiteSpace: "nowrap" }}>{String(r[h] ?? "")}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>

            {missingRequired.length > 0 && (
              <div style={{ fontSize: 12, color: "#f59e0b" }}>Map a column to: {missingRequired.map((f) => f.label).join(", ")}</div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={close} style={secondaryBtn}>Cancel</button>
              <button onClick={runImport} disabled={!canImport} style={{ ...primaryBtn, opacity: canImport ? 1 : 0.5, cursor: canImport ? "pointer" : "default" }}>
                {busy ? "Importing…" : `Import ${rows.length} row(s)`}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const primaryBtn: React.CSSProperties = { padding: "8px 16px", borderRadius: 9, background: AC, border: "none", color: "#fff", fontSize: 13, fontWeight: 500, cursor: "pointer" };
const secondaryBtn: React.CSSProperties = { padding: "8px 16px", borderRadius: 9, background: GLASS, border: `0.5px solid ${GLASS_BORDER}`, color: T2, fontSize: 13, cursor: "pointer" };

function Stat({ icon, color, label, value }: { icon: React.ReactNode; color: string; label: string; value: number }) {
  return (
    <div style={{ flex: 1, padding: "12px 14px", border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 10, display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color, fontSize: 12 }}>{icon} {label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: T1 }}>{value}</div>
    </div>
  );
}
