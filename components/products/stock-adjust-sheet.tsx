"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/dialog";

import { useIsMobile } from "@/hooks/use-mobile";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { cn } from "@/lib/utils";
import { GLASS_BORDER, T1, T2, T3, AC2 } from "@/lib/ds";
import type { Product } from "@/types";

interface StockAdjustSheetProps {
  product: Product | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

export function StockAdjustSheet({ product, onOpenChange, onDone }: StockAdjustSheetProps) {
  const isMobile = useIsMobile();
  const [delta, setDelta] = useState("");
  const [mode, setMode] = useState<"add" | "remove">("add");
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const open = product !== null;

  useEffect(() => {
    if (open) { setDelta(""); setMode("add"); }
  }, [open, product?._id]);

  const dirty = delta.trim() !== "" && !loading;
  useUnsavedChanges(open && dirty, () => setConfirmOpen(true));

  function requestClose(next: boolean) {
    if (!next && dirty) { setConfirmOpen(true); return; }
    onOpenChange(next);
  }

  const n = parseInt(delta, 10);
  const valid = Number.isFinite(n) && n > 0;
  const projected = product
    ? mode === "add" ? product.stock_qty + (valid ? n : 0) : Math.max(0, product.stock_qty - (valid ? n : 0))
    : 0;

  async function apply() {
    if (!product) return;
    if (!valid) { toast.error("Enter a valid quantity."); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${product._id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock_qty: projected }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(typeof data.error === "string" ? data.error : "Could not update stock");
      toast.success(`Stock updated to ${projected} ${product.unit}.`);
      setDelta("");
      onDone();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update stock");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={requestClose}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          onInteractOutside={e => { if (dirty) e.preventDefault(); }}
          onEscapeKeyDown={e => { if (dirty) { e.preventDefault(); setConfirmOpen(true); } }}
          className={isMobile
            ? "flex flex-col p-0 gap-0 rounded-t-2xl"
            : "flex flex-col p-0 gap-0 sm:w-[400px] sm:max-w-[400px]"}
        >
          <SheetHeader style={{ padding: "16px 20px 12px", borderBottom: `0.5px solid ${GLASS_BORDER}`, flexShrink: 0 }}>
            <SheetTitle>Adjust stock</SheetTitle>
            <SheetDescription>{product?.name}</SheetDescription>
          </SheetHeader>

          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 13, color: T2 }}>
              Current stock: <strong style={{ color: T1 }}>{product?.stock_qty} {product?.unit}</strong>
            </div>

            {/* Add / Remove toggle */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {(["add", "remove"] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn("flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors")}
                  style={{
                    border: `0.5px solid ${mode === m ? "rgba(99,102,241,0.5)" : GLASS_BORDER}`,
                    background: mode === m ? "rgba(99,102,241,0.12)" : "var(--glass)",
                    color: mode === m ? AC2 : T2,
                    cursor: "pointer",
                  }}
                >
                  {m === "add" ? <Plus className="size-3.5" /> : <Minus className="size-3.5" />}
                  {m === "add" ? "Add stock" : "Remove stock"}
                </button>
              ))}
            </div>

            <div>
              <Label style={{ fontSize: 11, color: T3, fontWeight: 500, marginBottom: 6, display: "block" }}>
                Quantity to {mode}
              </Label>
              <Input
                type="number" min={1} step="1" inputMode="numeric"
                value={delta}
                onChange={e => setDelta(e.target.value)}
                placeholder="e.g. 10"
                autoFocus
                onKeyDown={e => { if (e.key === "Enter") apply(); }}
              />
            </div>

            <div style={{ fontSize: 12, color: T3 }}>
              New stock will be{" "}
              <strong style={{ color: valid ? AC2 : T2 }}>{projected} {product?.unit}</strong>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: `0.5px solid ${GLASS_BORDER}`, flexShrink: 0 }}>
            <Button type="button" variant="outline" onClick={() => requestClose(false)} disabled={loading}>Cancel</Button>
            <Button onClick={apply} loading={loading} disabled={!valid}>Apply</Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard stock change?</AlertDialogTitle>
            <AlertDialogDescription style={{ color: T2 }}>
              You entered a quantity that hasn&rsquo;t been applied yet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmOpen(false); setDelta(""); onOpenChange(false); }}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
