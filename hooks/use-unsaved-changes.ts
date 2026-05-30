"use client";
import { useEffect, useRef } from "react";

/**
 * Guards against losing unsaved form changes.
 *
 * While `enabled` is true it blocks two escape routes:
 *   1. Page reload / tab close / external navigation → native `beforeunload` prompt.
 *   2. Browser Back / Forward (popstate)             → kept on the page, then
 *      `onAttemptLeave` fires so the caller can surface a confirm dialog.
 *
 * In-app close affordances (Sheet overlay/Esc/Cancel) are handled by the
 * caller intercepting its own close handler — this hook only covers the
 * browser-level navigation the app can't otherwise intercept.
 */
export function useUnsavedChanges(enabled: boolean, onAttemptLeave?: () => void) {
  const onAttemptLeaveRef = useRef(onAttemptLeave);
  onAttemptLeaveRef.current = onAttemptLeave;

  // 1. Reload / tab close / external navigation.
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy browsers require returnValue to be set.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [enabled]);

  // 2. Browser Back / Forward button.
  useEffect(() => {
    if (!enabled) return;
    // Push a sentinel entry so the first Back press lands here instead of leaving.
    window.history.pushState({ __unsavedGuard: true }, "");
    const handler = () => {
      // Re-push to keep the user on the page, then surface the confirm UI.
      window.history.pushState({ __unsavedGuard: true }, "");
      onAttemptLeaveRef.current?.();
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [enabled]);
}
