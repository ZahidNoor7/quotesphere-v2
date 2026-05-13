"use client";
import { useState, useEffect, useRef, useCallback, memo, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePickerInput } from "@/components/ui/date-picker";
import { formatCurrency } from "@/lib/utils";
import { T1, T2, T3, AC2, GLASS, GLASS_BORDER, TOPBAR_STYLE } from "@/lib/ds";
import type { Customer, Service, Project } from "@/types";
import { useSettings } from "@/hooks/use-settings";
import { useCurrencyRates } from "@/hooks/use-currency-rates";
import { useIsMobile } from "@/hooks/use-mobile";
import { DocumentRenderer } from "@/components/document-design/document-renderer";
import { BUILT_IN_DESIGNS, getAllDesigns, getDesignById, getDefaultDesign } from "@/lib/document-designs";
import { TriangleAlert } from "lucide-react";

// Portrait [w, h] in pt; landscape swaps them
const PAGE_DIMS: Record<string, [number, number]> = {
  a4: [595, 842],
  a5: [420, 595],
  letter: [612, 792],
  legal: [612, 1008],
};

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(d => d.data);

interface LineItem { id: number; name: string; quantity: number; price: number; images?: string[]; }
interface BuilderProps { type: "invoice" | "quotation"; initialData?: any; }

async function compressImage(file: File, maxPx = 320, quality = 0.75): Promise<string> {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}

interface MobileItemCardProps {
  item: LineItem;
  idx: number;
  currency: string;
  disableRemove: boolean;
  hasError?: boolean;
  onUpdate: (id: number, key: "name" | "quantity" | "price", val: string) => void;
  onRemove: (id: number) => void;
  onDuplicate: (id: number) => void;
  onImageDialog: (id: number) => void;
  onImageUpload: (id: number) => void;
  onClearError?: () => void;
}

const MobileItemCard = memo(function MobileItemCard({ item, idx, currency, disableRemove, hasError, onUpdate, onRemove, onDuplicate, onImageDialog, onImageUpload, onClearError }: MobileItemCardProps) {
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(String(item.quantity));
  const [price, setPrice] = useState(String(item.price));

  // Sync from parent when item changes externally (e.g. initial load)
  useEffect(() => { setName(item.name); }, [item.name]);
  useEffect(() => { setQty(String(item.quantity)); }, [item.quantity]);
  useEffect(() => { setPrice(String(item.price)); }, [item.price]);

  const localTotal = (parseFloat(qty) || 0) * (parseFloat(price) || 0);

  return (
    <div style={{
      background: "var(--glass)", border: "0.5px solid var(--glass-border)",
      borderRadius: 12, padding: "12px",
    }}>
      {/* Card header: item # + image + remove */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: T3, fontWeight: 600, flex: 1, textTransform: "uppercase", letterSpacing: "0.05em" }}>Item {idx + 1}</span>
        {item.images?.length ? (
          <button onClick={() => onImageDialog(item.id)} title={`${item.images.length} image(s) — tap to manage`}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
            <div style={{ position: "relative" }}>
              <img src={item.images[0]} style={{ width: 22, height: 22, objectFit: "cover", borderRadius: 4, border: "0.5px solid rgba(99,102,241,0.5)", display: "block" }} />
              {item.images.length > 1 && <span style={{ position: "absolute", top: -4, right: -4, background: "#6366f1", color: "#fff", fontSize: 7, width: 11, height: 11, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{item.images.length}</span>}
            </div>
          </button>
        ) : (
          <button onClick={() => onImageUpload(item.id)} title="Attach image"
            style={{ background: "none", border: "none", cursor: "pointer", color: T3, padding: 2, display: "flex", opacity: 0.45 }}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1" y="3" width="14" height="10" rx="1.5" /><circle cx="5.5" cy="8" r="1.8" /><path d="M9 5.5l2.5 3.5-3 4.5" strokeLinejoin="round" /></svg>
          </button>
        )}
        <button onClick={() => onDuplicate(item.id)} title="Duplicate item"
          style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(99,102,241,0.1)", border: "0.5px solid rgba(99,102,241,0.25)", cursor: "pointer", color: "#818cf8", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="5" y="5" width="8" height="8" rx="1.5" /><path d="M3 11V3h8" /></svg>
        </button>
        <button onClick={() => onRemove(item.id)} disabled={disableRemove}
          style={{ width: 26, height: 26, borderRadius: 7, background: disableRemove ? "none" : "rgba(248,113,113,0.1)", border: disableRemove ? "none" : "0.5px solid rgba(248,113,113,0.25)", cursor: disableRemove ? "default" : "pointer", color: disableRemove ? "rgba(255,255,255,0.15)" : "#f87171", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
          <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3l10 10M13 3L3 13" /></svg>
        </button>
      </div>
      {/* Description */}
      <Input
        value={name}
        onChange={e => { setName(e.target.value); if (e.target.value.trim()) onClearError?.(); }}
        onBlur={() => onUpdate(item.id, "name", name)}
        placeholder="Service or item description"
        className="h-9 text-sm"
        style={hasError ? { borderColor: "rgba(248,113,113,0.75)", boxShadow: "0 0 0 2px rgba(248,113,113,0.18)" } : undefined}
      />
      {hasError && (
        <div style={{ fontSize: 10, color: "#f87171", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3.5c.4 0 .7.3.7.7v3.6c0 .4-.3.7-.7.7s-.7-.3-.7-.7V5.2c0-.4.3-.7.7-.7zm0 6.5a.8.8 0 110-1.6.8.8 0 010 1.6z"/></svg>
          Description is required
        </div>
      )}
      {/* Qty + Price */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
        <div>
          <div style={{ fontSize: 10, color: T3, fontWeight: 500, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>Qty</div>
          <Input
            type="number" min="0"
            value={qty}
            onChange={e => setQty(e.target.value)}
            onBlur={() => onUpdate(item.id, "quantity", qty)}
            className="h-9 text-sm text-center"
          />
        </div>
        <div>
          <div style={{ fontSize: 10, color: T3, fontWeight: 500, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>Price</div>
          <Input
            type="number" min="0"
            value={price}
            onChange={e => setPrice(e.target.value)}
            onBlur={() => onUpdate(item.id, "price", price)}
            className="h-9 text-sm text-right"
          />
        </div>
      </div>
      {/* Total row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 8, borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>
        <span style={{ fontSize: 10, color: T3, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: T1 }}>{formatCurrency(localTotal, currency)}</span>
      </div>
    </div>
  );
});

export function DocumentBuilder({ type, initialData }: BuilderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { settings, updateLastUsed } = useSettings();
  const { getSnapshot } = useCurrencyRates(settings?.default_currency ?? "PKR");
  // Capture original item prices for edit-mode price-change detection
  const originalPricesRef = useRef<Record<number, number>>(
    Object.fromEntries((initialData?.items ?? []).map((it: any) => [it.id ?? it._id, it.price]))
  );
  const { data: customers = [], mutate: mutateCustomers } = useSWR<Customer[]>("/api/customers?limit=200", fetcher);
  const { data: services = [] } = useSWR<Service[]>("/api/services", fetcher);
  const { data: projects = [] } = useSWR<Project[]>("/api/projects?limit=200&sort=name&order=asc", fetcher);
  const [showPreview, setShowPreview] = useState(true);
  const [showPreviewSheet, setShowPreviewSheet] = useState(false);
  const [drawerClosing, setDrawerClosing] = useState(false);
  const closeDrawer = useCallback(() => {
    setDrawerClosing(true);
    setTimeout(() => { setShowPreviewSheet(false); setDrawerClosing(false); }, 320);
  }, []);
  const [showDesignPicker, setShowDesignPicker] = useState(false);
  const designPickerRef = useRef<HTMLDivElement>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const [splitPct, setSplitPct] = useState(65);
  const isDragging = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Page size / orientation
  const [pageSize, setPageSize] = useState<"a4" | "a5" | "letter" | "legal">("a4");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [pgW, pgH] = PAGE_DIMS[pageSize];
  const pageHeight = orientation === "portrait" ? pgH : pgW;

  // Client search / quick-create
  const [clientSearch, setClientSearch] = useState("");
  const [showClientDrop, setShowClientDrop] = useState(false);
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", phone: "", company: "", address: "" });
  const [creatingClient, setCreatingClient] = useState(false);
  const clientDropRef = useRef<HTMLDivElement>(null);

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

  const [customerId, setCustomerId] = useState(initialData?.customer_id ?? searchParams.get("customer_id") ?? "");
  const [projectId, setProjectId] = useState(initialData?.project_id ?? searchParams.get("project_id") ?? "");
  const [issueDate, setIssueDate] = useState(initialData?.issue_date ? new Date(initialData.issue_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() => {
    if (initialData) {
      const d = initialData.due_date || initialData.valid_until;
      return d ? new Date(d).toISOString().slice(0, 10) : "";
    }
    if (type === "quotation") {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return d.toISOString().slice(0, 10);
    }
    return "";
  });
  const [currency, setCurrency] = useState(initialData?.currency ?? "PKR");
  const [paymentMode, setPaymentMode] = useState(initialData?.payment_mode ?? "cash");
  const [designId, setDesignId] = useState<string>(initialData?.designId ?? "");

  // Apply defaults once settings load (new documents only).
  // Priority: lastUsed values → settings defaults → hardcoded fallbacks.
  const appliedLastUsed = useRef(false);
  useEffect(() => {
    if (!initialData && settings && !appliedLastUsed.current) {
      appliedLastUsed.current = true;
      const currencyToApply = settings.lastUsed?.currency || settings.default_currency;
      if (currencyToApply) setCurrency(currencyToApply);
      if (settings.lastUsed?.paymentMethod) setPaymentMode(settings.lastUsed.paymentMethod);
      if (settings.default_tax != null && settings.default_tax > 0) {
        setTax(settings.default_tax.toString());
      }
      if (type === "invoice" && settings.default_payment_terms) {
        const d = new Date();
        d.setDate(d.getDate() + (settings.default_payment_terms as number));
        setDueDate(d.toISOString().slice(0, 10));
      }
      const lastDesignId = type === "invoice"
        ? settings.lastUsed?.invoiceDesignId
        : settings.lastUsed?.quotationDesignId;
      if (lastDesignId) setDesignId(lastDesignId);
    }
  }, [settings, initialData, type]);

  // Hide preview on mobile by default
  useEffect(() => {
    if (isMobile) setShowPreview(false);
  }, [isMobile]);

  const [advance, setAdvance] = useState(initialData?.advance?.toString() ?? "0");
  const [tax, setTax] = useState(initialData?.tax?.toString() ?? "0");
  const [taxType, setTaxType] = useState<"percentage" | "value">(initialData?.tax_type ?? "percentage");
  const [discount, setDiscount] = useState(initialData?.discount?.toString() ?? "0");
  const [delivery, setDelivery] = useState(initialData?.delivery_charges?.toString() ?? "0");
  const [remarks, setRemarks] = useState(initialData?.remarks ?? "");
  const [items, setItems] = useState<LineItem[]>(
    initialData?.items
      ? initialData.items.map((it: any, i: number) => ({
        id: it.id ?? (Date.now() + i),
        name: it.name ?? "",
        quantity: it.quantity ?? 1,
        price: it.price ?? 0,
        images: it.images ?? (it.image ? [it.image] : undefined),
      }))
      : [{ id: 1, name: "", quantity: 1, price: 0 }]
  );
  const [imageDialogItemId, setImageDialogItemId] = useState<number | null>(null);
  const [clientError, setClientError] = useState(false);
  const clientFieldRef = useRef<HTMLDivElement>(null);
  const [itemErrors, setItemErrors] = useState<Set<number>>(new Set());
  const itemRowRefs = useRef<Map<number, HTMLElement>>(new Map());
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [imgDragIdx, setImgDragIdx] = useState<number | null>(null);
  const [imgDragOverIdx, setImgDragOverIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [leaveHref, setLeaveHref] = useState("");

  const isDirty = useMemo(() => {
    if (saved) return false;
    if (!initialData) {
      return !!(customerId || items.some(i => i.name.trim()));
    }
    const origItems = initialData.items ?? [];
    return (
      customerId !== (initialData.customer_id ?? "") ||
      items.length !== origItems.length ||
      items.some((item, i) => {
        const orig = origItems[i];
        return !orig || item.name !== orig.name || item.quantity !== orig.quantity || item.price !== orig.price;
      }) ||
      currency !== (initialData.currency ?? "PKR") ||
      tax !== (initialData.tax?.toString() ?? "0") ||
      remarks !== (initialData.remarks ?? "")
    );
  }, [saved, initialData, customerId, items, currency, tax, remarks]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const customer = (customers as Customer[]).find(c => c._id === customerId);
  const subTotal = items.reduce((s, i) => s + i.quantity * i.price, 0);
  const taxAmt = taxType === "percentage" ? (subTotal * parseFloat(tax || "0")) / 100 : parseFloat(tax || "0");
  const total = subTotal + taxAmt + parseFloat(delivery || "0") - parseFloat(discount || "0");
  const outstanding = Math.max(0, total - parseFloat(advance || "0"));

  // Price-change warning: show if editing and any item price differs from the saved value
  const hasPriceChanged = useMemo(() => {
    if (!initialData?._id) return false;
    return items.some((item) => {
      const orig = originalPricesRef.current[item.id];
      return orig !== undefined && item.price !== orig;
    });
  }, [items, initialData]);

  // Resolve the active design
  const userDesigns = settings?.documentDesigns ?? [];
  const docType = type === "invoice" ? "invoice" as const : "quotation" as const;
  const allDesigns = getAllDesigns(userDesigns, docType);
  const activeDesign = designId
    ? getDesignById(designId, userDesigns)
    : getDefaultDesign(docType, userDesigns);

  // Close design picker on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (designPickerRef.current && !designPickerRef.current.contains(e.target as Node)) {
        setShowDesignPicker(false);
      }
    }
    if (showDesignPicker) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDesignPicker]);

  // Close more menu on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    }
    if (showMoreMenu) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMoreMenu]);

  // Close client dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (clientDropRef.current && !clientDropRef.current.contains(e.target as Node)) {
        setShowClientDrop(false);
      }
    }
    if (showClientDrop) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showClientDrop]);

  const filteredCustomers = (customers as Customer[]).filter(c =>
    !clientSearch ||
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.company && c.company.toLowerCase().includes(clientSearch.toLowerCase()))
  );

  async function createAndSelectClient() {
    if (!createForm.name.trim()) { toast.error("Client name is required."); return; }
    setCreatingClient(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createForm.name.trim(), phone_no: createForm.phone, company: createForm.company, address: createForm.address, status: true }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      await mutateCustomers();
      setCustomerId(data.data._id);
      setClientSearch(data.data.name);
      setClientError(false);
      setShowCreateClient(false);
      setCreateForm({ name: "", phone: "", company: "", address: "" });
      toast.success("Client created and selected.");
    } catch (err: any) { toast.error(err.message || "Failed to create client."); }
    finally { setCreatingClient(false); }
  }

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetId = useRef<number | null>(null);

  function addItem() { setItems(p => [...p, { id: Date.now(), name: "", quantity: 1, price: 0 }]); }
  const removeItem = useCallback((id: number) => { setItems(p => p.length > 1 ? p.filter(i => i.id !== id) : p); }, []);
  const duplicateItem = useCallback((id: number) => {
    setItems(p => {
      const idx = p.findIndex(i => i.id === id);
      if (idx === -1) return p;
      const copy = { ...p[idx], id: Date.now() };
      const next = [...p];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }, []);
  const updateItem = useCallback((id: number, key: "name" | "quantity" | "price", val: string | number) => {
    setItems(p => p.map(i => i.id === id ? { ...i, [key]: key === "name" ? val : (parseFloat(val as string) || 0) } : i));
    if (key === "name" && String(val).trim()) {
      setItemErrors(p => { const next = new Set(p); next.delete(id); return next; });
    }
  }, []);
  const clearItemError = useCallback((id: number) => {
    setItemErrors(p => { const next = new Set(p); next.delete(id); return next; });
  }, []);
  const triggerImageUpload = useCallback((id: number) => {
    uploadTargetId.current = id;
    fileInputRef.current?.click();
  }, []);
  function reorderItems(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return;
    setItems(p => {
      const next = [...p];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }
  function removeImage(itemId: number, imgIdx: number) {
    setItems(p => p.map(i => i.id === itemId
      ? { ...i, images: (i.images ?? []).filter((_, j) => j !== imgIdx) }
      : i));
  }
  function moveImageInItem(itemId: number, from: number, to: number) {
    setItems(p => p.map(i => {
      if (i.id !== itemId) return i;
      const imgs = [...(i.images ?? [])];
      const [moved] = imgs.splice(from, 1);
      imgs.splice(to, 0, moved);
      return { ...i, images: imgs };
    }));
  }
  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || uploadTargetId.current === null) return;
    const MAX_MB = 10;
    const oversized = files.filter(f => f.size > MAX_MB * 1024 * 1024);
    if (oversized.length) {
      toast.error(
        oversized.length === 1
          ? `"${oversized[0].name}" is too large (${(oversized[0].size / 1024 / 1024).toFixed(1)} MB). Max ${MAX_MB} MB per image.`
          : `${oversized.length} images exceed ${MAX_MB} MB. Please choose smaller files.`
      );
      e.target.value = "";
      return;
    }
    const nonImages = files.filter(f => !f.type.startsWith("image/"));
    if (nonImages.length) {
      toast.error(`"${nonImages[0].name}" is not an image. Only image files are allowed here.`);
      e.target.value = "";
      return;
    }
    try {
      const compressed = await Promise.all(files.map(f => compressImage(f)));
      setItems(p => p.map(i => i.id === uploadTargetId.current
        ? { ...i, images: [...(i.images ?? []), ...compressed] }
        : i));
    } catch { toast.error("Failed to process image."); }
    e.target.value = "";
  }

  function selectDesign(id: string) {
    setDesignId(id);
    setShowDesignPicker(false);
    const lastUsedUpdates = type === "invoice" ? { invoiceDesignId: id } : { quotationDesignId: id };
    updateLastUsed(lastUsedUpdates);
  }

  async function handleSubmit(status: string) {
    if (!customerId) {
      setClientError(true);
      clientFieldRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error("Please select a client.");
      return;
    }
    const emptyItems = items.filter(i => !i.name.trim());
    if (emptyItems.length > 0) {
      const errorIds = new Set(emptyItems.map(i => i.id));
      setItemErrors(errorIds);
      const firstEl = itemRowRefs.current.get(emptyItems[0].id);
      if (firstEl) firstEl.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error("All line items need a description.");
      return;
    }
    setLoading(true);
    const payload: any = {
      issue_date: new Date(issueDate), currency, items, sub_total: subTotal,
      tax: parseFloat(tax || "0"), tax_type: taxType, discount: parseFloat(discount || "0"),
      delivery_charges: parseFloat(delivery || "0"), total_amount: total, remarks,
      customer_id: customerId, customer_name: customer?.name ?? "",
      customer_phone: customer?.phone_no ?? "", customer_address: customer?.address ?? "",
      designId: activeDesign?.id ?? "",
    };
    if (projectId) payload.project_id = projectId;
    // Snapshot current exchange rates on new documents only
    if (!initialData?._id) {
      payload.rateSnapshot = getSnapshot();
    }
    if (type === "invoice") {
      payload.payment_mode = paymentMode; payload.advance = parseFloat(advance || "0");
      payload.outstanding = outstanding; payload.total_paid = parseFloat(advance || "0");
      payload.status = status; if (dueDate) payload.due_date = new Date(dueDate);
    } else {
      payload.status = status; if (dueDate) payload.valid_until = new Date(dueDate);
    }
    try {
      const url = initialData?._id
        ? `/api/${type === "invoice" ? "invoices" : "quotations"}/${initialData._id}`
        : `/api/${type === "invoice" ? "invoices" : "quotations"}`;
      const res = await fetch(url, { method: initialData?._id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(`${type === "invoice" ? "Invoice" : "Quotation"} ${initialData?._id ? "updated" : "created"} successfully.`);
      updateLastUsed({ currency, paymentMethod: paymentMode });
      setSaved(true);
      router.push(type === "invoice" ? `/invoices/${data.data._id}` : `/quotations/${data.data._id}`);
    } catch (err: any) { toast.error(err.message || "Failed to save."); }
    finally { setLoading(false); }
  }

  const typeLabel = type === "invoice" ? "Invoice" : "Quotation";
  const typeColor = type === "invoice" ? "#34d399" : "#818cf8";
  const lbl = { fontSize: 10.5, color: T3, fontWeight: 500, marginBottom: 3 } as const;
  const secTitle = { fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: T3, marginBottom: 10, paddingBottom: 6, borderBottom: `0.5px solid ${GLASS_BORDER}`, display: "flex", alignItems: "center", gap: 7 };

  const PICKER_PREVIEWS: Record<string, { bg: string; text: string }> = {
    "classic-corporate": { bg: "#1a2744", text: "#fff" },
    "modern-gradient": { bg: "linear-gradient(135deg,#6366f1,#8b5cf6)", text: "#fff" },
    "minimal-clean": { bg: "#f8f9fa", text: "#374151" },
    "executive-dark": { bg: "#0f172a", text: "#94a3b8" },
    "bold-accent": { bg: "#fff7ed", text: "#f97316" },
    "retro-serif": { bg: "#faf7f0", text: "#8b4513" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Topbar */}
      <div className="Topbar" style={{ ...TOPBAR_STYLE, flexWrap: isMobile ? "wrap" as const : "nowrap" as const, gap: isMobile ? 6 : undefined }}>
        {/* ── Left: back + title ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          <Link href={type === "invoice" ? "/invoices" : "/quotations"}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: isMobile ? "0" : "5px 11px", width: isMobile ? 30 : undefined, height: isMobile ? 30 : undefined, justifyContent: isMobile ? "center" as const : undefined, borderRadius: 100, background: GLASS, border: `0.5px solid ${GLASS_BORDER}`, color: T2, fontSize: 11.5, cursor: "pointer", textDecoration: "none", transition: "all 0.15s", flexShrink: 0 }}
            onClick={(e) => {
              if (isDirty) {
                e.preventDefault();
                setLeaveHref(type === "invoice" ? "/invoices" : "/quotations");
                setShowLeaveDialog(true);
              }
            }}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M8 2L4 6l4 4" /></svg>
            {!isMobile && (type === "invoice" ? "Invoices" : "Quotations")}
          </Link>
          <div style={{ fontSize: 14, fontWeight: 600, color: T1, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{initialData?._id ? `Edit ${typeLabel}` : `New ${typeLabel}`}</div>
          {!isMobile && <span style={{ padding: "3px 10px", borderRadius: 100, fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", background: type === "invoice" ? "rgba(52,211,153,0.15)" : "rgba(99,102,241,0.15)", color: typeColor, border: `0.5px solid ${type === "invoice" ? "rgba(52,211,153,0.3)" : "rgba(99,102,241,0.3)"}`, flexShrink: 0 }}>
            {typeLabel.toUpperCase()}
          </span>}
        </div>

        {/* ── Right: actions ── */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", ...(isMobile ? { width: "100%" } : {}) }}>

          {/* Icon button cluster */}
          <div style={{ display: "flex", gap: 4, alignItems: "center", background: GLASS, border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 100, padding: "2px 4px" }}>
            {/* Design picker */}
            <div style={{ position: "relative" }} ref={designPickerRef}>
              <button
                onClick={() => setShowDesignPicker(v => !v)}
                title={`Design: ${activeDesign?.name ?? "Modern Gradient"}`}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: isMobile ? "0" : "4px 9px", width: isMobile ? 26 : undefined, height: 26, justifyContent: isMobile ? "center" as const : undefined, borderRadius: 100, background: showDesignPicker ? "rgba(99,102,241,0.2)" : "transparent", border: "none", color: showDesignPicker ? AC2 : T2, fontSize: 11, cursor: "pointer", transition: "all 0.15s", flexShrink: 0 }}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="5" height="5" rx="1" /><rect x="9" y="2" width="5" height="5" rx="1" /><rect x="2" y="9" width="5" height="5" rx="1" /><rect x="9" y="9" width="5" height="5" rx="1" /></svg>
                {!isMobile && <>Design: {activeDesign?.name ?? "Modern Gradient"}<svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.6, marginLeft: 2 }}><path d="M2 3.5L5 6.5l3-3" /></svg></>}
              </button>
              {showDesignPicker && (
                <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 200, background: "var(--glass-surface-bg)", border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 10, backdropFilter: "blur(24px)", padding: 8, width: 284, boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }}>
                  <div style={{ fontSize: 9.5, color: T3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", padding: "4px 6px 8px" }}>Select Design</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                    {allDesigns.map(d => {
                      const preset = d.config.preset ?? "modern-gradient";
                      const meta = PICKER_PREVIEWS[preset] ?? PICKER_PREVIEWS["modern-gradient"];
                      const isActive = activeDesign?.id === d.id;
                      return (
                        <button key={d.id} onClick={() => selectDesign(d.id)}
                          style={{ border: `1px solid ${isActive ? "#818cf8" : GLASS_BORDER}`, borderRadius: 6, overflow: "hidden", cursor: "pointer", background: isActive ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.03)", transition: "all 0.15s", padding: 0, textAlign: "left" }}
                        >
                          <div style={{ height: 32, background: meta.bg, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 7px" }}>
                            <span style={{ fontSize: 7, fontWeight: 700, color: meta.text }}>Co.</span>
                            <span style={{ fontSize: 8, fontWeight: 800, color: meta.text }}>INV</span>
                          </div>
                          <div style={{ padding: "4px 7px 5px" }}>
                            <div style={{ fontSize: 9.5, fontWeight: 500, color: T1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</div>
                            {isActive && <div style={{ fontSize: 8, color: AC2 }}>Active</div>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <Link href="/settings/document-design" style={{ display: "block", textAlign: "center", fontSize: 10, color: T3, marginTop: 8, padding: "5px 0", borderTop: `0.5px solid ${GLASS_BORDER}`, textDecoration: "none" }}>
                    Manage designs →
                  </Link>
                </div>
              )}
            </div>

            {/* Preview toggle */}
            {isMobile ? (
              <button onClick={() => setShowPreviewSheet(true)} title="Preview" style={{ width: 26, height: 26, borderRadius: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", color: T2, cursor: "pointer", transition: "all 0.15s" }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="3" /><path d="M1.5 8C3 4 5 2 8 2s5 2 6.5 6c-1.5 4-3.5 6-6.5 6s-5-2-6.5-6z" /></svg>
              </button>
            ) : (
              <button onClick={() => setShowPreview(v => !v)} title={showPreview ? "Hide preview" : "Show preview"} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 9px", height: 26, borderRadius: 100, background: showPreview ? "rgba(99,102,241,0.2)" : "transparent", border: "none", color: showPreview ? AC2 : T2, fontSize: 11, cursor: "pointer", transition: "all 0.15s" }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="3" /><path d="M1.5 8C3 4 5 2 8 2s5 2 6.5 6c-1.5 4-3.5 6-6.5 6s-5-2-6.5-6z" /></svg>
                {showPreview ? "Hide" : "Preview"}
              </button>
            )}
          </div>

          {/* CTA buttons */}
          {type === "invoice" ? (
            initialData?._id && initialData?.status !== "draft" ? (
              <Button loading={loading} onClick={() => handleSubmit(initialData.status)} style={isMobile ? { flex: 1 } : undefined}>Update Invoice</Button>
            ) : isMobile ? (
              <>
                <Button loading={loading} onClick={() => handleSubmit("issued")} style={{ flex: 1 }}>Issue Invoice</Button>
                {/* ··· more menu */}
                <div style={{ position: "relative" }} ref={moreMenuRef}>
                  <button onClick={() => setShowMoreMenu(v => !v)} title="More actions"
                    style={{ width: 30, height: 30, borderRadius: 100, display: "flex", alignItems: "center", justifyContent: "center", background: showMoreMenu ? "rgba(255,255,255,0.1)" : GLASS, border: `0.5px solid ${showMoreMenu ? "rgba(255,255,255,0.2)" : GLASS_BORDER}`, color: T2, cursor: "pointer", transition: "all 0.15s", flexShrink: 0 }}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><circle cx="3" cy="8" r="1.3" /><circle cx="8" cy="8" r="1.3" /><circle cx="13" cy="8" r="1.3" /></svg>
                  </button>
                  {showMoreMenu && (
                    <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 200, background: "var(--glass-surface-bg)", border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 8, backdropFilter: "blur(24px)", padding: 4, minWidth: 140, boxShadow: "0 8px 32px rgba(0,0,0,0.45)" }}>
                      <button onClick={() => { handleSubmit("draft"); setShowMoreMenu(false); }}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 5, background: "transparent", border: "none", color: T2, fontSize: 12, cursor: "pointer", transition: "background 0.15s", textAlign: "left" as const }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 10V13h3l7-7-3-3-7 7z" /><path d="M11 3l2 2" /></svg>
                        Save as Draft
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Button variant="secondary" loading={loading} onClick={() => handleSubmit("draft")}>Save as Draft</Button>
                <Button loading={loading} onClick={() => handleSubmit("issued")}>Issue Invoice</Button>
              </>
            )
          ) : initialData?._id && initialData?.status !== "draft" ? (
            <Button loading={loading} onClick={() => handleSubmit(initialData.status)} style={isMobile ? { flex: 1 } : undefined}>Update Quotation</Button>
          ) : isMobile ? (
            <>
              <Button loading={loading} onClick={() => handleSubmit("pending")} style={{ flex: 1 }}>
                {initialData?._id ? "Update Quotation" : "Send Quotation"}
              </Button>
              <div style={{ position: "relative" }} ref={moreMenuRef}>
                <button onClick={() => setShowMoreMenu(v => !v)} title="More actions"
                  style={{ width: 30, height: 30, borderRadius: 100, display: "flex", alignItems: "center", justifyContent: "center", background: showMoreMenu ? "rgba(255,255,255,0.1)" : GLASS, border: `0.5px solid ${showMoreMenu ? "rgba(255,255,255,0.2)" : GLASS_BORDER}`, color: T2, cursor: "pointer", transition: "all 0.15s", flexShrink: 0 }}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><circle cx="3" cy="8" r="1.3" /><circle cx="8" cy="8" r="1.3" /><circle cx="13" cy="8" r="1.3" /></svg>
                </button>
                {showMoreMenu && (
                  <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 200, background: "var(--glass-surface-bg)", border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 8, backdropFilter: "blur(24px)", padding: 4, minWidth: 140, boxShadow: "0 8px 32px rgba(0,0,0,0.45)" }}>
                    <button onClick={() => { handleSubmit("draft"); setShowMoreMenu(false); }}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 5, background: "transparent", border: "none", color: T2, fontSize: 12, cursor: "pointer", transition: "background 0.15s", textAlign: "left" as const }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 10V13h3l7-7-3-3-7 7z" /><path d="M11 3l2 2" /></svg>
                      Save as Draft
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Button variant="secondary" loading={loading} onClick={() => handleSubmit("draft")}>Save as Draft</Button>
              <Button loading={loading} onClick={() => handleSubmit("pending")}>
                {initialData?._id ? "Update Quotation" : "Send Quotation"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Builder body */}
      <div ref={bodyRef} style={{ display: "flex", flex: 1, overflow: "hidden", flexDirection: isMobile ? "column" as const : "row" }}>
        {/* Left: form */}
        <div style={{ width: isMobile ? undefined : showPreview ? `${splitPct}%` : "100%", flex: isMobile ? 1 : undefined, flexShrink: isMobile ? undefined : 0, minHeight: 0, borderRight: (!isMobile && showPreview) ? `0.5px solid ${GLASS_BORDER}` : "none", overflowY: "auto", background: "var(--glass-surface-bg)" }}>

          {/* Client & dates */}
          <div style={{ padding: "14px 16px 0" }}>
            <div style={secTitle}>Client & details</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
              <div ref={clientFieldRef}>
                <div style={{ ...lbl, color: clientError ? "#f87171" : undefined }}>Client *</div>
                <div style={{ position: "relative" }} ref={clientDropRef}>
                  {customerId && (customers as Customer[]).find(c => c._id === customerId) ? (
                    /* Selected state: show chip */
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "rgba(255,255,255,0.06)", border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 7 }} onClick={() => setClientError(false)}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: T1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {(customers as Customer[]).find(c => c._id === customerId)?.name}
                        </div>
                        {(customers as Customer[]).find(c => c._id === customerId)?.phone_no && (
                          <div style={{ fontSize: 10, color: T3 }}>{(customers as Customer[]).find(c => c._id === customerId)?.phone_no}</div>
                        )}
                      </div>
                      <button onClick={() => { setCustomerId(""); setClientSearch(""); setShowClientDrop(true); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: T3, padding: 2, display: "flex", flexShrink: 0 }}>
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3l10 10M13 3L3 13" /></svg>
                      </button>
                    </div>
                  ) : (
                    /* Search input */
                    <div style={{ position: "relative" }}>
                      <svg style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: T3, zIndex: 1 }} width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="7" cy="7" r="4.5" /><path d="M11 11l3 3" />
                      </svg>
                      <Input
                        type="text"
                        value={clientSearch}
                        onChange={e => { setClientSearch(e.target.value); setShowClientDrop(true); if (e.target.value) setClientError(false); }}
                        onFocus={() => setShowClientDrop(true)}
                        placeholder="Search clients..."
                        className="h-8 text-xs"
                        style={{ paddingLeft: 28, ...(clientError ? { borderColor: "rgba(248,113,113,0.75)", boxShadow: "0 0 0 2px rgba(248,113,113,0.18)" } : {}) }}
                      />
                    </div>
                  )}
                  {/* Dropdown */}
                  {showClientDrop && !customerId && (
                    <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 30, background: "var(--glass-surface-bg)", border: `0.5px solid ${GLASS_BORDER}`, borderRadius: 8, backdropFilter: "blur(24px)", overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", maxHeight: 220, overflowY: "auto" }}>
                      {filteredCustomers.slice(0, 20).map(c => (
                        <button key={c._id}
                          onClick={() => { setCustomerId(c._id); setClientSearch(c.name); setShowClientDrop(false); setClientError(false); }}
                          style={{ width: "100%", padding: "8px 12px", textAlign: "left", background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", gap: 1, borderBottom: `0.5px solid rgba(255,255,255,0.04)` }}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(99,102,241,0.1)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "none")}
                        >
                          <span style={{ fontSize: 12, color: T1, fontWeight: 500 }}>{c.name}</span>
                          {(c.company || c.phone_no) && <span style={{ fontSize: 10, color: T3 }}>{[c.company, c.phone_no].filter(Boolean).join(" · ")}</span>}
                        </button>
                      ))}
                      {filteredCustomers.length === 0 && clientSearch && (
                        <div style={{ padding: "10px 12px", fontSize: 11, color: T3 }}>No results for "{clientSearch}"</div>
                      )}
                      <button
                        onClick={() => { setShowClientDrop(false); setCreateForm(p => ({ ...p, name: clientSearch })); setShowCreateClient(true); }}
                        style={{ width: "100%", padding: "8px 12px", textAlign: "left", background: "rgba(52,211,153,0.06)", border: "none", borderTop: filteredCustomers.length > 0 ? `0.5px solid rgba(255,255,255,0.06)` : "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#34d399", fontSize: 11 }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(52,211,153,0.14)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "rgba(52,211,153,0.06)")}
                      >
                        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 2v12M2 8h12" /></svg>
                        {clientSearch ? `Create "${clientSearch}"` : "Create new client"}
                      </button>
                    </div>
                  )}
                </div>
                {clientError && (
                  <div style={{ fontSize: 10, color: "#f87171", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3.5c.4 0 .7.3.7.7v3.6c0 .4-.3.7-.7.7s-.7-.3-.7-.7V5.2c0-.4.3-.7.7-.7zm0 6.5a.8.8 0 110-1.6.8.8 0 010 1.6z"/></svg>
                    Client is required
                  </div>
                )}
              </div>
              {/* Project (optional) */}
              <div>
                <div style={lbl}>
                  Project <span style={{ opacity: 0.45, fontSize: 9.5, fontWeight: 400 }}>(optional)</span>
                </div>
                <Select value={projectId || "_none"} onValueChange={v => setProjectId(v === "_none" ? "" : v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="No project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">No project</SelectItem>
                    {(projects as Project[]).map(p => (
                      <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <div style={lbl}>{type === "invoice" ? "Issue date" : "Date"}</div>
                  <DatePickerInput value={issueDate} onChange={setIssueDate} />
                </div>
                <div>
                  <div style={lbl}>{type === "invoice" ? "Due date" : "Valid until"}</div>
                  <DatePickerInput value={dueDate} onChange={setDueDate} placeholder="Optional" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <div style={lbl}>Currency</div>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(settings?.enabledCurrencies?.length ? settings.enabledCurrencies : ["PKR", "USD", "EUR", "GBP", "AED", "SAR"]).map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {type === "invoice" && (
                  <div>
                    <div style={lbl}>Payment method</div>
                    <Select value={paymentMode} onValueChange={setPaymentMode}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[["cash", "Cash"], ["bank_transfer", "Bank transfer"], ["card", "Card / POS"], ["online", "Online"], ["cheque", "Cheque"]].map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Services quick-add */}
          {(services as Service[]).length > 0 && (
            <div style={{ padding: "10px 16px 0" }}>
              <div style={secTitle}>Quick-add from catalog</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 2, marginBottom: 4 }}>
                {(services as Service[]).slice(0, 12).map(s => (
                  <button key={s._id}
                    onClick={() => setItems(p => [...p, { id: Date.now(), name: s.name, quantity: 1, price: s.default_price }])}
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 11px", background: "rgba(99,102,241,0.11)", border: "0.5px solid rgba(99,102,241,0.22)", color: AC2, borderRadius: 100, fontSize: 11, cursor: "pointer", transition: "all 0.15s", margin: 2 }}
                    onMouseEnter={e => Object.assign((e.target as HTMLElement).style, { background: "rgba(99,102,241,0.22)", transform: "scale(1.02)" })}
                    onMouseLeave={e => Object.assign((e.target as HTMLElement).style, { background: "rgba(99,102,241,0.11)", transform: "none" })}
                  >+ {s.name}</button>
                ))}
              </div>
            </div>
          )}

          {/* Line items */}
          <div style={{ padding: "10px 16px 0" }}>
            <div style={secTitle}>Line items</div>
            {/* hidden file input for image attachment */}
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageFile} style={{ display: "none" }} />

            {isMobile ? (
              /* ── Mobile: card per item ── */
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                {items.map((item, idx) => (
                  <div key={item.id} ref={(el) => { if (el) itemRowRefs.current.set(item.id, el); else itemRowRefs.current.delete(item.id); }}>
                    <MobileItemCard
                      item={item}
                      idx={idx}
                      currency={currency}
                      disableRemove={items.length === 1}
                      hasError={itemErrors.has(item.id)}
                      onUpdate={updateItem}
                      onRemove={removeItem}
                      onDuplicate={duplicateItem}
                      onImageDialog={setImageDialogItemId}
                      onImageUpload={triggerImageUpload}
                      onClearError={() => clearItemError(item.id)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              /* ── Desktop: table header + rows ── */
              <>
                <div style={{ display: "grid", gridTemplateColumns: "18px 3fr 60px 90px 78px 48px", gap: 4, padding: "5px 10px", fontSize: 9, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: T3, background: "rgba(255,255,255,0.025)", borderBottom: `0.5px solid ${GLASS_BORDER}` }}>
                  <span /><span>Description</span>
                  <span style={{ textAlign: "center" }}>Qty</span>
                  <span style={{ textAlign: "right" }}>Price</span>
                  <span style={{ textAlign: "right" }}>Total</span>
                  <span />
                </div>
                {items.map((item, idx) => (
                  <div key={item.id}
                    ref={(el) => { if (el) itemRowRefs.current.set(item.id, el); else itemRowRefs.current.delete(item.id); }}
                    draggable
                    onDragStart={() => setDragIdx(idx)}
                    onDragOver={e => { e.preventDefault(); setDragOverIdx(idx); }}
                    onDrop={() => { reorderItems(dragIdx!, idx); setDragIdx(null); setDragOverIdx(null); }}
                    onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                    style={{
                      display: "grid", gridTemplateColumns: "18px 3fr 60px 90px 78px 48px", gap: 4, padding: "6px 10px",
                      borderBottom: `0.5px solid rgba(255,255,255,0.04)`, alignItems: "center",
                      background: dragOverIdx === idx && dragIdx !== idx ? "rgba(99,102,241,0.12)" : dragIdx === idx ? "rgba(99,102,241,0.06)" : "transparent",
                      opacity: dragIdx === idx ? 0.55 : 1, transition: "background 0.1s",
                    }}
                  >
                    <div style={{ cursor: "grab", display: "flex", alignItems: "center", justifyContent: "center", color: T3, opacity: 0.4, userSelect: "none" as const }}>
                      <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
                        <circle cx="3" cy="2" r="1.2" /><circle cx="7" cy="2" r="1.2" />
                        <circle cx="3" cy="7" r="1.2" /><circle cx="7" cy="7" r="1.2" />
                        <circle cx="3" cy="12" r="1.2" /><circle cx="7" cy="12" r="1.2" />
                      </svg>
                    </div>
                    <div style={{ position: "relative" }}>
                      <Input draggable={false} value={item.name} onChange={e => updateItem(item.id, "name", e.target.value)} placeholder="Service or item" className="h-8 text-xs pr-8" style={itemErrors.has(item.id) ? { borderColor: "rgba(248,113,113,0.75)", boxShadow: "0 0 0 2px rgba(248,113,113,0.18)" } : undefined} />
                      {item.images?.length ? (
                        <button onClick={() => setImageDialogItemId(item.id)} title={`${item.images.length} image(s) — click to manage`}
                          style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                          <div style={{ position: "relative" }}>
                            <img src={item.images[0]} style={{ width: 20, height: 20, objectFit: "cover", borderRadius: 3, border: "0.5px solid rgba(99,102,241,0.5)", display: "block" }} />
                            {item.images.length > 1 && <span style={{ position: "absolute", top: -4, right: -4, background: "#6366f1", color: "#fff", fontSize: 7, width: 11, height: 11, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{item.images.length}</span>}
                          </div>
                        </button>
                      ) : (
                        <button onClick={() => triggerImageUpload(item.id)} title="Attach image"
                          style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T3, padding: 1, display: "flex", opacity: 0.4 }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                          onMouseLeave={e => (e.currentTarget.style.opacity = "0.4")}
                        >
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1" y="3" width="14" height="10" rx="1.5" /><circle cx="5.5" cy="8" r="1.8" /><path d="M9 5.5l2.5 3.5-3 4.5" strokeLinejoin="round" /></svg>
                        </button>
                      )}
                    </div>
                    <Input draggable={false} type="number" min="0" value={item.quantity} onChange={e => updateItem(item.id, "quantity", e.target.value)} className="h-8 text-xs text-center" />
                    <Input draggable={false} type="number" min="0" value={item.price} onChange={e => updateItem(item.id, "price", e.target.value)} className="h-8 text-xs text-right" />
                    <span style={{ fontSize: 12, fontWeight: 500, color: T1, textAlign: "right" }}>{formatCurrency(item.quantity * item.price, currency)}</span>
                    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                      <button onClick={() => duplicateItem(item.id)} title="Duplicate"
                        style={{ width: 20, height: 20, borderRadius: 4, background: "none", border: "none", cursor: "pointer", color: T3, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, opacity: 0.5 }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = "#818cf8"; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = "0.5"; e.currentTarget.style.color = T3; }}>
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="5" y="5" width="8" height="8" rx="1.5" /><path d="M3 11V3h8" /></svg>
                      </button>
                      <button onClick={() => removeItem(item.id)} disabled={items.length === 1} title="Remove"
                        style={{ width: 20, height: 20, borderRadius: 4, background: "none", border: "none", cursor: items.length === 1 ? "default" : "pointer", color: items.length === 1 ? "rgba(255,255,255,0.12)" : T3, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                        <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 3l10 10M13 3L3 13" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
            {/* Add row */}
            <div style={{ padding: "7px 10px", borderBottom: `0.5px solid ${GLASS_BORDER}` }}>
              <button onClick={addItem}
                style={{ fontSize: 11, color: AC2, background: "rgba(99,102,241,0.09)", border: `0.5px solid rgba(99,102,241,0.2)`, padding: "5px 14px", borderRadius: 100, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(99,102,241,0.18)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(99,102,241,0.09)")}
              >
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M8 2v12M2 8h12" /></svg>
                Add row
              </button>
            </div>
            {/* Totals */}
            <div style={{ padding: "12px 16px", borderTop: `0.5px solid ${GLASS_BORDER}`, background: "rgba(255,255,255,0.02)", display: "flex", flexDirection: "column", gap: 4 }}>
              {/* Adjustment inputs */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8, paddingBottom: 10, borderBottom: `0.5px solid ${GLASS_BORDER}` }}>
                <div>
                  <div style={lbl}>Tax</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <Input type="number" min="0" value={tax} onChange={e => setTax(e.target.value)} placeholder="0" className="h-8 text-[11px]" style={{ flex: 1 }} />
                    <button onClick={() => setTaxType(t => t === "percentage" ? "value" : "percentage")}
                      style={{ padding: "4px 7px", borderRadius: 6, border: `0.5px solid ${GLASS_BORDER}`, background: "var(--glass)", color: T2, fontSize: 10, cursor: "pointer", flexShrink: 0, fontWeight: 600 }}>
                      {taxType === "percentage" ? "%" : "fix"}
                    </button>
                  </div>
                </div>
                <div>
                  <div style={lbl}>Discount</div>
                  <Input type="number" min="0" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0" className="h-8 text-[11px]" />
                </div>
                <div>
                  <div style={lbl}>Delivery</div>
                  <Input type="number" min="0" value={delivery} onChange={e => setDelivery(e.target.value)} placeholder="0" className="h-8 text-[11px]" />
                </div>
              </div>
              {hasPriceChanged && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "7px 10px", borderRadius: 8, marginBottom: 8,
                  background: "rgba(251,191,36,0.08)", border: "0.5px solid rgba(251,191,36,0.3)",
                  fontSize: 11, color: "#fbbf24",
                }}>
                  <TriangleAlert size={13} style={{ flexShrink: 0 }} />
                  Prices changed from saved version. Save to update the document.
                </div>
              )}
              {[
                { label: "Subtotal", val: formatCurrency(subTotal, currency), color: T2 },
                ...(parseFloat(tax) > 0 ? [{ label: `Tax (${tax}${taxType === "percentage" ? "%" : " fixed"})`, val: formatCurrency(taxAmt, currency), color: T2 }] : []),
                ...(parseFloat(discount) > 0 ? [{ label: "Discount", val: `-${formatCurrency(parseFloat(discount), currency)}`, color: "#34d399" }] : []),
                ...(parseFloat(delivery) > 0 ? [{ label: "Delivery", val: formatCurrency(parseFloat(delivery), currency), color: T2 }] : []),
              ].map(({ label, val, color }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: T2 }}>
                  <span>{label}</span><span style={{ color }}>{val}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 600, color: T1, borderTop: `0.5px solid ${GLASS_BORDER}`, marginTop: 6, paddingTop: 8 }}>
                <span>Total</span><span style={{ color: AC2 }}>{formatCurrency(total, currency)}</span>
              </div>
              {type === "invoice" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                  <div>
                    <div style={lbl}>Advance received</div>
                    <Input type="number" min="0" value={advance} onChange={e => setAdvance(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div style={{ textAlign: "right", paddingTop: 18 }}>
                    <div style={{ fontSize: 11, color: T3 }}>Outstanding</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: outstanding === 0 ? "#34d399" : "#fbbf24" }}>{formatCurrency(outstanding, currency)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Remarks */}
          <div style={{ padding: "10px 16px 14px" }}>
            <div style={secTitle}>Remarks / notes</div>
            <Textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={3} placeholder="Any additional notes..." className="resize-none text-[11px] min-h-[68px]" />
          </div>
        </div>

        {/* Draggable divider */}
        {showPreview && !isMobile && (
          <div
            onMouseDown={onDividerMouseDown}
            style={{ width: 5, flexShrink: 0, cursor: "col-resize", background: "transparent", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}
          >
            <div style={{ width: 3, height: 40, borderRadius: 2, background: GLASS_BORDER, transition: "background 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(99,102,241,0.5)")}
              onMouseLeave={e => (e.currentTarget.style.background = GLASS_BORDER)}
            />
          </div>
        )}

        {/* Right: live document preview */}
        {showPreview && (
          <div style={{ flex: isMobile ? undefined : 1, height: isMobile ? "60vh" : undefined, flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: "rgba(8,11,22,0.5)" }}>
            <div style={{ padding: "8px 12px", borderBottom: `0.5px solid ${GLASS_BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(13,17,32,0.5)", flexShrink: 0, gap: 8, flexWrap: "wrap" as const }}>
              <span style={{ fontSize: 10, fontWeight: 500, color: T3, textTransform: "uppercase", letterSpacing: "0.07em" }}>Live preview</span>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                {/* Page size */}
                <Select value={pageSize} onValueChange={v => setPageSize(v as any)}>
                  <SelectTrigger className="h-7 text-[10px] rounded-full w-[72px] px-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a4">A4</SelectItem>
                    <SelectItem value="a5">A5</SelectItem>
                    <SelectItem value="letter">Letter</SelectItem>
                    <SelectItem value="legal">Legal</SelectItem>
                  </SelectContent>
                </Select>
                {/* Orientation toggle */}
                <button
                  onClick={() => setOrientation(o => o === "portrait" ? "landscape" : "portrait")}
                  title={orientation === "portrait" ? "Switch to landscape" : "Switch to portrait"}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 100, background: GLASS, border: `0.5px solid ${GLASS_BORDER}`, color: T2, cursor: "pointer" }}
                >
                  {orientation === "portrait"
                    ? <svg width="11" height="13" viewBox="0 0 11 13" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1" y="1" width="9" height="11" rx="1" /></svg>
                    : <svg width="13" height="11" viewBox="0 0 13 11" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1" y="1" width="11" height="9" rx="1" /></svg>
                  }
                </button>
                <span style={{ fontSize: 10, color: T3 }}>{activeDesign?.name ?? "Modern Gradient"}</span>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 18, display: "flex", justifyContent: "center" }}>
              <LivePreview
                design={activeDesign}
                type={type}
                items={items}
                customer={customer}
                issueDate={issueDate}
                dueDate={dueDate}
                currency={currency}
                subTotal={subTotal}
                taxAmt={taxAmt}
                taxLabel={`Tax (${tax}${taxType === "percentage" ? "%" : " fixed"})`}
                discount={parseFloat(discount || "0")}
                delivery={parseFloat(delivery || "0")}
                total={total}
                advance={parseFloat(advance || "0")}
                outstanding={outstanding}
                remarks={remarks}
                settings={settings}
                pageHeight={pageHeight}
              />
            </div>
          </div>
        )}
      </div>
      {/* Mobile preview bottom drawer */}
      {showPreviewSheet && (
        <>
          <style>{`
            @keyframes drawerSlideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
            @keyframes drawerSlideDown { from { transform: translateY(0) } to { transform: translateY(100%) } }
            @keyframes drawerFadeIn { from { opacity: 0 } to { opacity: 1 } }
            @keyframes drawerFadeOut { from { opacity: 1 } to { opacity: 0 } }
          `}</style>
          <div
            onClick={closeDrawer}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 50, backdropFilter: "blur(2px)",
              animation: drawerClosing ? "drawerFadeOut 0.32s ease forwards" : "drawerFadeIn 0.25s ease forwards",
            }}
          />
          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 51,
            height: "88vh",
            background: "rgba(8,11,22,0.99)",
            border: `0.5px solid ${GLASS_BORDER}`,
            borderBottom: "none",
            borderRadius: "16px 16px 0 0",
            display: "flex", flexDirection: "column",
            boxShadow: "0 -12px 48px rgba(0,0,0,0.7)",
            animation: drawerClosing
              ? "drawerSlideDown 0.32s cubic-bezier(0.32,0.72,0,1) forwards"
              : "drawerSlideUp 0.38s cubic-bezier(0.32,0.72,0,1) forwards",
          }}>
            {/* Drag handle */}
            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 6px", flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)" }} />
            </div>
            {/* Header */}
            <div style={{ padding: "0 16px 12px", borderBottom: `0.5px solid ${GLASS_BORDER}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: T1 }}>Live Preview</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Select value={pageSize} onValueChange={v => setPageSize(v as any)}>
                  <SelectTrigger className="h-7 text-[10px] rounded-full w-[72px] px-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a4">A4</SelectItem>
                    <SelectItem value="a5">A5</SelectItem>
                    <SelectItem value="letter">Letter</SelectItem>
                    <SelectItem value="legal">Legal</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  onClick={() => setOrientation(o => o === "portrait" ? "landscape" : "portrait")}
                  title={orientation === "portrait" ? "Switch to landscape" : "Switch to portrait"}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 100, background: GLASS, border: `0.5px solid ${GLASS_BORDER}`, color: T2, cursor: "pointer" }}
                >
                  {orientation === "portrait"
                    ? <svg width="11" height="13" viewBox="0 0 11 13" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1" y="1" width="9" height="11" rx="1" /></svg>
                    : <svg width="13" height="11" viewBox="0 0 13 11" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1" y="1" width="11" height="9" rx="1" /></svg>
                  }
                </button>
                <button
                  onClick={closeDrawer}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 100, background: GLASS, border: `0.5px solid ${GLASS_BORDER}`, color: T2, cursor: "pointer" }}
                >
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3l10 10M13 3L3 13" /></svg>
                </button>
              </div>
            </div>
            {/* Preview content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 12px" }}>
              <LivePreview
                design={activeDesign}
                type={type}
                items={items}
                customer={customer}
                issueDate={issueDate}
                dueDate={dueDate}
                currency={currency}
                subTotal={subTotal}
                taxAmt={taxAmt}
                taxLabel={`Tax (${tax}${taxType === "percentage" ? "%" : " fixed"})`}
                discount={parseFloat(discount || "0")}
                delivery={parseFloat(delivery || "0")}
                total={total}
                advance={parseFloat(advance || "0")}
                outstanding={outstanding}
                remarks={remarks}
                settings={settings}
                pageHeight={pageHeight}
              />
            </div>
          </div>
        </>
      )}

      {/* Image management dialog */}
      <Dialog open={imageDialogItemId !== null} onOpenChange={open => !open && setImageDialogItemId(null)}>
        <DialogContent style={{ maxWidth: 660 }}>
          <DialogHeader>
            <DialogTitle>Images — {items.find(i => i.id === imageDialogItemId)?.name || "Item"}</DialogTitle>
            <DialogDescription>Drag to reorder · first image shown in line item.</DialogDescription>
          </DialogHeader>
          {(() => {
            const item = items.find(i => i.id === imageDialogItemId);
            if (!item) return null;
            const imgs = item.images ?? [];
            return (
              <div>
                {imgs.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: T3, fontSize: 13 }}>No images attached yet</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", rowGap: 12, columnGap: 12, maxHeight: 380, overflowY: "auto", padding: "4px 2px" }}>
                    {imgs.map((img, i) => (
                      <div key={i}
                        draggable
                        onDragStart={() => setImgDragIdx(i)}
                        onDragOver={e => { e.preventDefault(); setImgDragOverIdx(i); }}
                        onDrop={() => { if (imgDragIdx !== null && imgDragIdx !== i) moveImageInItem(item.id, imgDragIdx, i); setImgDragIdx(null); setImgDragOverIdx(null); }}
                        onDragEnd={() => { setImgDragIdx(null); setImgDragOverIdx(null); }}
                        style={{
                          position: "relative", borderRadius: 8, overflow: "hidden", aspectRatio: "1",
                          border: imgDragOverIdx === i && imgDragIdx !== i ? "1.5px solid #6366f1" : `0.5px solid ${GLASS_BORDER}`,
                          opacity: imgDragIdx === i ? 0.45 : 1,
                          cursor: "grab", transition: "opacity 0.15s, border 0.15s",
                          boxShadow: imgDragOverIdx === i && imgDragIdx !== i ? "0 0 0 3px rgba(99,102,241,0.25)" : "none",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.cursor = "grab"; }}
                        onMouseDown={e => { (e.currentTarget as HTMLElement).style.cursor = "grabbing"; }}
                        onMouseUp={e => { (e.currentTarget as HTMLElement).style.cursor = "grab"; }}
                      >
                        <img src={img} draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        {/* Index badge */}
                        <span style={{ position: "absolute", top: 4, left: 4, background: "rgba(0,0,0,0.65)", color: "#fff", fontSize: 8, padding: "1px 5px", borderRadius: 10, fontWeight: 600 }}>{i + 1}</span>
                        {/* Delete button */}
                        <button onClick={() => removeImage(item.id, i)}
                          style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%", background: "rgba(220,38,38,0.85)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                          <svg width="8" height="8" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 3l10 10M13 3L3 13" /></svg>
                        </button>
                        {/* Drag grip dots */}
                        {/* <div style={{ position: "absolute", bottom: 5, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.5)", borderRadius: 4, padding: "3px 6px", display: "flex", flexWrap: "wrap", gap: 2, width: 22, justifyContent: "center" }}>
                          {[0,1,2,3,4,5].map(d => <div key={d} style={{ width: 2.5, height: 2.5, borderRadius: "50%", background: "#fff", opacity: 0.85 }} />)}
                        </div> */}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: T3 }}>{imgs.length} image{imgs.length !== 1 ? "s" : ""} · First shown in line item</span>
                  <Button onClick={() => triggerImageUpload(item.id)}>+ Add images</Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Quick-create client dialog */}
      <Dialog open={showCreateClient} onOpenChange={setShowCreateClient}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New client</DialogTitle>
            <DialogDescription>Add a client and select them for this {type}.</DialogDescription>
          </DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
            <div>
              <div style={lbl}>Name *</div>
              <Input autoFocus value={createForm.name} onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))} placeholder="Full name or business name" className="h-8 text-xs" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <div style={lbl}>Phone</div>
                <Input value={createForm.phone} onChange={e => setCreateForm(p => ({ ...p, phone: e.target.value }))} placeholder="+92..." className="h-8 text-xs" />
              </div>
              <div>
                <div style={lbl}>Company</div>
                <Input value={createForm.company} onChange={e => setCreateForm(p => ({ ...p, company: e.target.value }))} placeholder="Company name" className="h-8 text-xs" />
              </div>
            </div>
            <div>
              <div style={lbl}>Address</div>
              <Input value={createForm.address} onChange={e => setCreateForm(p => ({ ...p, address: e.target.value }))} placeholder="Street, city..." className="h-8 text-xs" />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
            <Button variant="secondary" onClick={() => setShowCreateClient(false)}>Cancel</Button>
            <Button loading={creatingClient} onClick={createAndSelectClient}>Create & select</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unsaved-changes navigation guard */}
      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent style={{ maxWidth: 400 }}>
          <DialogHeader>
            <DialogTitle>Unsaved changes</DialogTitle>
            <DialogDescription>
              You have unsaved changes. Leaving this page will discard them. Do you want to continue?
            </DialogDescription>
          </DialogHeader>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <Button variant="secondary" onClick={() => setShowLeaveDialog(false)}>Stay</Button>
            <Button
              style={{ background: "rgba(248,113,113,0.15)", color: "#f87171", border: "0.5px solid rgba(248,113,113,0.3)" }}
              onClick={() => { setSaved(true); setShowLeaveDialog(false); router.push(leaveHref); }}
            >
              Leave without saving
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Live preview with auto-sizing ───────────────────────────────────────────
function LivePreview({ design, type, items, customer, issueDate, dueDate, currency, subTotal, taxAmt, taxLabel, discount, delivery, total, advance, outstanding, remarks, settings, pageHeight }: any) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState(380);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setPreviewWidth(Math.min(e.contentRect.width - 36, 540));
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const activeDesign = design ?? BUILT_IN_DESIGNS.find(d => d.id === "modern-gradient")!;

  return (
    <div ref={containerRef} style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <div style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.5)", borderRadius: 4, overflow: "hidden" }}>
        <DocumentRenderer
          design={activeDesign}
          width={previewWidth}
          pageHeight={pageHeight ?? 842}
          showPageBreaks
          data={{
            type,
            docNo: "Auto-generated",
            issueDate,
            dueDate: dueDate || undefined,
            customer: customer ? { name: customer.name, phone: customer.phone_no, address: customer.address } : undefined,
            items: items.filter((i: any) => i.name),
            subTotal,
            taxAmt,
            taxLabel,
            discount,
            delivery,
            total,
            advance,
            outstanding,
            currency,
            remarks,
            companyName: settings?.company_name ?? "Your Company",
            companyEmail: settings?.company_email,
            companyPhone: settings?.company_phone,
            companyAddress: settings?.company_address,
            termsText: settings?.terms_and_conditions,
          }}
        />
      </div>
    </div>
  );
}
