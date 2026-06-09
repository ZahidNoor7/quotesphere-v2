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
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/dialog";
import { MoneyInput } from "@/components/payroll/money-input";

import { useIsMobile } from "@/hooks/use-mobile";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { GLASS_BORDER, T2 } from "@/lib/ds";
import type { Currency, Employee, LoanAdvance } from "@/types";

const CURRENCIES: Currency[] = ["PKR", "USD", "EUR", "GBP", "AED", "SAR"];

const schema = z.object({
  employeeId: z.string().min(1, "Select an employee"),
  type: z.enum(["loan", "advance"]),
  principal: z.number().min(0),
  installmentAmount: z.number().min(0),
  remainingBalance: z.number().min(0),
  currency: z.enum(["PKR", "USD", "EUR", "GBP", "AED", "SAR"]),
  status: z.enum(["active", "closed"]),
  startDate: z.string().optional(),
  note: z.string().max(500).optional(),
});

type FormValues = z.infer<typeof schema>;

function toDefaults(loan: LoanAdvance | null): FormValues {
  return {
    employeeId: loan?.employeeId ?? "",
    type: loan?.type ?? "loan",
    principal: loan?.principal ?? 0,
    installmentAmount: loan?.installmentAmount ?? 0,
    remainingBalance: loan?.remainingBalance ?? 0,
    currency: loan?.currency ?? "PKR",
    status: loan?.status ?? "active",
    startDate: loan?.startDate ? loan.startDate.slice(0, 10) : "",
    note: loan?.note ?? "",
  };
}

export function LoanSheet({
  open, onOpenChange, loan, employees, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: LoanAdvance | null;
  employees: Employee[];
  onSaved: () => void;
}) {
  const isMobile = useIsMobile();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toDefaults(loan) });
  const { isDirty, isSubmitting } = form.formState;

  useEffect(() => {
    if (open) form.reset(toDefaults(loan));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loan]);

  useUnsavedChanges(open && isDirty, () => setConfirmOpen(true));

  function requestClose(next: boolean) {
    if (!next && isDirty) { setConfirmOpen(true); return; }
    onOpenChange(next);
  }
  function discardAndClose() {
    setConfirmOpen(false);
    form.reset(toDefaults(loan));
    onOpenChange(false);
  }

  async function onSubmit(values: FormValues) {
    try {
      // On create, the server seeds remainingBalance = principal.
      const payload = loan
        ? values
        : { employeeId: values.employeeId, type: values.type, principal: values.principal, installmentAmount: values.installmentAmount, currency: values.currency, status: values.status, startDate: values.startDate || undefined, note: values.note || undefined };
      const res = await fetch(loan ? `/api/payroll/loans/${loan._id}` : "/api/payroll/loans", {
        method: loan ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(typeof data.error === "string" ? data.error : "Could not save loan");
      form.reset(values);
      toast.success(loan ? "Loan updated." : "Loan added.");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save loan");
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={requestClose}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          onInteractOutside={(e) => { if (isDirty) e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (isDirty) { e.preventDefault(); setConfirmOpen(true); } }}
          className={isMobile ? "flex flex-col p-0 gap-0 h-[90dvh] overflow-hidden rounded-t-2xl" : "flex flex-col p-0 gap-0 sm:w-[460px] sm:max-w-[460px]"}
        >
          <SheetHeader style={{ padding: "16px 20px 12px", borderBottom: `0.5px solid ${GLASS_BORDER}`, flexShrink: 0 }}>
            <SheetTitle>{loan ? "Edit loan / advance" : "New loan / advance"}</SheetTitle>
            <SheetDescription>The installment is deducted from each payslip until the balance reaches zero.</SheetDescription>
          </SheetHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                <FormField control={form.control} name="employeeId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={!!loan}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger></FormControl>
                      <SelectContent><SelectGroup>
                        {employees.map((e) => <SelectItem key={e._id} value={e._id}>{e.name} · {e.employee_code}</SelectItem>)}
                      </SelectGroup></SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FormField control={form.control} name="type" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent><SelectGroup>
                          <SelectItem value="loan">Loan</SelectItem>
                          <SelectItem value="advance">Advance</SelectItem>
                        </SelectGroup></SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
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

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FormField control={form.control} name="principal" render={({ field }) => (
                    <FormItem><FormLabel>Principal</FormLabel><FormControl><MoneyInput valueMinor={field.value} onChangeMinor={field.onChange} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="installmentAmount" render={({ field }) => (
                    <FormItem><FormLabel>Installment / period</FormLabel><FormControl><MoneyInput valueMinor={field.value} onChangeMinor={field.onChange} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                {loan && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <FormField control={form.control} name="remainingBalance" render={({ field }) => (
                      <FormItem><FormLabel>Remaining balance</FormLabel><FormControl><MoneyInput valueMinor={field.value} onChangeMinor={field.onChange} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="status" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent><SelectGroup>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                          </SelectGroup></SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                )}

                <FormField control={form.control} name="startDate" render={({ field }) => (
                  <FormItem><FormLabel>Start date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="note" render={({ field }) => (
                  <FormItem><FormLabel>Note</FormLabel><FormControl><Textarea rows={2} placeholder="Optional" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: `0.5px solid ${GLASS_BORDER}`, flexShrink: 0 }}>
                <Button type="button" variant="outline" onClick={() => requestClose(false)} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" loading={isSubmitting}>{loan ? "Save changes" : "Add loan"}</Button>
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
