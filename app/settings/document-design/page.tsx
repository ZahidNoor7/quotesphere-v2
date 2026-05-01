"use client";
import React, { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  T1,
  T2,
  T3,
  GLASS,
  GLASS_BORDER,
  TOPBAR_STYLE,
  FIELD_INPUT,
} from "@/lib/ds";
import { useSettings } from "@/hooks/use-settings";
import { DocumentRenderer } from "@/components/document-design/document-renderer";
import {
  BUILT_IN_DESIGNS,
  getAllDesigns,
  getDesignById,
  getDefaultDesign,
  resolveConfig,
  PRESET_META,
  PRESET_IDS,
  PRESET_CONFIGS,
  type PresetId,
} from "@/lib/document-designs";
import type { DocumentDesign, DocumentDesignConfig } from "@/types";

type DocType = "invoice" | "quotation" | "receipt";

const SAMPLE_DATA = {
  docNo: "INV-00042",
  issueDate: new Date().toISOString().slice(0, 10),
  dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  customer: {
    name: "Acme Corporation",
    phone: "+92 300 1234567",
    address: "Blue Area, Islamabad",
  },
  items: [
    { name: "Web Design & Development", quantity: 1, price: 75000 },
    { name: "Monthly Hosting & Support", quantity: 3, price: 5000 },
    { name: "Domain Registration", quantity: 1, price: 2500 },
  ],
  subTotal: 92500,
  taxAmt: 16650,
  taxLabel: "Tax (18%)",
  discount: 5000,
  delivery: 0,
  total: 104150,
  advance: 25000,
  outstanding: 79150,
  currency: "PKR",
  remarks: "Thank you for your business.",
};

const SAMPLE_RECEIPT_DATA = {
  docNo: "RCP-00007",
  issueDate: new Date().toISOString().slice(0, 10),
  customer: { name: "Acme Corporation", phone: "+92 300 1234567" },
  invoiceNo: "INV-00042",
  paymentDate: new Date().toISOString().slice(0, 10),
  paymentAmount: 25000,
  paymentMethod: "bank_transfer",
  paymentRef: "TXN-88472930",
  remainingBalance: 79150,
  total: 104150,
  currency: "PKR",
};

const EXTRA_MOCK_ITEMS = [
  { name: "Consulting Services", quantity: 2, price: 15000 },
  { name: "Project Management", quantity: 1, price: 25000 },
  { name: "UI/UX Design", quantity: 1, price: 35000 },
  { name: "Quality Assurance", quantity: 5, price: 3000 },
  { name: "Server Setup & Config", quantity: 1, price: 12000 },
  { name: "Training & Support", quantity: 3, price: 8000 },
  { name: "Content Writing", quantity: 10, price: 2000 },
  { name: "SEO Optimization", quantity: 1, price: 18000 },
  { name: "Social Media Setup", quantity: 1, price: 22000 },
  { name: "Data Migration", quantity: 1, price: 16000 },
  { name: "API Integration", quantity: 1, price: 28000 },
  { name: "Documentation", quantity: 1, price: 8000 },
  { name: "Security Audit", quantity: 1, price: 45000 },
  { name: "Performance Testing", quantity: 2, price: 12000 },
  { name: "Cloud Deployment", quantity: 1, price: 32000 },
  { name: "Database Design", quantity: 1, price: 20000 },
  { name: "Mobile Optimization", quantity: 1, price: 18000 },
  { name: "Email Templates", quantity: 5, price: 4000 },
  { name: "Analytics Setup", quantity: 1, price: 15000 },
  { name: "Backup Configuration", quantity: 1, price: 8000 },
  { name: "Load Balancer Setup", quantity: 1, price: 24000 },
  { name: "SSL Certificate", quantity: 1, price: 5000 },
  { name: "CDN Integration", quantity: 1, price: 14000 },
  { name: "Monitoring Setup", quantity: 1, price: 11000 },
  { name: "DevOps Pipeline", quantity: 1, price: 38000 },
  { name: "Code Review", quantity: 8, price: 6000 },
  { name: "Technical Writing", quantity: 3, price: 9000 },
];

const DOC_TABS: { id: DocType; label: string }[] = [
  { id: "invoice", label: "Invoices" },
  { id: "quotation", label: "Quotations" },
  { id: "receipt", label: "Receipts" },
];

const SETTINGS_TABS = ["Header", "Footer", "Content", "Page & Style"] as const;

const PAGE_SIZES = ["A4", "A5", "Letter", "Legal"] as const;
const ORIENTATIONS = ["portrait", "landscape"] as const;
const HEADER_VISIBILITIES = [
  { value: "all", label: "Every page" },
  { value: "first", label: "First only" },
  { value: "last", label: "Last only" },
  { value: "first-last", label: "First & last" },
] as const;
const TERMS_POSITIONS = [
  { value: "start", label: "Doc start" },
  { value: "end", label: "Doc end" },
  { value: "every", label: "Every page" },
  { value: "first-last", label: "First & last" },
  { value: "start-every", label: "Start + every" },
  { value: "end-every", label: "End + every" },
] as const;
const TERMS_FORMATS = [
  { value: "paragraph", label: "Paragraph" },
  { value: "bullet", label: "Bullet list" },
  { value: "numbered", label: "Numbered" },
] as const;

const FONT_OPTIONS = [
  {
    value: "'Inter', system-ui, -apple-system, sans-serif",
    label: "Inter (Modern)",
  },
  { value: "Georgia, 'Times New Roman', serif", label: "Georgia (Serif)" },
  { value: "'Courier New', Courier, monospace", label: "Courier (Mono)" },
  { value: "Arial, Helvetica, sans-serif", label: "Arial (Classic)" },
];

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "0.5px solid rgba(255,255,255,0.12)",
  borderRadius: 6,
  color: "#e2e8f0",
  fontSize: 11,
  padding: "5px 8px",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

function TermsEditor({
  text,
  format,
  onChange,
}: {
  text: string;
  format: "paragraph" | "bullet" | "numbered";
  onChange: (val: string) => void;
}) {
  const [dragOver, setDragOver] = useState<number>(-1);
  const dragIdx = useRef<number>(-1);

  if (format === "paragraph") {
    return (
      <Textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        placeholder="Enter your terms and conditions..."
        className="resize-y"
        style={{ lineHeight: 1.6, padding: "7px 10px" }}
      />
    );
  }

  const lines = text ? text.split("\n") : [""];

  function updateLine(idx: number, val: string) {
    const n = [...lines];
    n[idx] = val;
    onChange(n.join("\n"));
  }

  function addLine() {
    onChange([...lines, ""].join("\n"));
  }

  function removeLine(idx: number) {
    const n = lines.filter((_, i) => i !== idx);
    onChange((n.length ? n : [""]).join("\n"));
  }

  function handleDragStart(idx: number) {
    dragIdx.current = idx;
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragOver !== idx) setDragOver(idx);
  }

  function handleDrop(idx: number) {
    const from = dragIdx.current;
    setDragOver(-1);
    if (from === -1 || from === idx) return;
    const n = [...lines];
    const [removed] = n.splice(from, 1);
    n.splice(idx, 0, removed);
    onChange(n.join("\n"));
    dragIdx.current = -1;
  }

  const DragHandle = () => (
    <svg
      width="8"
      height="12"
      viewBox="0 0 8 12"
      style={{ cursor: "grab", flexShrink: 0 }}
      fill="rgba(255,255,255,0.2)"
    >
      <circle cx="2" cy="2" r="1.2" />
      <circle cx="6" cy="2" r="1.2" />
      <circle cx="2" cy="6" r="1.2" />
      <circle cx="6" cy="6" r="1.2" />
      <circle cx="2" cy="10" r="1.2" />
      <circle cx="6" cy="10" r="1.2" />
    </svg>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {lines.map((line, idx) => (
        <div
          key={idx}
          draggable
          onDragStart={() => handleDragStart(idx)}
          onDragOver={(e) => handleDragOver(e, idx)}
          onDrop={() => handleDrop(idx)}
          onDragLeave={() => setDragOver(-1)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background:
              dragOver === idx ? "rgba(99,102,241,0.1)" : "transparent",
            border:
              dragOver === idx
                ? "1px dashed rgba(99,102,241,0.45)"
                : "1px solid transparent",
            borderRadius: 6,
            padding: "2px 4px 2px 2px",
            transition: "background 0.1s",
          }}
        >
          <DragHandle />
          <div
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.3)",
              flexShrink: 0,
              minWidth: 16,
              textAlign: "right",
              userSelect: "none",
            }}
          >
            {format === "numbered" ? `${idx + 1}.` : "•"}
          </div>
          <Input
            value={line}
            onChange={(e) => updateLine(idx, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addLine();
              }
              if (e.key === "Backspace" && line === "" && lines.length > 1) {
                e.preventDefault();
                removeLine(idx);
              }
            }}
            placeholder={`Item ${idx + 1}…`}
            style={{ flex: 1 }}
          />
          {lines.length > 1 && (
            <button
              onClick={() => removeLine(idx)}
              style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                background: "rgba(248,113,113,0.12)",
                border: "0.5px solid rgba(248,113,113,0.3)",
                color: "#f87171",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                flexShrink: 0,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button
        onClick={addLine}
        style={{
          width: "100%",
          padding: "5px 0",
          borderRadius: 6,
          fontSize: 10.5,
          cursor: "pointer",
          border: "0.5px dashed rgba(99,102,241,0.4)",
          background: "rgba(99,102,241,0.06)",
          color: "#818cf8",
        }}
      >
        + Add item
      </button>
    </div>
  );
}

export default function DocumentDesignPage() {
  const router = useRouter();
  const { settings, isLoading, mutate } = useSettings();
  const userDesigns = settings?.documentDesigns ?? [];

  const [activeDocType, setActiveDocType] = useState<DocType>("invoice");
  const [activeSettingsTab, setActiveSettingsTab] =
    useState<(typeof SETTINGS_TABS)[number]>("Header");
  const [selectedDesignId, setSelectedDesignId] =
    useState<string>("modern-gradient");
  const [configOverrides, setConfigOverrides] = useState<
    Partial<DocumentDesignConfig>
  >({});
  const [saving, setSaving] = useState(false);
  const [settingDefault, setSettingDefault] = useState(false);
  const [savingCustom, setSavingCustom] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);
  const [customName, setCustomName] = useState("");
  const [showSaveAs, setShowSaveAs] = useState(false);
  const [showMultiPage, setShowMultiPage] = useState(false);
  const [mockRowCount, setMockRowCount] = useState(3);

  // Track which doc types have had their selection initialized from saved settings.
  // Using a ref (not state) so SWR revalidations don't re-trigger after the user
  // has manually changed the selection within the session.
  const initializedDocTypes = useRef(new Set<DocType>());

  useEffect(() => {
    if (!settings) return;
    if (initializedDocTypes.current.has(activeDocType)) return;
    initializedDocTypes.current.add(activeDocType);
    const key =
      activeDocType === "invoice"
        ? "invoiceDesignId"
        : activeDocType === "quotation"
          ? "quotationDesignId"
          : "receiptDesignId";
    const savedId = (settings.lastUsed as any)?.[key];
    if (savedId) {
      setSelectedDesignId(savedId);
      setConfigOverrides({});
    }
  }, [settings, activeDocType]);

  const allDesigns = getAllDesigns(userDesigns, activeDocType);
  const baseDesign = getDesignById(selectedDesignId, userDesigns);
  const baseConfig = resolveConfig(baseDesign);
  const effectiveConfig: any = { ...baseConfig, ...configOverrides };

  // The design being previewed (base + overrides)
  const previewDesign: DocumentDesign = {
    ...baseDesign,
    config: effectiveConfig,
  };

  // Get default design id for active doc type
  const defaultDesignId = (() => {
    const lastUsedKey =
      activeDocType === "invoice"
        ? "invoiceDesignId"
        : activeDocType === "quotation"
          ? "quotationDesignId"
          : "receiptDesignId";
    return (settings?.lastUsed as any)?.[lastUsedKey] ?? "modern-gradient";
  })();

  function selectDesign(id: string) {
    setSelectedDesignId(id);
    setConfigOverrides({}); // Reset overrides when switching design
  }

  function updateConfig(updates: Partial<DocumentDesignConfig>) {
    setConfigOverrides((prev) => ({ ...prev, ...updates }));
  }

  async function setAsDefault() {
    setSettingDefault(true);
    const hadOverrides = hasOverrides;
    const hadBuiltIn = !isUserDesign;
    try {
      let designIdToUse = selectedDesignId;

      if (hadOverrides) {
        if (isUserDesign) {
          // Save config changes to the existing user design first, then set default
          const putRes = await fetch(
            `/api/settings/document-designs/${selectedDesignId}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ config: effectiveConfig }),
            },
          );
          const putData = await putRes.json();
          if (!putData.success) throw new Error(putData.error);
          setConfigOverrides({});
        } else {
          // Built-in design with overrides: auto-save as a custom design, then set that as default
          const postRes = await fetch("/api/settings/document-designs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: `${baseDesign.name} (Custom)`,
              type: activeDocType,
              config: effectiveConfig,
              isDefault: false,
            }),
          });
          const postData = await postRes.json();
          if (!postData.success) throw new Error(postData.error);
          designIdToUse = postData.data.id;
          setSelectedDesignId(postData.data.id);
          setConfigOverrides({});
        }
      }

      const res = await fetch(
        `/api/settings/document-designs/${designIdToUse}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: activeDocType }),
        },
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(
        hadOverrides && hadBuiltIn
          ? `Saved as custom design and set as default for ${activeDocType}s.`
          : `Set as default for ${activeDocType}s.`,
      );
      mutate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSettingDefault(false);
    }
  }

  async function saveAsCustom() {
    if (!customName.trim()) {
      toast.error("Enter a name for the design.");
      return;
    }
    setSavingCustom(true);
    try {
      const res = await fetch("/api/settings/document-designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: customName.trim(),
          type: activeDocType,
          config: effectiveConfig,
          isDefault: false,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success("Custom design saved.");
      setCustomName("");
      setShowSaveAs(false);
      mutate();
      setSelectedDesignId(data.data.id);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingCustom(false);
    }
  }

  async function deleteUserDesign(id: string) {
    if (!confirm("Delete this custom design?")) return;
    try {
      const res = await fetch(`/api/settings/document-designs/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success("Design deleted.");
      mutate();
      if (selectedDesignId === id) setSelectedDesignId("modern-gradient");
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function saveUserDesignChanges() {
    setSavingChanges(true);
    try {
      const res = await fetch(
        `/api/settings/document-designs/${selectedDesignId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config: effectiveConfig }),
        },
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success("Design saved.");
      mutate();
      setConfigOverrides({});
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingChanges(false);
    }
  }

  const isUserDesign = userDesigns.some((d) => d.id === selectedDesignId);
  const hasOverrides = Object.keys(configOverrides).length > 0;

  // Build preview sample data with variable row count
  const allMockItems = [...SAMPLE_DATA.items, ...EXTRA_MOCK_ITEMS];
  const effectiveMockItems = allMockItems.slice(0, Math.max(1, mockRowCount));
  const effectiveSampleData =
    activeDocType === "receipt"
      ? SAMPLE_RECEIPT_DATA
      : {
          ...SAMPLE_DATA,
          items: effectiveMockItems,
          subTotal: effectiveMockItems.reduce(
            (s, i) => s + i.quantity * i.price,
            0,
          ),
        };

  // Page height in CSS pixels at preview width=595, based on page size + orientation.
  // At scale=1 (width=595), document points === CSS pixels.
  // For landscape, swap width/height so the short dimension becomes the page height.
  const PAGE_DIMS: Record<string, { w: number; h: number }> = {
    A4: { w: 595, h: 842 },
    A5: { w: 420, h: 595 },
    Letter: { w: 612, h: 792 },
    Legal: { w: 612, h: 1008 },
  };
  const dims = PAGE_DIMS[effectiveConfig.pageSize ?? "A4"] ?? PAGE_DIMS.A4;
  const isLandscape = effectiveConfig.pageOrientation === "landscape";
  // portrait: 595 * (pageHeight/pageWidth); landscape: page is rotated, so height←width
  const previewPageHeight = isLandscape
    ? Math.round((595 * dims.w) / dims.h) // e.g. A4 landscape → 595*595/842 ≈ 421
    : Math.round((595 * dims.h) / dims.w); // e.g. A4 portrait  → 595*842/595 = 842

  // Measure the actual CSS pixel width of the preview wrapper so the document
  // auto-scales to fill it (width="min(595px, 100%)"). Initial value 595 so
  // scale=1 before the first measurement fires.
  const previewWrapRef = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState(595);
  useEffect(() => {
    const el = previewWrapRef.current;
    if (!el) return;
    const update = () =>
      setPreviewWidth(
        Math.max(1, Math.floor(el.getBoundingClientRect().width)),
      );
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [splitPct, setSplitPct] = useState(50);
  const isDragging = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const onDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (mv: MouseEvent) => {
      if (!isDragging.current || !bodyRef.current) return;
      const rect = bodyRef.current.getBoundingClientRect();
      const pct = ((mv.clientX - rect.left) / rect.width) * 100;
      setSplitPct(Math.min(75, Math.max(25, pct)));
    };
    const onUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  const lbl = {
    fontSize: 11,
    color: T3,
    fontWeight: 500,
    marginBottom: 4,
    display: "block",
  } as const;
  const secHd = {
    fontSize: 10,
    fontWeight: 600,
    color: T3,
    textTransform: "uppercase" as const,
    letterSpacing: "0.07em",
    marginBottom: 10,
  };

  function Toggle({
    configKey,
    label,
  }: {
    configKey: keyof DocumentDesignConfig;
    label: string;
  }) {
    const val = !!effectiveConfig[configKey];
    return (
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
        }}
      >
        <div
          onClick={() =>
            updateConfig({ [configKey]: !val } as Partial<DocumentDesignConfig>)
          }
          style={{
            width: 30,
            height: 16,
            borderRadius: 100,
            background: val ? "#6366f1" : "rgba(255,255,255,0.1)",
            position: "relative",
            cursor: "pointer",
            transition: "background 0.2s",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#fff",
              position: "absolute",
              top: 2,
              left: val ? 16 : 2,
              transition: "left 0.2s",
            }}
          />
        </div>
        <span style={{ fontSize: 11, color: T2 }}>{label}</span>
      </label>
    );
  }

  function SegmentButtons<T extends string>({
    configKey,
    options,
    label,
  }: {
    configKey: keyof DocumentDesignConfig;
    options: readonly { value: T; label: string }[];
    label: string;
  }) {
    const current = effectiveConfig[configKey] as string;
    return (
      <div>
        <label style={lbl}>{label}</label>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const }}>
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() =>
                updateConfig({
                  [configKey]: o.value,
                } as Partial<DocumentDesignConfig>)
              }
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 10,
                cursor: "pointer",
                border: `1px solid ${current === o.value ? "#818cf8" : GLASS_BORDER}`,
                background:
                  current === o.value ? "rgba(99,102,241,0.18)" : GLASS,
                color: current === o.value ? "#818cf8" : T2,
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const PICKER_PREVIEWS: Record<string, { bg: string; text: string }> = {
    "classic-corporate": { bg: "#1a2744", text: "#fff" },
    "modern-gradient": {
      bg: "linear-gradient(135deg,#6366f1,#8b5cf6)",
      text: "#fff",
    },
    "minimal-clean": { bg: "#f8f9fa", text: "#374151" },
    "executive-dark": { bg: "#0f172a", text: "#94a3b8" },
    "bold-accent": { bg: "#fff7ed", text: "#f97316" },
    "retro-serif": { bg: "#faf7f0", text: "#8b4513" },
  };

  if (isLoading || !settings) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100dvh",
          overflow: "hidden",
        }}
      >
        {/* Topbar skeleton */}
        <div style={{ ...TOPBAR_STYLE }}>
          <Link
            href="/settings"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "5px 11px",
              borderRadius: 100,
              background: GLASS,
              border: `0.5px solid ${GLASS_BORDER}`,
              color: T2,
              fontSize: 11.5,
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            >
              <path d="M8 2L4 6l4 4" />
            </svg>
            Settings
          </Link>
          <div style={{ fontSize: 15, fontWeight: 600, color: T1 }}>
            Document Design
          </div>
        </div>
        {/* Body skeleton */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              border: "2.5px solid rgba(99,102,241,0.25)",
              borderTopColor: "#6366f1",
              animation: "spin 0.7s linear infinite",
            }}
          />
          <span style={{ fontSize: 12, color: T3 }}>
            Loading design settings…
          </span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        overflow: "hidden",
      }}
    >
      {/* Topbar */}
      <div style={{ ...TOPBAR_STYLE }}>
        <Link
          href="/settings"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "5px 11px",
            borderRadius: 100,
            background: GLASS,
            border: `0.5px solid ${GLASS_BORDER}`,
            color: T2,
            fontSize: 11.5,
            cursor: "pointer",
            textDecoration: "none",
          }}
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <path d="M8 2L4 6l4 4" />
          </svg>
          Settings
        </Link>
        <div style={{ fontSize: 15, fontWeight: 600, color: T1 }}>
          Document Design
        </div>
      </div>

      {/* Doc type tabs */}
      <div
        style={{
          display: "flex",
          gap: 2,
          padding: "8px 20px",
          borderBottom: `0.5px solid ${GLASS_BORDER}`,
          background: "rgba(10,14,28,0.4)",
          flexShrink: 0,
        }}
      >
        {DOC_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveDocType(tab.id)}
            style={{
              padding: "5px 16px",
              borderRadius: 100,
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              border: "none",
              transition: "all 0.15s",
              background:
                activeDocType === tab.id
                  ? "rgba(99,102,241,0.2)"
                  : "transparent",
              color: activeDocType === tab.id ? "#818cf8" : T3,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main layout: left panel + right preview */}
      <div
        ref={bodyRef}
        style={{ display: "flex", flex: 1, overflow: "hidden" }}
      >
        {/* ── Left panel: design grid + settings ── */}
        <div
          style={{
            width: `${splitPct}%`,
            flexShrink: 0,
            borderRight: `0.5px solid ${GLASS_BORDER}`,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Design grid */}
          <div style={{ padding: "14px 14px 0" }}>
            <div style={secHd}>Select Design</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 7,
                marginBottom: 12,
              }}
            >
              {allDesigns.map((d) => {
                const preset = (d.config.preset ?? "modern-gradient") as string;
                const meta =
                  PICKER_PREVIEWS[preset] ?? PICKER_PREVIEWS["modern-gradient"];
                const isSelected = selectedDesignId === d.id;
                const isDefault = defaultDesignId === d.id;
                const isUser = userDesigns.some((u) => u.id === d.id);
                const pmeta = PRESET_META[preset as PresetId];
                return (
                  <div key={d.id} style={{ position: "relative" }}>
                    <button
                      onClick={() => selectDesign(d.id)}
                      style={{
                        width: "100%",
                        padding: 0,
                        border: `1.5px solid ${isSelected ? "#818cf8" : isDefault ? "rgba(99,102,241,0.4)" : GLASS_BORDER}`,
                        borderRadius: 8,
                        overflow: "hidden",
                        cursor: "pointer",
                        background: isSelected
                          ? "rgba(99,102,241,0.08)"
                          : GLASS,
                        transition: "all 0.15s",
                        textAlign: "left",
                        boxShadow: isSelected
                          ? "0 0 0 1px rgba(99,102,241,0.3)"
                          : "none",
                      }}
                    >
                      {isDefault && !isSelected && (
                        <div
                          style={{
                            position: "absolute",
                            top: 4,
                            right: 4,
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "#6366f1",
                            zIndex: 1,
                          }}
                        />
                      )}
                      {isSelected && (
                        <div
                          style={{
                            position: "absolute",
                            top: 4,
                            right: 4,
                            zIndex: 1,
                            width: 14,
                            height: 14,
                            borderRadius: "50%",
                            background: "#6366f1",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <svg
                            width="7"
                            height="7"
                            viewBox="0 0 10 10"
                            fill="none"
                            stroke="#fff"
                            strokeWidth="2"
                          >
                            <path d="M2 5l2.5 2.5L8 3" />
                          </svg>
                        </div>
                      )}
                      <div
                        style={{
                          height: 50,
                          background: meta.bg,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0 8px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 7,
                            fontWeight: 700,
                            color: meta.text,
                            opacity: 0.9,
                          }}
                        >
                          Co.
                        </span>
                        <span
                          style={{
                            fontSize: 8.5,
                            fontWeight: 800,
                            color: meta.text,
                            opacity: 0.9,
                          }}
                        >
                          INV
                        </span>
                      </div>
                      <div style={{ padding: "5px 7px 6px" }}>
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 500,
                            color: T1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {d.name}
                        </div>
                        {pmeta && (
                          <div style={{ fontSize: 8.5, color: T3 }}>
                            {pmeta.tag}
                          </div>
                        )}
                      </div>
                    </button>
                    {isUser && (
                      <button
                        onClick={() => deleteUserDesign(d.id)}
                        style={{
                          position: "absolute",
                          bottom: 5,
                          right: 4,
                          width: 16,
                          height: 16,
                          borderRadius: 4,
                          background: "rgba(248,113,113,0.15)",
                          border: "0.5px solid rgba(248,113,113,0.3)",
                          color: "#f87171",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 8,
                        }}
                        title="Delete"
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Settings tabs */}
          <div style={{ flex: 1, borderTop: `0.5px solid ${GLASS_BORDER}` }}>
            <div style={{ display: "flex", gap: 1, padding: "8px 14px 0" }}>
              {SETTINGS_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveSettingsTab(tab)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    fontSize: 10.5,
                    fontWeight: 500,
                    cursor: "pointer",
                    border: "none",
                    transition: "all 0.15s",
                    background:
                      activeSettingsTab === tab
                        ? "rgba(99,102,241,0.18)"
                        : "transparent",
                    color: activeSettingsTab === tab ? "#818cf8" : T3,
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div style={{ padding: "12px 14px" }}>
              {/* Header tab */}
              {activeSettingsTab === "Header" && (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  <Toggle configKey="headerEnabled" label="Enable header" />
                  {effectiveConfig.headerEnabled !== false && (
                    <>
                      <div>
                        <label style={lbl}>Header background</label>
                        <div
                          style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
                        >
                          {[
                            { label: "Navy", value: "#1a2744" },
                            { label: "Indigo", value: "#6366f1" },
                            { label: "Dark", value: "#0f172a" },
                            { label: "White", value: "#ffffff" },
                            { label: "Warm", value: "#faf7f0" },
                            { label: "Orange", value: "#fff7ed" },
                          ].map((c) => (
                            <button
                              key={c.value}
                              onClick={() =>
                                updateConfig({ headerBg: c.value })
                              }
                              title={c.label}
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 5,
                                background: c.value,
                                cursor: "pointer",
                                border:
                                  effectiveConfig.headerBg === c.value
                                    ? "2px solid #818cf8"
                                    : "1px solid rgba(255,255,255,0.2)",
                              }}
                            />
                          ))}
                          <Input
                            type="color"
                            value={
                              effectiveConfig.headerBg?.startsWith("#")
                                ? effectiveConfig.headerBg
                                : "#6366f1"
                            }
                            onChange={(e) =>
                              updateConfig({ headerBg: e.target.value })
                            }
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 5,
                              border: "none",
                              cursor: "pointer",
                              padding: 0,
                            }}
                            title="Custom color"
                          />
                        </div>
                        <div style={{ marginTop: 6 }}>
                          <button
                            onClick={() =>
                              updateConfig({
                                headerBg:
                                  "linear-gradient(135deg, #6366f1, #8b5cf6)",
                              })
                            }
                            style={{
                              fontSize: 10,
                              padding: "3px 8px",
                              borderRadius: 100,
                              border: `0.5px solid ${GLASS_BORDER}`,
                              background: effectiveConfig.headerBg?.includes(
                                "gradient",
                              )
                                ? "rgba(99,102,241,0.2)"
                                : GLASS,
                              color: T2,
                              cursor: "pointer",
                            }}
                          >
                            Indigo Gradient
                          </button>
                          <button
                            onClick={() =>
                              updateConfig({
                                headerBg:
                                  "linear-gradient(135deg, #1e293b, #334155)",
                              })
                            }
                            style={{
                              fontSize: 10,
                              padding: "3px 8px",
                              borderRadius: 100,
                              border: `0.5px solid ${GLASS_BORDER}`,
                              background: GLASS,
                              color: T2,
                              cursor: "pointer",
                              marginLeft: 4,
                            }}
                          >
                            Dark Gradient
                          </button>
                        </div>
                      </div>
                      <div>
                        <label style={lbl}>Header text color</label>
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            flexWrap: "wrap",
                            alignItems: "center",
                          }}
                        >
                          {[
                            "#ffffff",
                            "#f8fafc",
                            "#111827",
                            "#1e293b",
                            "#c8a96e",
                            "#8b4513",
                          ].map((c) => (
                            <button
                              key={c}
                              onClick={() =>
                                updateConfig({ headerTextColor: c })
                              }
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 5,
                                background: c,
                                cursor: "pointer",
                                border:
                                  effectiveConfig.headerTextColor === c
                                    ? "2px solid #818cf8"
                                    : "1px solid rgba(255,255,255,0.2)",
                              }}
                              title={c}
                            />
                          ))}
                          <Input
                            type="color"
                            value={effectiveConfig.headerTextColor || "#ffffff"}
                            onChange={(e) =>
                              updateConfig({ headerTextColor: e.target.value })
                            }
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 5,
                              border: "none",
                              cursor: "pointer",
                              padding: 0,
                            }}
                            title="Custom text color"
                          />
                          {effectiveConfig.headerTextColor && (
                            <button
                              onClick={() =>
                                updateConfig({ headerTextColor: "" })
                              }
                              style={{
                                fontSize: 9,
                                padding: "2px 6px",
                                borderRadius: 4,
                                border: `0.5px solid ${GLASS_BORDER}`,
                                background: GLASS,
                                color: T3,
                                cursor: "pointer",
                              }}
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                      <div>
                        <label style={lbl}>Accent colour</label>
                        <div
                          style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
                        >
                          {[
                            "#6366f1",
                            "#8b5cf6",
                            "#f97316",
                            "#c8a96e",
                            "#94a3b8",
                            "#374151",
                            "#16a34a",
                            "#dc2626",
                            "#8b4513",
                          ].map((c) => (
                            <button
                              key={c}
                              onClick={() => updateConfig({ accentColor: c })}
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: "50%",
                                background: c,
                                cursor: "pointer",
                                border:
                                  effectiveConfig.accentColor === c
                                    ? "2px solid #fff"
                                    : "none",
                                boxShadow:
                                  effectiveConfig.accentColor === c
                                    ? `0 0 0 2px ${c}60`
                                    : "none",
                              }}
                            />
                          ))}
                          <Input
                            type="color"
                            value={effectiveConfig.accentColor ?? "#6366f1"}
                            onChange={(e) =>
                              updateConfig({ accentColor: e.target.value })
                            }
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: "50%",
                              border: "none",
                              cursor: "pointer",
                              padding: 0,
                            }}
                          />
                        </div>
                      </div>
                      <SegmentButtons
                        configKey="headerVisibility"
                        options={HEADER_VISIBILITIES}
                        label="Show header on (print)"
                      />
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        <Toggle
                          configKey="showLogo"
                          label="Show company logo"
                        />
                        {effectiveConfig.showLogo && (
                          <div>
                            <label style={lbl}>
                              Logo URL (or upload via Company Settings)
                            </label>
                            <Input
                              value={(effectiveConfig as any).logoUrl ?? ""}
                              onChange={(e) =>
                                updateConfig({ logoUrl: e.target.value })
                              }
                              placeholder="https://example.com/logo.png"
                            />
                          </div>
                        )}
                        <Toggle
                          configKey="showAddress"
                          label="Show company address"
                        />
                        <Toggle
                          configKey="showPhone"
                          label="Show company phone"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Footer tab */}
              {activeSettingsTab === "Footer" && (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  <Toggle configKey="footerEnabled" label="Enable footer" />
                  {effectiveConfig.footerEnabled !== false && (
                    <>
                      <div>
                        <label style={lbl}>Footer text</label>
                        <Input
                          value={effectiveConfig.footerText ?? ""}
                          onChange={(e) =>
                            updateConfig({ footerText: e.target.value })
                          }
                          placeholder="Thank you for your business."
                        />
                      </div>
                      <div>
                        <label style={lbl}>Footer background</label>
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            flexWrap: "wrap",
                            alignItems: "center",
                          }}
                        >
                          {[
                            "#ffffff",
                            "#f8fafc",
                            "#f1f5f9",
                            "#0f172a",
                            "#1e293b",
                            "#faf7f0",
                          ].map((c) => (
                            <button
                              key={c}
                              onClick={() => updateConfig({ footerBg: c })}
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 5,
                                background: c,
                                cursor: "pointer",
                                border:
                                  effectiveConfig.footerBg === c
                                    ? "2px solid #818cf8"
                                    : "1px solid rgba(255,255,255,0.2)",
                              }}
                              title={c}
                            />
                          ))}
                          <Input
                            type="color"
                            value={
                              (effectiveConfig as any).footerBg || "#ffffff"
                            }
                            onChange={(e) =>
                              updateConfig({ footerBg: e.target.value })
                            }
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 5,
                              border: "none",
                              cursor: "pointer",
                              padding: 0,
                            }}
                            title="Custom bg"
                          />
                          {effectiveConfig.footerBg && (
                            <button
                              onClick={() => updateConfig({ footerBg: "" })}
                              style={{
                                fontSize: 9,
                                padding: "2px 6px",
                                borderRadius: 4,
                                border: `0.5px solid ${GLASS_BORDER}`,
                                background: GLASS,
                                color: T3,
                                cursor: "pointer",
                              }}
                            >
                              None
                            </button>
                          )}
                        </div>
                      </div>
                      <div>
                        <label style={lbl}>Footer text color</label>
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            flexWrap: "wrap",
                            alignItems: "center",
                          }}
                        >
                          {[
                            "#888888",
                            "#9ca3af",
                            "#475569",
                            "#111827",
                            "#ffffff",
                            "#7c5533",
                          ].map((c) => (
                            <button
                              key={c}
                              onClick={() =>
                                updateConfig({ footerTextColor: c })
                              }
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 5,
                                background: c,
                                cursor: "pointer",
                                border:
                                  effectiveConfig.footerTextColor === c
                                    ? "2px solid #818cf8"
                                    : "1px solid rgba(255,255,255,0.2)",
                              }}
                              title={c}
                            />
                          ))}
                          <Input
                            type="color"
                            value={
                              (effectiveConfig as any).footerTextColor ||
                              "#888888"
                            }
                            onChange={(e) =>
                              updateConfig({ footerTextColor: e.target.value })
                            }
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 5,
                              border: "none",
                              cursor: "pointer",
                              padding: 0,
                            }}
                            title="Custom text color"
                          />
                          {effectiveConfig.footerTextColor && (
                            <button
                              onClick={() =>
                                updateConfig({ footerTextColor: "" })
                              }
                              style={{
                                fontSize: 9,
                                padding: "2px 6px",
                                borderRadius: 4,
                                border: `0.5px solid ${GLASS_BORDER}`,
                                background: GLASS,
                                color: T3,
                                cursor: "pointer",
                              }}
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                      <Toggle
                        configKey="showPageNumber"
                        label="Show page number"
                      />
                    </>
                  )}
                </div>
              )}

              {/* Content tab */}
              {activeSettingsTab === "Content" && (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  <div>
                    <label style={lbl}>Table style</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      {(["striped", "bordered", "minimal"] as const).map(
                        (s) => (
                          <button
                            key={s}
                            onClick={() => updateConfig({ tableStyle: s })}
                            style={{
                              flex: 1,
                              padding: "5px 0",
                              borderRadius: 6,
                              fontSize: 10.5,
                              cursor: "pointer",
                              border: `1px solid ${effectiveConfig.tableStyle === s ? "#818cf8" : GLASS_BORDER}`,
                              background:
                                effectiveConfig.tableStyle === s
                                  ? "rgba(99,102,241,0.18)"
                                  : GLASS,
                              color:
                                effectiveConfig.tableStyle === s
                                  ? "#818cf8"
                                  : T2,
                              textTransform: "capitalize",
                            }}
                          >
                            {s}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    <Toggle configKey="showTax" label="Show tax line" />
                    <Toggle
                      configKey="showDiscount"
                      label="Show discount line"
                    />
                  </div>
                  <div
                    style={{
                      borderTop: `0.5px solid ${GLASS_BORDER}`,
                      paddingTop: 10,
                    }}
                  >
                    <div style={secHd}>Terms & Conditions</div>
                    <Toggle
                      configKey="showTerms"
                      label="Enable terms & conditions"
                    />
                    {effectiveConfig.showTerms && (
                      <>
                        <div style={{ marginTop: 8 }}>
                          <SegmentButtons
                            configKey="termsPosition"
                            options={TERMS_POSITIONS}
                            label="Position"
                          />
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <SegmentButtons
                            configKey="termsFormat"
                            options={TERMS_FORMATS}
                            label="Format"
                          />
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <label style={lbl}>Terms text</label>
                          <TermsEditor
                            text={effectiveConfig.termsText ?? ""}
                            format={
                              (effectiveConfig.termsFormat ?? "paragraph") as
                                | "paragraph"
                                | "bullet"
                                | "numbered"
                            }
                            onChange={(val) => updateConfig({ termsText: val })}
                          />
                          {!effectiveConfig.termsText && (
                            <div
                              style={{ fontSize: 9, color: T3, marginTop: 4 }}
                            >
                              Empty — will use terms from Company Settings
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <div
                    style={{
                      borderTop: `0.5px solid ${GLASS_BORDER}`,
                      paddingTop: 10,
                    }}
                  >
                    <label style={lbl}>
                      Content gap between sections:{" "}
                      {effectiveConfig.contentGap ?? 12}px
                    </label>
                    <Slider
                      min={4}
                      max={40}
                      step={2}
                      value={[effectiveConfig.contentGap ?? 12]}
                      onValueChange={([v]) => updateConfig({ contentGap: v })}
                    />
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 9,
                        color: T3,
                        marginTop: 2,
                      }}
                    >
                      <span>Tight (4px)</span>
                      <span>Spacious (40px)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Page & Style tab */}
              {activeSettingsTab === "Page & Style" && (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  <div>
                    <label style={lbl}>Font family</label>
                    <Select
                      value={
                        effectiveConfig.fontFamily ?? FONT_OPTIONS[0].value
                      }
                      onValueChange={(v) => updateConfig({ fontFamily: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {FONT_OPTIONS.map((f) => (
                            <SelectItem key={f.value} value={f.value}>
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label style={lbl}>Watermark text</label>
                    <Input
                      value={effectiveConfig.watermark ?? ""}
                      onChange={(e) =>
                        updateConfig({ watermark: e.target.value })
                      }
                      placeholder="e.g. DRAFT, PAID, CONFIDENTIAL"
                    />
                  </div>
                  <div
                    style={{
                      borderTop: `0.5px solid ${GLASS_BORDER}`,
                      paddingTop: 10,
                    }}
                  >
                    <div style={secHd}>Page Setup</div>
                    <div>
                      <label style={lbl}>Page size</label>
                      <div style={{ display: "flex", gap: 4 }}>
                        {PAGE_SIZES.map((s) => (
                          <button
                            key={s}
                            onClick={() => updateConfig({ pageSize: s })}
                            style={{
                              flex: 1,
                              padding: "5px 0",
                              borderRadius: 6,
                              fontSize: 10.5,
                              cursor: "pointer",
                              border: `1px solid ${effectiveConfig.pageSize === s ? "#818cf8" : GLASS_BORDER}`,
                              background:
                                effectiveConfig.pageSize === s
                                  ? "rgba(99,102,241,0.18)"
                                  : GLASS,
                              color:
                                effectiveConfig.pageSize === s ? "#818cf8" : T2,
                            }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <label style={lbl}>Orientation</label>
                      <div style={{ display: "flex", gap: 4 }}>
                        {ORIENTATIONS.map((o) => (
                          <button
                            key={o}
                            onClick={() => updateConfig({ pageOrientation: o })}
                            style={{
                              flex: 1,
                              padding: "5px 0",
                              borderRadius: 6,
                              fontSize: 10.5,
                              cursor: "pointer",
                              border: `1px solid ${effectiveConfig.pageOrientation === o ? "#818cf8" : GLASS_BORDER}`,
                              background:
                                effectiveConfig.pageOrientation === o
                                  ? "rgba(99,102,241,0.18)"
                                  : GLASS,
                              color:
                                effectiveConfig.pageOrientation === o
                                  ? "#818cf8"
                                  : T2,
                              textTransform: "capitalize",
                            }}
                          >
                            {o}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        padding: "6px 8px",
                        borderRadius: 5,
                        background: "rgba(99,102,241,0.06)",
                        border: `0.5px solid rgba(99,102,241,0.15)`,
                      }}
                    >
                      <span style={{ fontSize: 9.5, color: T3 }}>
                        Page size & orientation apply to PDF export. Preview
                        always shows A4 portrait scale.
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div
            style={{
              padding: "10px 14px 14px",
              borderTop: `0.5px solid ${GLASS_BORDER}`,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {/* Unsaved changes banner */}
            {hasOverrides && (
              <div
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  background: "rgba(234,179,8,0.08)",
                  border: "0.5px solid rgba(234,179,8,0.3)",
                  fontSize: 10,
                  color: "#fbbf24",
                }}
              >
                Unsaved changes —{" "}
                {isUserDesign
                  ? "save or discard below."
                  : "save as custom design to keep them."}
              </div>
            )}
            {/* Save changes to existing user design */}
            {isUserDesign && (
              <Button
                loading={savingChanges}
                onClick={saveUserDesignChanges}
                style={{ width: "100%", opacity: hasOverrides ? 1 : 0.45 }}
                disabled={!hasOverrides}
              >
                Save changes to this design
              </Button>
            )}
            <Button
              loading={settingDefault}
              onClick={setAsDefault}
              style={{
                width: "100%",
                background: isUserDesign ? undefined : "rgba(99,102,241,0.15)",
                border: isUserDesign
                  ? undefined
                  : "0.5px solid rgba(99,102,241,0.35)",
              }}
            >
              Set as default for {activeDocType}s
            </Button>
            <button
              onClick={() => setShowSaveAs((v) => !v)}
              style={{
                width: "100%",
                padding: "7px 0",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 500,
                color: hasOverrides && !isUserDesign ? "#818cf8" : T2,
                background:
                  hasOverrides && !isUserDesign
                    ? "rgba(99,102,241,0.12)"
                    : GLASS,
                border: `0.5px solid ${hasOverrides && !isUserDesign ? "rgba(99,102,241,0.4)" : GLASS_BORDER}`,
                cursor: "pointer",
              }}
            >
              {hasOverrides && !isUserDesign
                ? "Save as custom design ✱"
                : "Save as custom design"}
            </button>
            {showSaveAs && (
              <div style={{ display: "flex", gap: 6 }}>
                <Input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Design name"
                  style={{ flex: 1, fontSize: 11 }}
                  onKeyDown={(e) => e.key === "Enter" && saveAsCustom()}
                />
                <Button size="sm" loading={savingCustom} onClick={saveAsCustom}>
                  Save
                </Button>
              </div>
            )}
            {hasOverrides && isUserDesign && (
              <button
                onClick={() => setConfigOverrides({})}
                style={{
                  width: "100%",
                  padding: "5px 0",
                  borderRadius: 8,
                  fontSize: 11,
                  color: "#f87171",
                  background: "rgba(248,113,113,0.06)",
                  border: "0.5px solid rgba(248,113,113,0.2)",
                  cursor: "pointer",
                }}
              >
                Discard changes
              </button>
            )}
          </div>
        </div>

        {/* Draggable divider */}
        <div
          onMouseDown={onDividerMouseDown}
          style={{
            width: 5,
            flexShrink: 0,
            cursor: "col-resize",
            background: "transparent",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          <div
            style={{
              width: 3,
              height: 40,
              borderRadius: 2,
              background: GLASS_BORDER,
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(99,102,241,0.5)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = GLASS_BORDER)
            }
          />
        </div>

        {/* ── Right: A4 preview ── */}
        <div
          style={{
            flex: 1,
            background: "#111827",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "20px 20px 28px",
          }}
        >
          {/* Preview toolbar */}
          <div
            style={{
              width: "min(595px, 100%)",
              marginBottom: 10,
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                flex: 1,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: T3,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  whiteSpace: "nowrap",
                }}
              >
                Preview — {previewDesign.name}
              </span>
              {defaultDesignId === selectedDesignId && (
                <span
                  style={{
                    fontSize: 9.5,
                    padding: "2px 8px",
                    borderRadius: 100,
                    background: "rgba(99,102,241,0.15)",
                    color: "#818cf8",
                    border: "0.5px solid rgba(99,102,241,0.3)",
                    whiteSpace: "nowrap",
                  }}
                >
                  Default
                </span>
              )}
              {hasOverrides && (
                <span
                  style={{
                    fontSize: 9.5,
                    padding: "2px 8px",
                    borderRadius: 100,
                    background: "rgba(234,179,8,0.12)",
                    color: "#fbbf24",
                    border: "0.5px solid rgba(234,179,8,0.3)",
                    whiteSpace: "nowrap",
                  }}
                >
                  Unsaved
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              {/* Multi-page toggle */}
              <button
                onClick={() => setShowMultiPage((v) => !v)}
                title="Toggle multi-page view"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: 10,
                  cursor: "pointer",
                  border: `0.5px solid ${showMultiPage ? "rgba(99,102,241,0.5)" : GLASS_BORDER}`,
                  background: showMultiPage ? "rgba(99,102,241,0.15)" : GLASS,
                  color: showMultiPage ? "#818cf8" : T2,
                }}
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <rect x="1" y="1" width="4.5" height="6" rx="0.5" />
                  <rect x="6.5" y="1" width="4.5" height="6" rx="0.5" />
                  <line x1="1" y1="9" x2="5.5" y2="9" />
                  <line x1="6.5" y1="9" x2="11" y2="9" />
                </svg>
                Pages
              </button>
              {/* Mock rows control (not for receipts) */}
              {activeDocType !== "receipt" && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "3px 8px",
                    borderRadius: 6,
                    border: `0.5px solid ${GLASS_BORDER}`,
                    background: GLASS,
                  }}
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke={T3}
                    strokeWidth="1.5"
                  >
                    <line x1="1" y1="3" x2="11" y2="3" />
                    <line x1="1" y1="6" x2="11" y2="6" />
                    <line x1="1" y1="9" x2="11" y2="9" />
                  </svg>
                  <span
                    style={{ fontSize: 10, color: T3, whiteSpace: "nowrap" }}
                  >
                    {mockRowCount} rows
                  </span>
                  <Slider
                    min={1}
                    max={30}
                    step={1}
                    value={[mockRowCount]}
                    onValueChange={([v]) => setMockRowCount(v)}
                    className="w-17.5"
                  />
                </div>
              )}
            </div>
          </div>
          <div
            ref={previewWrapRef}
            style={{
              boxShadow: "0 12px 60px rgba(0,0,0,0.7)",
              borderRadius: 4,
              overflowY: "scroll",
              width: "min(595px, 100%)",
            }}
          >
            <DocumentRenderer
              design={previewDesign}
              width={previewWidth}
              showPageBreaks={showMultiPage}
              pageHeight={previewPageHeight}
              data={{
                type: activeDocType,
                ...effectiveSampleData,
                companyName: settings?.company_name ?? "Your Company",
                companyEmail: settings?.company_email,
                companyPhone: settings?.company_phone,
                companyAddress: settings?.company_address,
                companyLogo: settings?.company_logo,
                termsText:
                  settings?.terms_and_conditions ??
                  "Payment due within 30 days.\nLate payments are subject to a 2% monthly interest charge.\nAll disputes to be resolved under applicable law.",
              }}
            />
          </div>
          <p
            style={{
              fontSize: 10.5,
              color: T3,
              marginTop: 14,
              textAlign: "center",
            }}
          >
            {showMultiPage
              ? `Page size: ${effectiveConfig.pageSize ?? "A4"} ${effectiveConfig.pageOrientation ?? "portrait"} · ${previewPageHeight}px per page · add rows to see overflow`
              : "Preview uses sample data. Actual documents reflect real client and transaction data."}
          </p>
        </div>
      </div>
    </div>
  );
}
