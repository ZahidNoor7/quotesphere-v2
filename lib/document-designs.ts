import type { DocumentDesign, DocumentDesignConfig } from "@/types";

// ─── Built-in preset IDs ─────────────────────────────────────────────────────
export const PRESET_IDS = [
  "classic-corporate",
  "modern-gradient",
  "minimal-clean",
  "executive-dark",
  "bold-accent",
  "retro-serif",
] as const;
export type PresetId = typeof PRESET_IDS[number];

// ─── Preset default configs ──────────────────────────────────────────────────
export const PRESET_CONFIGS: Record<PresetId, DocumentDesignConfig & { preset: string }> = {
  "classic-corporate": {
    preset: "classic-corporate",
    headerBg: "#1a2744",
    accentColor: "#c8a96e",
    fontFamily: "Georgia, 'Times New Roman', serif",
    tableStyle: "bordered",
    showLogo: true,
    showAddress: true,
    showPhone: true,
    showTax: true,
    showDiscount: true,
    showTerms: true,
    footerText: "",
    watermark: "",
    marginTop: 0,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
  },
  "modern-gradient": {
    preset: "modern-gradient",
    headerBg: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    accentColor: "#6366f1",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    tableStyle: "striped",
    showLogo: true,
    showAddress: true,
    showPhone: true,
    showTax: true,
    showDiscount: true,
    showTerms: true,
    footerText: "",
    watermark: "",
    marginTop: 0,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
  },
  "minimal-clean": {
    preset: "minimal-clean",
    headerBg: "#ffffff",
    accentColor: "#374151",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    tableStyle: "minimal",
    showLogo: true,
    showAddress: true,
    showPhone: true,
    showTax: true,
    showDiscount: true,
    showTerms: false,
    footerText: "",
    watermark: "",
    marginTop: 0,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
  },
  "executive-dark": {
    preset: "executive-dark",
    headerBg: "#0f172a",
    accentColor: "#94a3b8",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    tableStyle: "minimal",
    showLogo: true,
    showAddress: true,
    showPhone: true,
    showTax: true,
    showDiscount: true,
    showTerms: false,
    footerText: "",
    watermark: "",
    marginTop: 0,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
  },
  "bold-accent": {
    preset: "bold-accent",
    headerBg: "#ffffff",
    accentColor: "#f97316",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    tableStyle: "striped",
    showLogo: true,
    showAddress: true,
    showPhone: true,
    showTax: true,
    showDiscount: true,
    showTerms: true,
    footerText: "",
    watermark: "",
    marginTop: 0,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
  },
  "retro-serif": {
    preset: "retro-serif",
    headerBg: "#faf7f0",
    accentColor: "#8b4513",
    fontFamily: "Georgia, 'Times New Roman', serif",
    tableStyle: "bordered",
    showLogo: false,
    showAddress: true,
    showPhone: true,
    showTax: true,
    showDiscount: true,
    showTerms: true,
    footerText: "",
    watermark: "",
    marginTop: 0,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
  },
};

// ─── Built-in designs (not stored in DB, always available) ───────────────────
export const BUILT_IN_DESIGNS: DocumentDesign[] = [
  {
    id: "classic-corporate",
    name: "Classic Corporate",
    type: "all",
    isDefault: false,
    config: PRESET_CONFIGS["classic-corporate"],
  },
  {
    id: "modern-gradient",
    name: "Modern Gradient",
    type: "all",
    isDefault: true, // platform default
    config: PRESET_CONFIGS["modern-gradient"],
  },
  {
    id: "minimal-clean",
    name: "Minimal Clean",
    type: "all",
    isDefault: false,
    config: PRESET_CONFIGS["minimal-clean"],
  },
  {
    id: "executive-dark",
    name: "Executive Dark",
    type: "all",
    isDefault: false,
    config: PRESET_CONFIGS["executive-dark"],
  },
  {
    id: "bold-accent",
    name: "Bold Accent",
    type: "all",
    isDefault: false,
    config: PRESET_CONFIGS["bold-accent"],
  },
  {
    id: "retro-serif",
    name: "Retro Serif",
    type: "all",
    isDefault: false,
    config: PRESET_CONFIGS["retro-serif"],
  },
];

// ─── Utility functions ───────────────────────────────────────────────────────

/** Returns all designs applicable to a doc type (built-ins + user-created). */
export function getAllDesigns(
  userDesigns: DocumentDesign[],
  docType: "invoice" | "quotation" | "receipt"
): DocumentDesign[] {
  const userFiltered = userDesigns.filter(
    d => d.type === docType || d.type === "all"
  );
  return [...BUILT_IN_DESIGNS, ...userFiltered];
}

/** Finds the default design for a given document type. */
export function getDefaultDesign(
  docType: "invoice" | "quotation" | "receipt",
  userDesigns: DocumentDesign[]
): DocumentDesign {
  // First check for a user-set default matching this exact type
  const userDefault = userDesigns.find(
    d => d.isDefault && (d.type === docType || d.type === "all")
  );
  if (userDefault) return userDefault;

  // Fall back to built-in "modern-gradient"
  return BUILT_IN_DESIGNS.find(d => d.id === "modern-gradient")!;
}

/** Finds a design by id from built-ins + user designs. */
export function getDesignById(
  id: string | undefined,
  userDesigns: DocumentDesign[]
): DocumentDesign {
  if (!id) return BUILT_IN_DESIGNS.find(d => d.id === "modern-gradient")!;
  const found = [...BUILT_IN_DESIGNS, ...userDesigns].find(d => d.id === id);
  return found ?? BUILT_IN_DESIGNS.find(d => d.id === "modern-gradient")!;
}

/** Merges a base preset config with user overrides. */
export function resolveConfig(design: DocumentDesign): Required<DocumentDesignConfig> & { preset: string } {
  const preset = (design.config.preset ?? "modern-gradient") as PresetId;
  const base = PRESET_CONFIGS[preset] ?? PRESET_CONFIGS["modern-gradient"];
  return { ...base, ...design.config } as Required<DocumentDesignConfig> & { preset: string };
}

// ─── Labels for UI ───────────────────────────────────────────────────────────
export const PRESET_META: Record<PresetId, { tag: string; headerPreview: string; textPreview: string }> = {
  "classic-corporate": { tag: "Serif · Traditional", headerPreview: "#1a2744", textPreview: "#fff" },
  "modern-gradient":   { tag: "Sans · Contemporary", headerPreview: "linear-gradient(135deg,#6366f1,#8b5cf6)", textPreview: "#fff" },
  "minimal-clean":     { tag: "Sans · Ultra-minimal",  headerPreview: "#f8f9fa", textPreview: "#374151" },
  "executive-dark":    { tag: "Sans · Premium",         headerPreview: "#0f172a", textPreview: "#94a3b8" },
  "bold-accent":       { tag: "Sans · High-impact",     headerPreview: "#fff7ed", textPreview: "#f97316" },
  "retro-serif":       { tag: "Serif · Vintage",        headerPreview: "#faf7f0", textPreview: "#8b4513" },
};
