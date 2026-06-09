"use client";
import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2, Star } from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/dialog";
import { MoneyInput } from "@/components/payroll/money-input";

import { useIsMobile } from "@/hooks/use-mobile";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { GLASS_BORDER, T1, T2, T3, AC2 } from "@/lib/ds";
import type { Currency, SalaryStructure } from "@/types";

const CURRENCIES: Currency[] = ["PKR", "USD", "EUR", "GBP", "AED", "SAR"];

const componentSchema = z.object({
  name: z.string().trim().min(1, "Required").max(120),
  type: z.enum(["earning", "deduction"]),
  calculation: z.enum(["fixed", "percentage_of_basic"]),
  value: z.number().min(0),
  isBasic: z.boolean(),
  taxable: z.boolean(),
});

const schema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(160),
    currency: z.enum(["PKR", "USD", "EUR", "GBP", "AED", "SAR"]),
    active: z.boolean(),
    components: z.array(componentSchema).min(1, "Add at least one component"),
  })
  .refine((v) => v.components.filter((c) => c.isBasic).length === 1, { message: "Mark exactly one component as Basic", path: ["components"] })
  .refine((v) => { const b = v.components.find((c) => c.isBasic); return !b || (b.type === "earning" && b.calculation === "fixed"); }, { message: "The Basic component must be a fixed earning", path: ["components"] });

type FormValues = z.infer<typeof schema>;

function toDefaults(s: SalaryStructure | null): FormValues {
  if (!s) {
    return {
      name: "",
      currency: "PKR",
      active: true,
      components: [{ name: "Basic", type: "earning", calculation: "fixed", value: 0, isBasic: true, taxable: true }],
    };
  }
  return {
    name: s.name,
    currency: s.currency ?? "PKR",
    active: s.active,
    components: s.components.map((c) => ({
      name: c.name, type: c.type, calculation: c.calculation, value: c.value, isBasic: !!c.isBasic, taxable: c.taxable !== false,
    })),
  };
}

export function SalaryStructureSheet({
  open, onOpenChange, structure, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  structure: SalaryStructure | null;
  onSaved: () => void;
}) {
  const isMobile = useIsMobile();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toDefaults(structure) });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "components" });
  const { isDirty, isSubmitting } = form.formState;
  const components = form.watch("components");

  useEffect(() => {
    if (open) form.reset(toDefaults(structure));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, structure]);

  useUnsavedChanges(open && isDirty, () => setConfirmOpen(true));

  function requestClose(next: boolean) {
    if (!next && isDirty) { setConfirmOpen(true); return; }
    onOpenChange(next);
  }
  function discardAndClose() {
    setConfirmOpen(false);
    form.reset(toDefaults(structure));
    onOpenChange(false);
  }

  function makeBasic(index: number) {
    fields.forEach((_, i) => form.setValue(`components.${i}.isBasic`, i === index, { shouldDirty: true }));
    form.setValue(`components.${index}.type`, "earning", { shouldDirty: true });
    form.setValue(`components.${index}.calculation`, "fixed", { shouldDirty: true });
  }

  async function onSubmit(values: FormValues) {
    try {
      const res = await fetch(structure ? `/api/payroll/salary-structures/${structure._id}` : "/api/payroll/salary-structures", {
        method: structure ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(typeof data.error === "string" ? data.error : "Could not save structure");
      form.reset(values);
      toast.success(structure ? "Structure updated." : "Structure created.");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save structure");
    }
  }

  const componentsError = form.formState.errors.components?.message || form.formState.errors.components?.root?.message;

  return (
    <>
      <Sheet open={open} onOpenChange={requestClose}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          onInteractOutside={(e) => { if (isDirty) e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (isDirty) { e.preventDefault(); setConfirmOpen(true); } }}
          className={isMobile ? "flex flex-col p-0 gap-0 h-[90dvh] overflow-hidden rounded-t-2xl" : "flex flex-col p-0 gap-0 sm:w-[560px] sm:max-w-[560px]"}
        >
          <SheetHeader style={{ padding: "16px 20px 12px", borderBottom: `0.5px solid ${GLASS_BORDER}`, flexShrink: 0 }}>
            <SheetTitle>{structure ? "Edit salary structure" : "New salary structure"}</SheetTitle>
            <SheetDescription>Define earnings &amp; deductions. Mark exactly one earning as the Basic — percentage components are computed off it.</SheetDescription>
          </SheetHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Structure name *</FormLabel><FormControl><Input placeholder="e.g. Engineering — Standard" autoFocus {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="currency" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent><SelectGroup>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectGroup></SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: T1 }}>Components</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => append({ name: "", type: "earning", calculation: "fixed", value: 0, isBasic: false, taxable: true })}>
                    <Plus className="size-3.5" />Add component
                  </Button>
                </div>
                {componentsError && <div style={{ fontSize: 12, color: "#f87171" }}>{componentsError}</div>}

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {fields.map((f, i) => {
                    const calc = components?.[i]?.calculation ?? "fixed";
                    const isBasic = components?.[i]?.isBasic;
                    return (
                      <div key={f.id} style={{ border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 12, padding: 12, background: "var(--glass)", display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <FormField control={form.control} name={`components.${i}.name`} render={({ field }) => (
                            <FormItem style={{ flex: 1 }}><FormControl><Input placeholder="Component name (e.g. House Rent)" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <button type="button" title={isBasic ? "This is the Basic component" : "Mark as Basic"} onClick={() => makeBasic(i)}
                            style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "5px 9px", borderRadius: 8, cursor: "pointer", flexShrink: 0,
                              background: isBasic ? "color-mix(in srgb,var(--accent) 18%,transparent)" : "transparent",
                              color: isBasic ? AC2 : T3, border: `0.5px solid ${isBasic ? "color-mix(in srgb,var(--accent) 30%,transparent)" : GLASS_BORDER}` }}>
                            <Star className="size-3" fill={isBasic ? "currentColor" : "none"} />Basic
                          </button>
                          <IconRemove disabled={fields.length <= 1} onClick={() => remove(i)} />
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1.2fr", gap: 8 }}>
                          <FormField control={form.control} name={`components.${i}.type`} render={({ field }) => (
                            <FormItem>
                              <Select value={field.value} onValueChange={field.onChange} disabled={isBasic}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent><SelectGroup>
                                  <SelectItem value="earning">Earning</SelectItem>
                                  <SelectItem value="deduction">Deduction</SelectItem>
                                </SelectGroup></SelectContent>
                              </Select>
                            </FormItem>
                          )} />
                          <FormField control={form.control} name={`components.${i}.calculation`} render={({ field }) => (
                            <FormItem>
                              <Select value={field.value} onValueChange={field.onChange} disabled={isBasic}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent><SelectGroup>
                                  <SelectItem value="fixed">Fixed amount</SelectItem>
                                  <SelectItem value="percentage_of_basic">% of Basic</SelectItem>
                                </SelectGroup></SelectContent>
                              </Select>
                            </FormItem>
                          )} />
                          <FormField control={form.control} name={`components.${i}.value`} render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                {calc === "fixed" ? (
                                  <MoneyInput valueMinor={field.value} onChangeMinor={field.onChange} />
                                ) : (
                                  <Input type="number" min={0} max={100} step="0.01" inputMode="decimal" placeholder="%" value={Number.isFinite(field.value) ? field.value : ""}
                                    onChange={(e) => field.onChange(Number.isNaN(e.target.valueAsNumber) ? 0 : e.target.valueAsNumber)} />
                                )}
                              </FormControl>
                            </FormItem>
                          )} />
                        </div>

                        {components?.[i]?.type === "earning" && (
                          <FormField control={form.control} name={`components.${i}.taxable`} render={({ field }) => (
                            <FormItem style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                              <span style={{ fontSize: 12, color: T3 }}>Taxable earning</span>
                            </FormItem>
                          )} />
                        )}
                      </div>
                    );
                  })}
                </div>

                <FormField control={form.control} name="active" render={({ field }) => (
                  <FormItem style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 14px", borderRadius: 10, border: `0.5px solid ${GLASS_BORDER}`, background: "var(--glass)" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <FormLabel style={{ margin: 0 }}>Active</FormLabel>
                      <span style={{ fontSize: 11, color: T3 }}>Inactive structures can&rsquo;t be assigned to new employees.</span>
                    </div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
                )} />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: `0.5px solid ${GLASS_BORDER}`, flexShrink: 0 }}>
                <Button type="button" variant="outline" onClick={() => requestClose(false)} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" loading={isSubmitting}>{structure ? "Save changes" : "Create structure"}</Button>
              </div>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription style={{ color: T2 }}>You have unsaved changes. If you leave now they will be lost.</AlertDialogDescription>
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

function IconRemove({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title="Remove"
      style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1, background: "var(--glass)", border: `0.5px solid ${GLASS_BORDER}`, color: "#f87171" }}>
      <Trash2 className="size-3.5" />
    </button>
  );
}
