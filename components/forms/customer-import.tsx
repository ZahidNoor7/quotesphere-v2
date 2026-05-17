"use client";
import { useState, useRef } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Upload, Download, CheckCircle, XCircle, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { T1, T2, T3, GLASS_BORDER } from "@/lib/ds";

type ImportResult = {
  row: number;
  status: "created" | "skipped" | "error";
  name?: string;
  reason?: string;
};

type Summary = { created: number; skipped: number; errors: number; total: number; results: ImportResult[] };

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

const TEMPLATE_ROWS = [
  ["Name", "Phone", "Email", "Company", "Address", "Notes"],
  ["John Smith", "+1 555 0100", "john@example.com", "Acme Corp", "123 Main St", ""],
  ["Jane Doe", "+1 555 0101", "jane@example.com", "", "", "VIP client"],
];

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet(TEMPLATE_ROWS);
  ws["!cols"] = [{ wch: 20 }, { wch: 16 }, { wch: 24 }, { wch: 20 }, { wch: 28 }, { wch: 20 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Customers");
  XLSX.writeFile(wb, "customers_import_template.xlsx");
}

export function CustomerImportDialog({ open, onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [skipDupes, setSkipDupes] = useState(true);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  function reset() {
    setRows([]);
    setFileName("");
    setSummary(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const parsed: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (!parsed.length) { toast.error("No data rows found in the file."); return; }
      setRows(parsed);
      setFileName(file.name);
      setSummary(null);
    } catch {
      toast.error("Could not read file — make sure it's a valid CSV or Excel file.");
    }
  }

  async function runImport() {
    if (!rows.length) return;
    setImporting(true);
    try {
      const res = await fetch("/api/customers/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, skipDupes }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setSummary(data.data);
      if (data.data.created > 0) {
        onImported();
        toast.success(`${data.data.created} customer${data.data.created !== 1 ? "s" : ""} imported.`);
      }
    } catch (err: any) {
      toast.error(err.message || "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-xl w-[calc(100dvw-2rem)] sm:w-full">
        <DialogHeader>
          <DialogTitle>Import customers</DialogTitle>
          <DialogDescription>Upload a CSV or Excel file. Download the template to see the required column format.</DialogDescription>
        </DialogHeader>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Template download */}
          <button
            onClick={downloadTemplate}
            style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#818cf8", background: "rgba(99,102,241,0.08)", border: "0.5px solid rgba(99,102,241,0.2)", borderRadius: 8, padding: "8px 12px", cursor: "pointer", width: "fit-content" }}
          >
            <Download size={13} /> Download template (.xlsx)
          </button>

          {/* File picker */}
          <div
            onClick={() => fileRef.current?.click()}
            style={{ border: `1.5px dashed ${GLASS_BORDER}`, borderRadius: 10, padding: "24px 16px", textAlign: "center", cursor: "pointer", transition: "border-color 0.2s" }}
          >
            <Upload size={20} style={{ margin: "0 auto 8px", color: T3 }} />
            <div style={{ fontSize: 13, color: T2, marginBottom: 4 }}>
              {fileName ? fileName : "Click to select CSV or Excel file"}
            </div>
            {rows.length > 0 && (
              <div style={{ fontSize: 11, color: "#818cf8" }}>{rows.length} row{rows.length !== 1 ? "s" : ""} ready to import</div>
            )}
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={handleFile} />
          </div>

          {/* Options */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Switch id="skip-dupes" checked={skipDupes} onCheckedChange={setSkipDupes} />
            <Label htmlFor="skip-dupes" style={{ fontSize: 12, color: T2, cursor: "pointer" }}>
              Skip rows where phone number already exists
            </Label>
          </div>

          {/* Summary */}
          {summary && (
            <div style={{ borderRadius: 10, border: `0.5px solid ${GLASS_BORDER}`, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "12px 16px", gap: 8, borderBottom: `0.5px solid ${GLASS_BORDER}` }}>
                {[
                  { label: "Created", count: summary.created, color: "#34d399", Icon: CheckCircle },
                  { label: "Skipped", count: summary.skipped, color: "#fbbf24", Icon: SkipForward },
                  { label: "Errors",  count: summary.errors,  color: "#f87171", Icon: XCircle  },
                ].map(({ label, count, color, Icon }) => (
                  <div key={label} style={{ textAlign: "center" }}>
                    <Icon size={16} color={color} style={{ margin: "0 auto 4px" }} />
                    <div style={{ fontSize: 18, fontWeight: 600, color }}>{count}</div>
                    <div style={{ fontSize: 11, color: T3 }}>{label}</div>
                  </div>
                ))}
              </div>
              {summary.results.filter(r => r.status !== "created").length > 0 && (
                <div style={{ maxHeight: 160, overflowY: "auto", padding: "8px 0" }}>
                  {summary.results.filter(r => r.status !== "created").map(r => (
                    <div key={r.row} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 16px", fontSize: 11 }}>
                      <span style={{ color: T3 }}>Row {r.row}</span>
                      <span style={{ color: T1, flex: 1 }}>{r.name ?? "(unnamed)"}</span>
                      <span style={{ color: r.status === "skipped" ? "#fbbf24" : "#f87171" }}>{r.reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button variant="ghost" onClick={handleClose}>Close</Button>
            {rows.length > 0 && !summary && (
              <Button onClick={runImport} loading={importing}>
                Import {rows.length} row{rows.length !== 1 ? "s" : ""}
              </Button>
            )}
            {summary && (
              <Button variant="secondary" onClick={reset}>Import another file</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
