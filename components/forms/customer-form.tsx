"use client";
import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/dialog";
import { T3 } from "@/lib/ds";
import { useDirtyGuard } from "@/hooks/use-dirty-guard";
import type { Customer } from "@/types";

const SUPPORTED_CURRENCIES = ["PKR", "USD", "EUR", "GBP", "AED", "SAR"] as const;

const schema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  phone_no: z.string().min(1, "Phone is required").max(50),
  email: z.email("Invalid email").optional().or(z.literal("")),
  company: z.string().max(200).optional().or(z.literal("")),
  tax_id: z.string().max(100).optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
  currency: z.enum(SUPPORTED_CURRENCIES),
  status: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

function toDefaults(initial?: Partial<Customer>): FormValues {
  return {
    name: initial?.name ?? "",
    phone_no: initial?.phone_no ?? "",
    email: initial?.email ?? "",
    company: initial?.company ?? "",
    tax_id: initial?.tax_id ?? "",
    address: initial?.address ?? "",
    notes: initial?.notes ?? "",
    currency: (initial?.currency as FormValues["currency"]) ?? "PKR",
    status: initial?.status ?? true,
  };
}

const lbl = {
  fontSize: 11,
  color: T3,
  fontWeight: 500,
  marginBottom: 4,
  display: "block",
} as const;
const err = { fontSize: 10.5, color: "#f87171", marginTop: 3, display: "block" } as const;
const grid2 = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
} as const;

/**
 * Self-contained, fully-editable customer form rendered in a Dialog.
 * Shared by the clients list page and the client detail page so both routes
 * stay in sync. Includes a dirty-state guard on every close path.
 */
export function CustomerFormDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<Customer>;
  onSaved: () => void;
}) {
  const isEdit = !!initial?._id;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toDefaults(initial),
  });

  // Reset to a clean snapshot each time the dialog opens for a new target.
  useEffect(() => {
    if (open) reset(toDefaults(initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?._id]);

  const { confirmOpen, requestClose, confirmDiscard, dismissConfirm } = useDirtyGuard({
    isDirty,
    isSubmitting,
    onClose: () => onOpenChange(false),
  });

  async function onSubmit(values: FormValues) {
    try {
      const res = await fetch(
        isEdit ? `/api/customers/${initial!._id}` : "/api/customers",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        },
      );
      const data = await res.json();
      if (!data.success) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Could not save client.",
        );
      }
      reset(values); // clear dirty state
      toast.success(isEdit ? "Client updated." : "Client added.");
      onSaved();
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not save client.");
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) onOpenChange(true);
          else requestClose();
        }}
      >
        <DialogContent
          // keep the guard authoritative — block ESC / backdrop auto-close
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            requestClose();
          }}
          onInteractOutside={(e) => {
            e.preventDefault();
            requestClose();
          }}
        >
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit client" : "Add new client"}</DialogTitle>
            <DialogDescription style={{ fontSize: 11.5 }}>
              {isEdit
                ? "Update this client's details, status and preferred currency."
                : "Create a new client record."}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleSubmit(onSubmit)}
            style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4 }}
          >
            <div style={grid2}>
              <div>
                <label style={lbl} htmlFor="cust-name">
                  Full name *
                </label>
                <Input id="cust-name" placeholder="Jane Smith" {...register("name")} />
                {errors.name && <span style={err}>{errors.name.message}</span>}
              </div>
              <div>
                <label style={lbl} htmlFor="cust-phone">
                  Phone *
                </label>
                <Input
                  id="cust-phone"
                  placeholder="+92 300 1234567"
                  {...register("phone_no")}
                />
                {errors.phone_no && <span style={err}>{errors.phone_no.message}</span>}
              </div>
            </div>

            <div style={grid2}>
              <div>
                <label style={lbl} htmlFor="cust-email">
                  Email
                </label>
                <Input
                  id="cust-email"
                  type="email"
                  placeholder="jane@co.com"
                  {...register("email")}
                />
                {errors.email && <span style={err}>{errors.email.message}</span>}
              </div>
              <div>
                <label style={lbl} htmlFor="cust-company">
                  Company
                </label>
                <Input id="cust-company" placeholder="Company Ltd." {...register("company")} />
              </div>
            </div>

            <div style={grid2}>
              <div>
                <label style={lbl} htmlFor="cust-tax">
                  NTN / Tax ID
                </label>
                <Input id="cust-tax" placeholder="1234567-8" {...register("tax_id")} />
              </div>
              <div>
                <label style={lbl}>Preferred currency</label>
                <Controller
                  control={control}
                  name="currency"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger style={{ width: "100%" }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORTED_CURRENCIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div style={grid2}>
              <div>
                <label style={lbl}>Status</label>
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <Select
                      value={field.value ? "active" : "inactive"}
                      onValueChange={(v) => field.onChange(v === "active")}
                    >
                      <SelectTrigger style={{ width: "100%" }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div>
                <label style={lbl} htmlFor="cust-address">
                  Address
                </label>
                <Input id="cust-address" placeholder="Street, City" {...register("address")} />
              </div>
            </div>

            <div>
              <label style={lbl} htmlFor="cust-notes">
                Notes
              </label>
              <Textarea
                id="cust-notes"
                placeholder="Any notes about this client..."
                rows={2}
                {...register("notes")}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 8,
              }}
            >
              <Button type="button" variant="outline" onClick={requestClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting}>
                {isEdit ? "Save changes" : "Add client"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Unsaved-changes guard */}
      <AlertDialog open={confirmOpen} onOpenChange={(o) => !o && dismissConfirm()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved edits to this client. Save them, or discard and close.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="ghost" onClick={dismissConfirm} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={confirmDiscard}
              disabled={isSubmitting}
              style={{ color: "#f87171" }}
            >
              Discard
            </Button>
            <Button loading={isSubmitting} onClick={handleSubmit(onSubmit)}>
              Save
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
