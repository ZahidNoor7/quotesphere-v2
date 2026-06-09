"use client";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { TableWrapper, DataTable, Th, Td } from "@/components/custom-ui/data-table";
import { ErrorState } from "@/components/shared/error-state";
import { MoneyInput } from "@/components/payroll/money-input";

import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { fromMinor, toMinor } from "@/lib/payroll/money";
import { CARD, T1, T2, T3, GLASS_BORDER } from "@/lib/ds";
import type { PayrollConfig } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json()).then((d) => d.data as PayrollConfig);

interface SlabRow { minAnnual: number; maxAnnual: number | null; fixedAmount: number; ratePercent: number }
interface State {
  taxYearLabel: string;
  currency: string;
  taxSlabs: SlabRow[];
  eobi: { enabled: boolean; employeeRate: number; employerRate: number; minWage: number };
  providentFund: { enabled: boolean; employeeRate: number; employerRate: number };
  statutory: { taxEnabled: boolean };
}

function fromConfig(c: PayrollConfig): State {
  return {
    taxYearLabel: c.taxYearLabel,
    currency: c.currency,
    taxSlabs: c.taxSlabs.map((s) => ({ ...s })),
    eobi: { ...c.eobi },
    providentFund: { ...c.providentFund },
    statutory: { ...c.statutory },
  };
}

function PercentInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <Input type="number" min={0} max={100} step="0.01" inputMode="decimal" value={Number.isFinite(value) ? value : ""}
      onChange={(e) => onChange(Number.isNaN(e.target.valueAsNumber) ? 0 : e.target.valueAsNumber)} />
  );
}

export default function PayrollConfigPage() {
  const { data: config, mutate, isLoading, error } = useSWR<PayrollConfig>("/api/payroll/config", fetcher);
  const [state, setState] = useState<State | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (config && !state) setState(fromConfig(config)); }, [config, state]);

  const dirty = useMemo(() => {
    if (!config || !state) return false;
    return JSON.stringify(state) !== JSON.stringify(fromConfig(config));
  }, [config, state]);

  useUnsavedChanges(dirty, () => {});

  if (isLoading || !state) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}><div className="size-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }
  if (error) return <div style={{ padding: 20 }}><ErrorState message="Failed to load config." onRetry={() => mutate()} /></div>;

  const cur = state.currency;
  const updateSlab = (i: number, patch: Partial<SlabRow>) => setState((s) => s && ({ ...s, taxSlabs: s.taxSlabs.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  const addSlab = () => setState((s) => s && ({ ...s, taxSlabs: [...s.taxSlabs, { minAnnual: 0, maxAnnual: null, fixedAmount: 0, ratePercent: 0 }] }));
  const removeSlab = (i: number) => setState((s) => s && ({ ...s, taxSlabs: s.taxSlabs.filter((_, j) => j !== i) }));

  async function save() {
    if (!state) return;
    setSaving(true);
    try {
      const res = await fetch("/api/payroll/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taxYearLabel: state.taxYearLabel,
          taxSlabs: state.taxSlabs,
          eobi: state.eobi,
          providentFund: state.providentFund,
          statutory: state.statutory,
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(typeof d.error === "string" ? d.error : "Could not save config");
      await mutate(d.data, false);
      setState(fromConfig(d.data));
      toast.success("Payroll config saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save config");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: "18px 20px", height: "100%", overflowY: "auto", display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: T2 }}>Tax year</div>
        <Input value={state.taxYearLabel} onChange={(e) => setState((s) => s && ({ ...s, taxYearLabel: e.target.value }))} style={{ width: 120 }} />
        <div style={{ fontSize: 12, color: T3 }}>Amounts in {cur}. Values seed from FBR 2025-26 — edit when the slab table changes.</div>
        <div style={{ marginLeft: "auto" }}>
          <Button size="sm" onClick={save} loading={saving} disabled={!dirty}><Save className="size-4" />Save changes</Button>
        </div>
      </div>

      {/* Income tax slabs */}
      <div style={{ ...CARD, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T1 }}>Income tax slabs (annual)</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: T3 }}>Tax enabled</span>
            <Switch checked={state.statutory.taxEnabled} onCheckedChange={(v) => setState((s) => s && ({ ...s, statutory: { taxEnabled: v } }))} />
          </div>
        </div>
        <TableWrapper>
          <DataTable>
            <thead>
              <tr>
                <Th>From (annual)</Th>
                <Th>To (annual, blank = no limit)</Th>
                <Th style={{ width: 160 }}>Fixed tax</Th>
                <Th style={{ width: 110 }}>Rate %</Th>
                <Th style={{ width: 50 }}></Th>
              </tr>
            </thead>
            <tbody>
              {state.taxSlabs.map((slab, i) => (
                <tr key={i}>
                  <Td style={{ padding: 8 }}><MoneyInput valueMinor={slab.minAnnual} onChangeMinor={(n) => updateSlab(i, { minAnnual: n })} /></Td>
                  <Td style={{ padding: 8 }}>
                    <Input type="number" min={0} step="0.01" placeholder="∞" value={slab.maxAnnual === null ? "" : fromMinor(slab.maxAnnual)}
                      onChange={(e) => updateSlab(i, { maxAnnual: e.target.value === "" || Number.isNaN(e.target.valueAsNumber) ? null : toMinor(e.target.valueAsNumber) })} />
                  </Td>
                  <Td style={{ padding: 8 }}><MoneyInput valueMinor={slab.fixedAmount} onChangeMinor={(n) => updateSlab(i, { fixedAmount: n })} /></Td>
                  <Td style={{ padding: 8 }}><PercentInput value={slab.ratePercent} onChange={(n) => updateSlab(i, { ratePercent: n })} /></Td>
                  <Td style={{ padding: 8, textAlign: "center" }}>
                    <button type="button" onClick={() => removeSlab(i)} title="Remove" style={{ background: "none", border: "none", cursor: "pointer", color: "#f87171" }}><Trash2 className="size-4" /></button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </TableWrapper>
        <div style={{ marginTop: 10 }}>
          <Button variant="outline" size="sm" onClick={addSlab}><Plus className="size-3.5" />Add slab</Button>
        </div>
      </div>

      {/* EOBI + PF */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
        <div style={{ ...CARD, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T1 }}>EOBI</div>
            <Switch checked={state.eobi.enabled} onCheckedChange={(v) => setState((s) => s && ({ ...s, eobi: { ...s.eobi, enabled: v } }))} />
          </div>
          <Field label={`Minimum wage (${cur})`}><MoneyInput valueMinor={state.eobi.minWage} onChangeMinor={(n) => setState((s) => s && ({ ...s, eobi: { ...s.eobi, minWage: n } }))} /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Employee %"><PercentInput value={state.eobi.employeeRate} onChange={(n) => setState((s) => s && ({ ...s, eobi: { ...s.eobi, employeeRate: n } }))} /></Field>
            <Field label="Employer %"><PercentInput value={state.eobi.employerRate} onChange={(n) => setState((s) => s && ({ ...s, eobi: { ...s.eobi, employerRate: n } }))} /></Field>
          </div>
        </div>

        <div style={{ ...CARD, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T1 }}>Provident fund</div>
            <Switch checked={state.providentFund.enabled} onCheckedChange={(v) => setState((s) => s && ({ ...s, providentFund: { ...s.providentFund, enabled: v } }))} />
          </div>
          <div style={{ fontSize: 12, color: T3 }}>Percent of Basic. Employer share is tracked for employer-cost reporting only.</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Employee %"><PercentInput value={state.providentFund.employeeRate} onChange={(n) => setState((s) => s && ({ ...s, providentFund: { ...s.providentFund, employeeRate: n } }))} /></Field>
            <Field label="Employer %"><PercentInput value={state.providentFund.employerRate} onChange={(n) => setState((s) => s && ({ ...s, providentFund: { ...s.providentFund, employerRate: n } }))} /></Field>
          </div>
        </div>
      </div>

      <div style={{ height: 4 }} />
      <div style={{ position: "sticky", bottom: 0, display: dirty ? "flex" : "none", justifyContent: "flex-end", gap: 8, padding: "10px 0", borderTop: `0.5px solid ${GLASS_BORDER}`, background: "var(--glass-surface-bg)" }}>
        <Button variant="outline" size="sm" onClick={() => config && setState(fromConfig(config))}>Discard</Button>
        <Button size="sm" onClick={save} loading={saving}><Save className="size-4" />Save changes</Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: T3, marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}
