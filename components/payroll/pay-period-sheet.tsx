"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/dialog";

import { useIsMobile } from "@/hooks/use-mobile";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { GLASS_BORDER, T2 } from "@/lib/ds";
import type { PayPeriod } from "@/types";

const schema = z
  .object({
    label: z.string().trim().min(1, "Label is required").max(80),
    startDate: z.string().min(1, "Required"),
    endDate: z.string().min(1, "Required"),
    payDate: z.string().min(1, "Required"),
    status: z.enum(["open", "processing", "closed"]),
  })
  .refine((v) => new Date(v.startDate) <= new Date(v.endDate), { message: "Start must be on or before end", path: ["endDate"] });

type FormValues = z.infer<typeof schema>;

function toDefaults(p: PayPeriod | null): FormValues {
  return {
    label: p?.label ?? "",
    startDate: p?.startDate ? p.startDate.slice(0, 10) : "",
    endDate: p?.endDate ? p.endDate.slice(0, 10) : "",
    payDate: p?.payDate ? p.payDate.slice(0, 10) : "",
    status: p?.status ?? "open",
  };
}

export function PayPeriodSheet({
  open, onOpenChange, period, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: PayPeriod | null;
  onSaved: () => void;
}) {
  const isMobile = useIsMobile();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toDefaults(period) });
  const { isDirty, isSubmitting } = form.formState;

  useEffect(() => {
    if (open) form.reset(toDefaults(period));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, period]);

  useUnsavedChanges(open && isDirty, () => setConfirmOpen(true));

  function requestClose(next: boolean) {
    if (!next && isDirty) { setConfirmOpen(true); return; }
    onOpenChange(next);
  }
  function discardAndClose() {
    setConfirmOpen(false);
    form.reset(toDefaults(period));
    onOpenChange(false);
  }

  async function onSubmit(values: FormValues) {
    try {
      const res = await fetch(period ? `/api/payroll/pay-periods/${period._id}` : "/api/payroll/pay-periods", {
        method: period ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(typeof data.error === "string" ? data.error : "Could not save period");
      form.reset(values);
      toast.success(period ? "Period updated." : "Period created.");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save period");
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={requestClose}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          onInteractOutside={(e) => { if (isDirty) e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (isDirty) { e.preventDefault(); setConfirmOpen(true); } }}
          className={isMobile ? "flex flex-col p-0 gap-0 h-[90dvh] overflow-hidden rounded-t-2xl" : "flex flex-col p-0 gap-0 sm:w-[440px] sm:max-w-[440px]"}
        >
          <SheetHeader style={{ padding: "16px 20px 12px", borderBottom: `0.5px solid ${GLASS_BORDER}`, flexShrink: 0 }}>
            <SheetTitle>{period ? "Edit pay period" : "New pay period"}</SheetTitle>
            <SheetDescription>The window payroll is run for, plus the date employees are paid.</SheetDescription>
          </SheetHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                <FormField control={form.control} name="label" render={({ field }) => (
                  <FormItem><FormLabel>Label *</FormLabel><FormControl><Input placeholder="e.g. June 2026" autoFocus {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FormField control={form.control} name="startDate" render={({ field }) => (
                    <FormItem><FormLabel>Start *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="endDate" render={({ field }) => (
                    <FormItem><FormLabel>End *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FormField control={form.control} name="payDate" render={({ field }) => (
                    <FormItem><FormLabel>Pay date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent><SelectGroup>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="processing">Processing</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectGroup></SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: `0.5px solid ${GLASS_BORDER}`, flexShrink: 0 }}>
                <Button type="button" variant="outline" onClick={() => requestClose(false)} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" loading={isSubmitting}>{period ? "Save changes" : "Create period"}</Button>
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
