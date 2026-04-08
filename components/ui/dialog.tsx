"use client";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { cn } from "@/lib/utils";

/* ── Dialog ── */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", position: "fixed", inset: 0, zIndex: 50 }}
    className={cn("data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className)}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, style: styleProp, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 51,
        width: "90vw", maxWidth: 520, maxHeight: "85vh", overflow: "hidden",
        background: "var(--modal-bg)",
        backdropFilter: "blur(40px) saturate(180%)", WebkitBackdropFilter: "blur(40px) saturate(180%)",
        border: "0.5px solid var(--glass-border-strong)",
        borderRadius: 16, padding: "20px 24px",
        boxShadow: "0 20px 80px rgba(0,0,0,0.5)",
        display: "flex", flexDirection: "column",
        ...styleProp,
      }}
      className={cn("data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95", className)}
      {...props}
    >
      {children}
      <DialogPrimitive.Close style={{ position: "absolute", top: 14, right: 14, width: 26, height: 26, borderRadius: 100, background: "var(--glass)", border: "0.5px solid var(--glass-border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t3)" }}>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 3l10 10M13 3L3 13"/></svg>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div style={{ marginBottom: 16 }} className={className} {...props} />;
}
export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }} className={className} {...props} />;
}
export function DialogTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--t1)", letterSpacing: "-0.01em" }} className={className} {...props}>{children}</h2>;
}
export function DialogDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p style={{ fontSize: 13, color: "var(--t3)", marginTop: 4 }} className={className} {...props}>{children}</p>;
}

/* ── Alert Dialog ── */
export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ ...props }, ref) => (
  <AlertDialogPrimitive.Overlay ref={ref}
    style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", position: "fixed", inset: 0, zIndex: 50 }}
    {...props}
  />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

export const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Portal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content ref={ref}
      style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 51,
        width: "90vw", maxWidth: 420, padding: "22px 24px",
        background: "var(--modal-bg)",
        backdropFilter: "blur(40px) saturate(180%)", WebkitBackdropFilter: "blur(40px) saturate(180%)",
        border: "0.5px solid var(--glass-border-strong)", borderRadius: 16,
        boxShadow: "0 20px 80px rgba(0,0,0,0.5)",
      }}
      className={cn("data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95", className)}
      {...props}
    />
  </AlertDialogPrimitive.Portal>
));
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

export function AlertDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div style={{ marginBottom: 18 }} className={className} {...props} />;
}
export function AlertDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }} className={className} {...props} />;
}
export function AlertDialogTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--t1)" }} className={className} {...props}>{children}</h2>;
}
export function AlertDialogDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6, marginTop: 6 }} className={className} {...props}>{children}</p>;
}
export function AlertDialogAction({ className, children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button onClick={onClick}
      style={{
        padding: "7px 14px", borderRadius: 100, fontSize: 12, fontWeight: 500, cursor: "pointer",
        background: "rgba(248,113,113,0.15)", color: "#f87171", border: "0.5px solid rgba(248,113,113,0.3)",
        transition: "all 0.15s",
      } as any}
      onMouseEnter={e => Object.assign((e.target as HTMLElement).style, { background: "rgba(248,113,113,0.3)" })}
      onMouseLeave={e => Object.assign((e.target as HTMLElement).style, { background: "rgba(248,113,113,0.15)" })}
      className={className}
      {...props}
    >{children}</button>
  );
}
export function AlertDialogCancel({ className, children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button onClick={onClick}
      style={{
        padding: "7px 14px", borderRadius: 100, fontSize: 12, fontWeight: 500, cursor: "pointer",
        background: "var(--glass)", color: "var(--t2)", border: "0.5px solid var(--glass-border)",
        transition: "all 0.15s",
      }}
      onMouseEnter={e => Object.assign((e.target as HTMLElement).style, { background: "var(--glass-hover)", color: "var(--t1)" })}
      onMouseLeave={e => Object.assign((e.target as HTMLElement).style, { background: "var(--glass)", color: "var(--t2)" })}
      className={className}
      {...props}
    >{children}</button>
  );
}
