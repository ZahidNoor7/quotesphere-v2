// Static marketing copy & data for the public landing page. Pure data (no DB,
// no env) so it is safe to import from Server or Client Components.
//
// Honesty rule: every claim here must match what actually ships today. Do NOT
// add deferred features (biometric attendance, payment-gateway checkout,
// self-service payroll portal, bank disbursement) — see the page-level prompt.
import {
  FileText,
  Receipt,
  FolderKanban,
  Users,
  BarChart3,
  Wallet,
  Sparkles,
  Send,
  ShieldCheck,
  KeyRound,
  FileClock,
  Snowflake,
  Building2,
  Banknote,
  type LucideIcon,
} from "lucide-react";

export interface NavLink {
  href: string;
  label: string;
}

export const NAV_LINKS: NavLink[] = [
  { href: "#features", label: "Features" },
  { href: "#security", label: "Security" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export interface TrustItem {
  icon: LucideIcon;
  label: string;
}

export const TRUST_ITEMS: TrustItem[] = [
  { icon: Building2, label: "Bootstrapped & independent" },
  { icon: Banknote, label: "Dual-currency — PKR + USD" },
  { icon: Users, label: "Built for teams, with roles" },
  { icon: ShieldCheck, label: "Strict per-tenant isolation" },
];

export interface FeatureModule {
  icon: LucideIcon;
  title: string;
  blurb: string;
  /** Short accent label for the card header. */
  tag: string;
}

export const FEATURE_MODULES: FeatureModule[] = [
  {
    icon: FileText,
    tag: "Sales",
    title: "Invoicing & quotations",
    blurb:
      "Build polished, multi-line documents with a real tax engine — discount-then-tax-on-net, per-line tax classes, and the tax snapshot frozen at issue time. Convert an accepted quote into an invoice in one click.",
  },
  {
    icon: Receipt,
    tag: "Spend",
    title: "Expenses",
    blurb:
      "Track vendor bills with line items, link them to a customer or project, and keep a clear picture of what you spend against what you bill.",
  },
  {
    icon: FolderKanban,
    tag: "Delivery",
    title: "Projects & time tracking",
    blurb:
      "Run projects with budgets, milestones and progress, and log time against them. Invoices, quotations and expenses all roll up to the project.",
  },
  {
    icon: Users,
    tag: "CRM",
    title: "Customers & services",
    blurb:
      "Keep a tidy book of clients and a reusable catalog of services and products — including bulk CSV/Excel import to get started fast.",
  },
  {
    icon: BarChart3,
    tag: "Insight",
    title: "Reports & dashboards",
    blurb:
      "A live dashboard of revenue, outstanding and top clients, plus receivables-aging and profit-&-loss reports for the numbers that matter.",
  },
  {
    icon: Wallet,
    tag: "People",
    title: "Payroll",
    blurb:
      "Salary structures, pay periods, runs and payslips — with per-tenant tax slabs, EOBI and provident-fund handling, in your own currency. A real differentiator, built in.",
  },
  {
    icon: Sparkles,
    tag: "AI",
    title: "AI assistant",
    blurb:
      "Draft and edit quotations and invoices by chatting. The assistant proposes the change; you confirm before anything is written. Multi-turn and context-aware.",
  },
  {
    icon: Send,
    tag: "Delivery",
    title: "Pixel-perfect document delivery",
    blurb:
      "Generate crisp PDFs with headless Chrome that match the on-screen design exactly — then send them to clients over email or WhatsApp without leaving the app.",
  },
];

export interface SecurityPoint {
  icon: LucideIcon;
  title: string;
  blurb: string;
}

export const SECURITY_POINTS: SecurityPoint[] = [
  {
    icon: ShieldCheck,
    title: "Your data is yours alone",
    blurb:
      "Every record is scoped to your organization at the database layer. The system fails closed — a query with no organization context is rejected, not guessed.",
  },
  {
    icon: KeyRound,
    title: "Roles & permissions",
    blurb:
      "Invite your team as admin, manager, staff or viewer. Role-based access controls who can see and change what, across every module.",
  },
  {
    icon: FileClock,
    title: "Audit logging",
    blurb:
      "Sensitive actions are recorded to an immutable audit trail, so you always have an answer to who changed what, and when.",
  },
  {
    icon: Snowflake,
    title: "Frozen snapshots",
    blurb:
      "Tax rates and currency rates are captured on each document at issue time. Editing your catalog or rates later never silently rewrites history.",
  },
];

export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: "How do I get started?",
    a: "Sign up with your email — no invite needed and no credit card required. You get your own workspace and a 14-day free trial of every feature. After the trial you can continue on the Free plan or upgrade.",
  },
  {
    q: "How is pricing structured?",
    a: "There's a free tier for core quoting and invoicing, and paid tiers that add projects, expenses, reports, payroll and the AI assistant. Every plan is priced in both PKR and USD — switch the toggle on the pricing section to see your currency.",
  },
  {
    q: "Is my data isolated from other businesses?",
    a: "Yes. Every record is tied to your organization and enforced at the data layer, so one business can never see another's data. The system is designed to fail closed rather than ever leak across tenants.",
  },
  {
    q: "Can I work in more than one currency?",
    a: "QuoteSphere is dual-currency by design. Plans and documents support PKR and USD, and each document freezes its exchange rate at issue time so totals never drift after the fact.",
  },
  {
    q: "Which modules are included?",
    a: "Invoicing, quotations, expenses, projects with time tracking, customers, services and products, reports and dashboards, payroll, an AI assistant, and document delivery over email and WhatsApp. Exactly which modules are active depends on your plan.",
  },
  {
    q: "How are documents delivered to clients?",
    a: "Documents render to pixel-perfect PDFs and can be sent directly from the app by email or WhatsApp — the sent file matches the on-screen design exactly.",
  },
];

export const SUPPORT_EMAIL = "support@quotesphere.app";
