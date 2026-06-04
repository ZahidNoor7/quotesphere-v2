import fs from "fs";
import path from "path";

export interface DocPage { slug: string; title: string }
export interface DocSection { title: string; pages: DocPage[] }

/** The full help-center navigation tree. Each page maps to content/docs/<slug>.md */
export const DOC_SECTIONS: DocSection[] = [
  {
    title: "Getting started",
    pages: [
      { slug: "welcome", title: "Welcome to QuoteSphere" },
      { slug: "quick-start", title: "Quick start (5 minutes)" },
      { slug: "dashboard", title: "Your dashboard" },
    ],
  },
  {
    title: "Sales & billing",
    pages: [
      { slug: "clients", title: "Clients" },
      { slug: "quotations", title: "Quotations" },
      { slug: "invoices", title: "Invoices" },
      { slug: "payments", title: "Recording payments" },
      { slug: "expenses", title: "Expenses & bill scanning" },
      { slug: "projects", title: "Projects" },
      { slug: "products-services", title: "Products & services" },
      { slug: "reports", title: "Reports" },
      { slug: "import", title: "Importing from a spreadsheet" },
    ],
  },
  {
    title: "Assistant & messaging",
    pages: [
      { slug: "ai-assistant", title: "The AI assistant" },
      { slug: "messaging", title: "WhatsApp messaging" },
    ],
  },
  {
    title: "Setup & configuration",
    pages: [
      { slug: "setup-email", title: "Set up email" },
      { slug: "setup-reminders", title: "Automatic payment reminders" },
      { slug: "setup-whatsapp", title: "Connect WhatsApp" },
      { slug: "setup-ai", title: "Set up the AI assistant" },
      { slug: "setup-images", title: "Image hosting (Cloudinary)" },
      { slug: "company-settings", title: "Company & document settings" },
      { slug: "team-roles", title: "Team roles & permissions" },
    ],
  },
];

const ALL_PAGES = DOC_SECTIONS.flatMap((s) => s.pages);

export const DEFAULT_SLUG = ALL_PAGES[0].slug;
export const getAllDocSlugs = (): string[] => ALL_PAGES.map((p) => p.slug);
export const findDoc = (slug: string): DocPage | undefined => ALL_PAGES.find((p) => p.slug === slug);

const DOCS_DIR = path.join(process.cwd(), "content", "docs");

/** Read a doc page's markdown from disk. Returns null for an unknown/missing slug. */
export function getDocContent(slug: string): string | null {
  if (!findDoc(slug)) return null;
  try {
    return fs.readFileSync(path.join(DOCS_DIR, `${slug}.md`), "utf8");
  } catch {
    return null;
  }
}

export interface DocIndexEntry { slug: string; title: string; section: string; text: string }

/** Strip markdown to plain text for searching + snippets. */
function toPlainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")          // fenced code blocks
    .replace(/`([^`]+)`/g, "$1")              // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")    // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")  // links → text
    .replace(/^#{1,6}\s+/gm, "")              // heading markers
    .replace(/^\s*[>\-*+]\s+/gm, "")          // quote/bullet markers
    .replace(/[*_~]/g, "")                    // emphasis
    .replace(/\s+/g, " ")                     // collapse whitespace
    .trim();
}

/** Full searchable index of every guide (title + plain-text body). Built server-side. */
export function getDocsIndex(): DocIndexEntry[] {
  return DOC_SECTIONS.flatMap((s) =>
    s.pages.map((p) => ({ slug: p.slug, title: p.title, section: s.title, text: toPlainText(getDocContent(p.slug) ?? "") }))
  );
}
