"use client";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Wand2, Save, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useSettings } from "@/hooks/use-settings";
import { ASSISTANT_FEATURES, isFeatureEnabled } from "@/lib/assistant/features";
import { T1, T3, GLASS_BORDER, AC } from "@/lib/ds";

/** "auto" mirrors the user's language; the rest pin every reply to that language. */
const LANGUAGES = [
  { value: "auto", label: "Auto — match the customer's language" },
  { value: "English", label: "English" },
  { value: "Urdu", label: "Urdu (اردو)" },
  { value: "Arabic", label: "Arabic (العربية)" },
  { value: "French", label: "French (Français)" },
  { value: "Spanish", label: "Spanish (Español)" },
  { value: "German", label: "German (Deutsch)" },
  { value: "Hindi", label: "Hindi (हिन्दी)" },
  { value: "Portuguese", label: "Portuguese (Português)" },
  { value: "Turkish", label: "Turkish (Türkçe)" },
  { value: "Indonesian", label: "Indonesian (Bahasa)" },
  { value: "Russian", label: "Russian (Русский)" },
  { value: "Chinese", label: "Chinese (中文)" },
  { value: "Bengali", label: "Bengali (বাংলা)" },
];

export function AssistantSettingsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { settings, mutate } = useSettings();
  const cfg = settings?.integrations?.aiAssistant;
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [instructions, setInstructions] = useState("");
  const [language, setLanguage] = useState("auto");
  const [saving, setSaving] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Snapshot of the values when the sheet opened — drives the unsaved-changes guard.
  const initialRef = useRef<string>("");

  useEffect(() => {
    if (!open) return;
    const f: Record<string, boolean> = {};
    for (const feat of ASSISTANT_FEATURES) f[feat.key] = isFeatureEnabled(cfg?.features, feat.key);
    const instr = cfg?.customInstructions ?? "";
    const lang = cfg?.responseLanguage ?? "auto";
    setFeatures(f);
    setInstructions(instr);
    setLanguage(lang);
    initialRef.current = JSON.stringify({ features: f, instructions: instr, language: lang });
  }, [open, cfg]);

  const dirty = JSON.stringify({ features, instructions, language }) !== initialRef.current;
  useUnsavedChanges(open && dirty && !saving, () => setConfirmOpen(true));

  function requestClose(next: boolean) {
    if (!next && dirty && !saving) { setConfirmOpen(true); return; }
    onOpenChange(next);
  }
  function discardAndClose() {
    setConfirmOpen(false);
    initialRef.current = JSON.stringify({ features, instructions, language }); // clear dirty
    onOpenChange(false);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrations: { aiAssistant: { features, customInstructions: instructions, responseLanguage: language } } }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(typeof data.error === "string" ? data.error : "Save failed");
      toast.success("Assistant settings saved.");
      initialRef.current = JSON.stringify({ features, instructions, language }); // no longer dirty
      mutate();
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function rewrite() {
    if (!instructions.trim()) return;
    setRewriting(true);
    try {
      const res = await fetch("/api/assistant/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: instructions }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setInstructions(data.data.text);
      toast.success("Instructions improved.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Rewrite failed");
    } finally {
      setRewriting(false);
    }
  }

  const canRewrite = !rewriting && !!instructions.trim();

  return (
    <Sheet open={open} onOpenChange={requestClose}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto"
        onInteractOutside={(e) => { if (dirty && !saving) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (dirty && !saving) { e.preventDefault(); setConfirmOpen(true); } }}
      >
        <SheetHeader>
          <SheetTitle>Assistant settings</SheetTitle>
        </SheetHeader>

        <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 18 }}>
          {/* Capabilities */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T1, marginBottom: 3 }}>Capabilities</div>
            <div style={{ fontSize: 12, color: T3, marginBottom: 10, lineHeight: 1.5 }}>
              Choose what the assistant can do. Disabled capabilities are politely declined.
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {ASSISTANT_FEATURES.map((f) => (
                <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: `0.5px solid ${GLASS_BORDER}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: T1, fontWeight: 500 }}>{f.label}</div>
                    <div style={{ fontSize: 11, color: T3, marginTop: 1 }}>{f.description}</div>
                  </div>
                  <Switch
                    checked={features[f.key] ?? true}
                    onCheckedChange={(v) => setFeatures((p) => ({ ...p, [f.key]: v }))}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Response language */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T1, marginBottom: 3 }}>Response language</div>
            <div style={{ fontSize: 12, color: T3, marginBottom: 10, lineHeight: 1.5 }}>
              The language the assistant replies in. <span style={{ color: T1, fontWeight: 600 }}>Auto</span> mirrors each message — ask in Urdu, Arabic or French and it answers in the same language.
            </div>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom instructions */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3, gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T1 }}>Custom instructions</div>
              <button
                onClick={rewrite}
                disabled={!canRewrite}
                title="Improve these instructions with AI"
                style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 7, border: `0.5px solid color-mix(in srgb, ${AC} 35%, ${GLASS_BORDER})`, background: `color-mix(in srgb, ${AC} 12%, transparent)`, color: AC, fontSize: 11.5, fontWeight: 600, cursor: canRewrite ? "pointer" : "default", opacity: canRewrite ? 1 : 0.55, flexShrink: 0 }}
              >
                {rewriting ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                {rewriting ? "Rewriting…" : "Improve"}
              </button>
            </div>
            <div style={{ fontSize: 12, color: T3, marginBottom: 8, lineHeight: 1.5 }}>
              Extra guidance for the assistant (tone, defaults, preferences). It can&apos;t override the safety rules.
            </div>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={6}
              placeholder="e.g. Default invoices to issued. Keep a friendly, concise tone. Prefer PKR unless told otherwise."
            />
          </div>

          <Button onClick={save} disabled={saving} className="w-full">
            <Save size={14} className="mr-1.5" />
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </SheetContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Your assistant settings have unsaved changes. Discard them and close?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={discardAndClose}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
