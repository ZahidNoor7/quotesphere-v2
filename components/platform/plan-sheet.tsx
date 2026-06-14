"use client";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { platformMutate } from "@/lib/platform/client";
import { GATEABLE_FEATURES } from "@/lib/entitlements/features";
import { GLASS_BORDER, T1, T3 } from "@/lib/ds";
import type { Plan } from "@/types";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  slug: z.string().trim().min(1, "Slug is required").max(60).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only"),
  description: z.string().max(400).optional(),
  billing_interval: z.enum(["monthly", "annual", "lifetime"]),
  price_pkr: z.number({ message: "Enter a price" }).min(0),
  price_usd: z.number({ message: "Enter a price" }).min(0),
  features: z.array(z.string()),
  is_active: z.boolean(),
  sort_order: z.number().int(),
});
type FormValues = z.infer<typeof schema>;

function toDefaults(plan: Plan | null): FormValues {
  return {
    name: plan?.name ?? "",
    slug: plan?.slug ?? "",
    description: plan?.description ?? "",
    billing_interval: plan?.billing_interval ?? "monthly",
    price_pkr: plan?.price_pkr ?? 0,
    price_usd: plan?.price_usd ?? 0,
    features: plan?.features ?? [],
    is_active: plan?.is_active ?? true,
    sort_order: plan?.sort_order ?? 0,
  };
}

const CATEGORIES: { key: string; label: string }[] = [
  { key: "sales", label: "Sales" },
  { key: "catalog", label: "Catalog" },
  { key: "admin", label: "Admin" },
  { key: "communication", label: "Communication" },
  { key: "ai", label: "AI" },
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  plan: Plan | null;
  onSaved: () => void;
}

export function PlanSheet({ open, onOpenChange, plan, onSaved }: Props) {
  const isMobile = useIsMobile();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toDefaults(plan) });
  const { isDirty, isSubmitting } = form.formState;
  const features = form.watch("features");

  useEffect(() => {
    if (open) form.reset(toDefaults(plan));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, plan]);

  useUnsavedChanges(open && isDirty && !isSubmitting, () => setConfirmOpen(true));

  function toggleFeature(key: string) {
    const has = features.includes(key);
    form.setValue("features", has ? features.filter((f) => f !== key) : [...features, key], { shouldDirty: true });
  }

  function requestClose(next: boolean) {
    if (!next && isDirty && !isSubmitting) { setConfirmOpen(true); return; }
    onOpenChange(next);
  }
  function discardAndClose() {
    setConfirmOpen(false);
    form.reset(toDefaults(plan));
    onOpenChange(false);
  }

  async function onSubmit(values: FormValues) {
    try {
      await platformMutate(
        plan ? `/api/platform/plans/${plan._id}` : "/api/platform/plans",
        plan ? "PUT" : "POST",
        values,
      );
      form.reset(values);
      toast.success(plan ? "Plan updated." : "Plan created.");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save plan");
    }
  }

  const numField = (field: { value: number; onChange: (v: number) => void; onBlur: () => void; name: string; ref: React.Ref<HTMLInputElement> }) => ({
    name: field.name, ref: field.ref, onBlur: field.onBlur,
    value: Number.isFinite(field.value) ? field.value : "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const n = e.target.valueAsNumber;
      field.onChange(Number.isNaN(n) ? 0 : n);
    },
  });

  return (
    <>
      <Sheet open={open} onOpenChange={requestClose}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          onInteractOutside={(e) => { if (isDirty && !isSubmitting) e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (isDirty && !isSubmitting) { e.preventDefault(); setConfirmOpen(true); } }}
          className={isMobile
            ? "flex flex-col p-0 gap-0 h-[90dvh] overflow-hidden rounded-t-2xl"
            : "flex flex-col p-0 gap-0 sm:w-[480px] sm:max-w-[480px]"}
        >
          <SheetHeader style={{ padding: "16px 20px 12px", borderBottom: `0.5px solid ${GLASS_BORDER}`, flexShrink: 0 }}>
            <SheetTitle>{plan ? "Edit plan" : "New plan"}</SheetTitle>
            <SheetDescription>Pick which features this plan unlocks. Prices are stored in both PKR and USD.</SheetDescription>
          </SheetHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12 }}>
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Name *</FormLabel><FormControl><Input placeholder="Premium" autoFocus {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="slug" render={({ field }) => (
                    <FormItem><FormLabel>Slug *</FormLabel><FormControl><Input placeholder="premium" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={2} placeholder="Short summary shown to tenants" {...field} /></FormControl><FormMessage /></FormItem>
                )} />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <FormField control={form.control} name="billing_interval" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Interval</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent><SelectGroup>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="annual">Annual</SelectItem>
                          <SelectItem value="lifetime">Lifetime</SelectItem>
                        </SelectGroup></SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="price_pkr" render={({ field }) => (
                    <FormItem><FormLabel>Price (PKR)</FormLabel><FormControl><Input type="number" min={0} step="1" inputMode="numeric" placeholder="0" {...numField(field)} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="price_usd" render={({ field }) => (
                    <FormItem><FormLabel>Price (USD)</FormLabel><FormControl><Input type="number" min={0} step="0.01" inputMode="decimal" placeholder="0" {...numField(field)} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                {/* Feature picker (bound manually via form.setValue — not a FormField,
                    so use a plain label, NOT shadcn FormLabel which needs FormField context) */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: T1 }}>Features ({features.length})</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
                    {CATEGORIES.map((cat) => {
                      const items = GATEABLE_FEATURES.filter((f) => f.category === cat.key);
                      if (items.length === 0) return null;
                      return (
                        <div key={cat.key}>
                          <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.04em", color: T3, marginBottom: 6 }}>{cat.label}</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {items.map((f) => {
                              const on = features.includes(f.key);
                              return (
                                <button
                                  key={f.key}
                                  type="button"
                                  onClick={() => toggleFeature(f.key)}
                                  aria-pressed={on}
                                  style={{
                                    display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer",
                                    padding: "6px 10px", borderRadius: 8, fontSize: 12, fontWeight: 500,
                                    border: `0.5px solid ${on ? "rgba(129,140,248,0.5)" : GLASS_BORDER}`,
                                    background: on ? "rgba(129,140,248,0.14)" : "transparent",
                                    color: on ? "#a5b4fc" : T1, transition: "all 0.15s",
                                  }}
                                >
                                  {on && <Check size={12} />} {f.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "end" }}>
                  <FormField control={form.control} name="sort_order" render={({ field }) => (
                    <FormItem><FormLabel>Sort order</FormLabel><FormControl><Input type="number" step="1" inputMode="numeric" {...numField(field)} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="is_active" render={({ field }) => (
                    <FormItem style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 12px", borderRadius: 10, border: `0.5px solid ${GLASS_BORDER}` }}>
                      <FormLabel style={{ margin: 0 }}>Active</FormLabel>
                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>
                  )} />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: `0.5px solid ${GLASS_BORDER}`, flexShrink: 0 }}>
                <Button type="button" variant="outline" onClick={() => requestClose(false)} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" loading={isSubmitting}>{plan ? "Save changes" : "Create plan"}</Button>
              </div>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>You have unsaved changes. If you leave now they will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={discardAndClose}>Discard changes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
