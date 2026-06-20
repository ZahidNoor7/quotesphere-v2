"use client";
import { useCallback, useEffect, useState } from "react";

/**
 * Shared dirty-state guard for editable Sheets / Dialogs / Drawers.
 *
 * Routes every close/exit path (X, ESC, backdrop, Cancel, programmatic close)
 * through a single `requestClose`. While the surface is dirty it:
 *   - opens a confirmation AlertDialog (Save / Discard / Cancel) instead of closing, and
 *   - registers a `beforeunload` listener so a tab close / reload shows the
 *     browser's native "Leave site?" prompt.
 *
 * While a save is in flight (`isSubmitting`) all close paths are blocked.
 *
 * Feature code never wires `beforeunload` by hand — it consumes this hook.
 */
export function useDirtyGuard({
  isDirty,
  isSubmitting = false,
  onClose,
}: {
  isDirty: boolean;
  isSubmitting?: boolean;
  onClose: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Native guard for tab close / reload while there are unsaved edits.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  /** Every close path funnels through here. */
  const requestClose = useCallback(() => {
    if (isSubmitting) return; // never close mid-submit
    if (isDirty) {
      setConfirmOpen(true);
      return;
    }
    onClose();
  }, [isDirty, isSubmitting, onClose]);

  /** Confirm "Discard" — caller resets the form, then we close. */
  const confirmDiscard = useCallback(() => {
    setConfirmOpen(false);
    onClose();
  }, [onClose]);

  /** Confirm "Cancel" — keep the surface open with edits intact. */
  const dismissConfirm = useCallback(() => setConfirmOpen(false), []);

  return { confirmOpen, setConfirmOpen, requestClose, confirmDiscard, dismissConfirm };
}
