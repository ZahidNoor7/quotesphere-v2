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
import { GLASS_BORDER, T2, T3 } from "@/lib/ds";
import type { Currency, Employee, SalaryStructure } from "@/types";

const CURRENCIES: Currency[] = ["PKR", "USD", "EUR", "GBP", "AED", "SAR"];

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.email("Invalid email").or(z.literal("")).optional(),
  phone: z.string().trim().max(50).optional(),
  designation: z.string().trim().max(120).optional(),
  department: z.string().trim().max(120).optional(),
  employmentType: z.enum(["full_time", "contract"]),
  joinDate: z.string().min(1, "Join date is required"),
  status: z.enum(["active", "inactive"]),
  payCurrency: z.enum(["PKR", "USD", "EUR", "GBP", "AED", "SAR"]),
  salaryStructureId: z.string().optional(),
  bankName: z.string().max(120).optional(),
  accountTitle: z.string().max(120).optional(),
  accountNumber: z.string().max(60).optional(),
  iban: z.string().max(60).optional(),
});

type FormValues = z.infer<typeof schema>;

const NONE = "__none__";

function toDefaults(e: Employee | null): FormValues {
  return {
    name: e?.name ?? "",
    email: e?.email ?? "",
    phone: e?.phone ?? "",
    designation: e?.designation ?? "",
    department: e?.department ?? "",
    employmentType: e?.employmentType ?? "full_time",
    joinDate: e?.joinDate ? e.joinDate.slice(0, 10) : "",
    status: e?.status ?? "active",
    payCurrency: e?.payCurrency ?? "PKR",
    salaryStructureId: e?.salaryStructureId ?? NONE,
    bankName: e?.bankDetails?.bankName ?? "",
    accountTitle: e?.bankDetails?.accountTitle ?? "",
    accountNumber: e?.bankDetails?.accountNumber ?? "",
    iban: e?.bankDetails?.iban ?? "",
  };
}

export function EmployeeSheet({
  open, onOpenChange, employee, structures, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  structures: SalaryStructure[];
  onSaved: () => void;
}) {
  const isMobile = useIsMobile();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toDefaults(employee) });
  const { isDirty, isSubmitting } = form.formState;

  useEffect(() => {
    if (open) form.reset(toDefaults(employee));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employee]);

  useUnsavedChanges(open && isDirty, () => setConfirmOpen(true));

  function requestClose(next: boolean) {
    if (!next && isDirty) { setConfirmOpen(true); return; }
    onOpenChange(next);
  }
  function discardAndClose() {
    setConfirmOpen(false);
    form.reset(toDefaults(employee));
    onOpenChange(false);
  }

  async function onSubmit(values: FormValues) {
    try {
      const payload = {
        name: values.name,
        email: values.email || undefined,
        phone: values.phone || undefined,
        designation: values.designation || undefined,
        department: values.department || undefined,
        employmentType: values.employmentType,
        joinDate: values.joinDate,
        status: values.status,
        payCurrency: values.payCurrency,
        salaryStructureId: values.salaryStructureId && values.salaryStructureId !== NONE ? values.salaryStructureId : "",
        bankDetails: {
          bankName: values.bankName || undefined,
          accountTitle: values.accountTitle || undefined,
          accountNumber: values.accountNumber || undefined,
          iban: values.iban || undefined,
        },
      };
      const res = await fetch(employee ? `/api/payroll/employees/${employee._id}` : "/api/payroll/employees", {
        method: employee ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(typeof data.error === "string" ? data.error : "Could not save employee");
      form.reset(values);
      toast.success(employee ? "Employee updated." : "Employee added.");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save employee");
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={requestClose}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          onInteractOutside={(e) => { if (isDirty) e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (isDirty) { e.preventDefault(); setConfirmOpen(true); } }}
          className={isMobile ? "flex flex-col p-0 gap-0 h-[90dvh] overflow-hidden rounded-t-2xl" : "flex flex-col p-0 gap-0 sm:w-[480px] sm:max-w-[480px]"}
        >
          <SheetHeader style={{ padding: "16px 20px 12px", borderBottom: `0.5px solid ${GLASS_BORDER}`, flexShrink: 0 }}>
            <SheetTitle>{employee ? "Edit employee" : "Add employee"}</SheetTitle>
            <SheetDescription>{employee ? `Update ${employee.employee_code}.` : "Add a team member to run payroll for."}</SheetDescription>
          </SheetHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name *</FormLabel>
                    <FormControl><Input placeholder="e.g. Jane Doe" autoFocus {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="jane@company.com" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem><FormLabel>Phone</FormLabel><FormControl><Input placeholder="03xx-xxxxxxx" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FormField control={form.control} name="designation" render={({ field }) => (
                    <FormItem><FormLabel>Designation</FormLabel><FormControl><Input placeholder="e.g. Engineer" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="department" render={({ field }) => (
                    <FormItem><FormLabel>Department</FormLabel><FormControl><Input placeholder="e.g. Engineering" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FormField control={form.control} name="employmentType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employment</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent><SelectGroup>
                          <SelectItem value="full_time">Full time</SelectItem>
                          <SelectItem value="contract">Contract</SelectItem>
                        </SelectGroup></SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="joinDate" render={({ field }) => (
                    <FormItem><FormLabel>Join date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FormField control={form.control} name="payCurrency" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pay currency</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent><SelectGroup>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectGroup></SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent><SelectGroup>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectGroup></SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="salaryStructureId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salary structure</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="None" /></SelectTrigger></FormControl>
                      <SelectContent><SelectGroup>
                        <SelectItem value={NONE}>None</SelectItem>
                        {structures.map((s) => <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>)}
                      </SelectGroup></SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T3, marginTop: 4 }}>Bank details</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FormField control={form.control} name="bankName" render={({ field }) => (
                    <FormItem><FormLabel>Bank</FormLabel><FormControl><Input placeholder="e.g. Meezan" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="accountTitle" render={({ field }) => (
                    <FormItem><FormLabel>Account title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FormField control={form.control} name="accountNumber" render={({ field }) => (
                    <FormItem><FormLabel>Account no.</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="iban" render={({ field }) => (
                    <FormItem><FormLabel>IBAN</FormLabel><FormControl><Input placeholder="PK..." {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: `0.5px solid ${GLASS_BORDER}`, flexShrink: 0 }}>
                <Button type="button" variant="outline" onClick={() => requestClose(false)} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" loading={isSubmitting}>{employee ? "Save changes" : "Add employee"}</Button>
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
