"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

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

import { useIsMobile } from "@/hooks/use-mobile";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { GLASS_BORDER, T2, T3 } from "@/lib/ds";
import type { Currency, Product } from "@/types";

const CURRENCIES: Currency[] = ["PKR", "USD", "EUR", "GBP", "AED", "SAR"];

const schema = z.object({
  name: z.string().trim().min(1, "Product name is required").max(200),
  sku: z.string().trim().max(100).optional(),
  category: z.string().min(1, "Select a category"),
  unit: z.string().min(1, "Select a unit"),
  default_price: z.number({ message: "Enter a valid price" }).min(0, "Price can't be negative"),
  currency: z.enum(["PKR", "USD", "EUR", "GBP", "AED", "SAR"]),
  stock_qty: z.number({ message: "Enter a valid quantity" }).int("Whole numbers only").min(0, "Can't be negative"),
  low_stock_threshold: z.number({ message: "Enter a valid number" }).int("Whole numbers only").min(0, "Can't be negative"),
  description: z.string().max(1000).optional(),
  is_active: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

function toDefaults(product: Product | null, categories: string[], units: string[]): FormValues {
  return {
    name: product?.name ?? "",
    sku: product?.sku ?? "",
    category: product?.category ?? categories[0] ?? "General",
    unit: product?.unit ?? units[0] ?? "pcs",
    default_price: product?.default_price ?? 0,
    currency: product?.currency ?? "PKR",
    stock_qty: product?.stock_qty ?? 0,
    low_stock_threshold: product?.low_stock_threshold ?? 5,
    description: product?.description ?? "",
    is_active: product?.is_active ?? true,
  };
}

interface ProductSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  categories: string[];
  units: string[];
  onSaved: () => void;
}

export function ProductSheet({ open, onOpenChange, product, categories, units, onSaved }: ProductSheetProps) {
  const isMobile = useIsMobile();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toDefaults(product, categories, units),
  });
  const { isDirty, isSubmitting } = form.formState;

  // Re-seed the form whenever the sheet is opened (for a new product or a different one).
  useEffect(() => {
    if (open) form.reset(toDefaults(product, categories, units));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product]);

  // Guard browser reload / tab close / back-forward while there are unsaved edits.
  useUnsavedChanges(open && isDirty, () => setConfirmOpen(true));

  function requestClose(next: boolean) {
    if (!next && isDirty) {
      setConfirmOpen(true);
      return;
    }
    onOpenChange(next);
  }

  function discardAndClose() {
    setConfirmOpen(false);
    form.reset(toDefaults(product, categories, units));
    onOpenChange(false);
  }

  async function onSubmit(values: FormValues) {
    try {
      const payload = { ...values, sku: values.sku?.trim() || undefined };
      const res = await fetch(product ? `/api/products/${product._id}` : "/api/products", {
        method: product ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(typeof data.error === "string" ? data.error : "Could not save product");
      }
      // Reset to submitted values so the form is no longer dirty before closing.
      form.reset(values);
      toast.success(product ? "Product updated." : "Product added.");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save product");
    }
  }

  const numField = (field: { value: number; onChange: (v: number) => void; onBlur: () => void; name: string; ref: React.Ref<HTMLInputElement> }, opts?: { int?: boolean }) => ({
    name: field.name, ref: field.ref, onBlur: field.onBlur,
    value: Number.isFinite(field.value) ? field.value : "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const n = opts?.int ? parseInt(e.target.value, 10) : e.target.valueAsNumber;
      field.onChange(Number.isNaN(n) ? 0 : n);
    },
  });

  return (
    <>
      <Sheet open={open} onOpenChange={requestClose}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          onInteractOutside={e => { if (isDirty) e.preventDefault(); }}
          onEscapeKeyDown={e => { if (isDirty) { e.preventDefault(); setConfirmOpen(true); } }}
          className={isMobile
            ? "flex flex-col p-0 gap-0 h-[90vh] overflow-hidden rounded-t-2xl"
            : "flex flex-col p-0 gap-0 sm:w-[480px] sm:max-w-[480px]"}
        >
          <SheetHeader style={{ padding: "16px 20px 12px", borderBottom: `0.5px solid ${GLASS_BORDER}`, flexShrink: 0 }}>
            <SheetTitle>{product ? "Edit product" : "Add product"}</SheetTitle>
            <SheetDescription>
              {product ? "Update this product's details and stock." : "Add a physical product with SKU and stock tracking."}
            </SheetDescription>
          </SheetHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. USB-C Hub 7-port" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FormField control={form.control} name="sku" render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKU</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. USB-HUB-7P" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectGroup>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectGroup>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 1fr", gap: 12 }}>
                  <FormField control={form.control} name="unit" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectGroup>{units.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectGroup>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="default_price" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} step="0.01" inputMode="decimal" placeholder="0" {...numField(field)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="currency" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Currency" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectGroup>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectGroup>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FormField control={form.control} name="stock_qty" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock quantity</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} step="1" inputMode="numeric" placeholder="0" {...numField(field, { int: true })} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="low_stock_threshold" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Low stock alert at</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} step="1" inputMode="numeric" placeholder="5" {...numField(field, { int: true })} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Brief description of this product" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="is_active" render={({ field }) => (
                  <FormItem
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 14px", borderRadius: 10, border: `0.5px solid ${GLASS_BORDER}`, background: "var(--glass)" }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <FormLabel style={{ margin: 0 }}>Active</FormLabel>
                      <span style={{ fontSize: 11, color: T3 }}>Inactive products are hidden from quick-add.</span>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )} />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: `0.5px solid ${GLASS_BORDER}`, flexShrink: 0 }}>
                <Button type="button" variant="outline" onClick={() => requestClose(false)} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" loading={isSubmitting}>{product ? "Save changes" : "Add product"}</Button>
              </div>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription style={{ color: T2 }}>
              You have unsaved changes. If you leave now they will be lost.
            </AlertDialogDescription>
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
