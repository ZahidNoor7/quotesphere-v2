export type Currency = "PKR" | "USD" | "EUR" | "GBP" | "AED" | "SAR";
export type PaymentMethod = "cash" | "bank_transfer" | "card" | "online" | "cheque";
export type PaymentStatus = "pending" | "partial" | "complete";
export type InvoiceStatus = "draft" | "issued" | "cancelled";
export type QuotationStatus = "draft" | "pending" | "approved" | "rejected" | "cancelled" | "invoiced" | "expired";
export type ExpenseStatus = "draft" | "recorded" | "verified" | "cancelled";
export type ProjectStatus = "pending" | "in_progress" | "on_hold" | "cancelled" | "complete";
export type UserRole = "admin" | "manager" | "staff" | "viewer";

export interface Customer {
  _id: string;
  name: string;
  phone_no: string;
  email?: string;
  address?: string;
  company?: string;
  tax_id?: string;
  notes?: string;
  status: boolean;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentEntry {
  _id: string;
  date: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  note?: string;
  createdAt: string;
}

export interface InvoiceItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
  images?: string[];
  product_id?: string;
}

export interface Invoice {
  _id: string;
  invoice_no: string;
  issue_date: string;
  due_date?: string;
  status: InvoiceStatus;
  payment_status: PaymentStatus;
  payment_mode: PaymentMethod;
  items: InvoiceItem[];
  sub_total: number;
  tax: number;
  tax_type: "percentage" | "value";
  discount: number;
  delivery_charges: number;
  total_amount: number;
  advance: number;
  balance: number;
  outstanding: number;
  total_paid: number;
  currency: Currency;
  remarks?: string;
  attachments?: string[];
  payments: PaymentEntry[];
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_address?: string;
  project_id?: string;
  converted_from?: string;
  delivery_status: "pending" | "shipped" | "delivered";
  tracking_no?: string;
  designId?: string;
  rateSnapshot?: Record<string, number>;
  recurrence?: {
    frequency?: "weekly" | "monthly" | "quarterly" | "yearly";
    next_date?: string;
    end_date?: string;
    enabled?: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface QuotationItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
  images?: string[];
}

export interface Quotation {
  _id: string;
  quotation_no: string;
  issue_date: string;
  valid_until?: string;
  status: QuotationStatus;
  items: QuotationItem[];
  sub_total: number;
  tax: number;
  tax_type: "percentage" | "value";
  discount: number;
  delivery_charges: number;
  total_amount: number;
  currency: Currency;
  remarks?: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_address?: string;
  project_id?: string;
  converted_to?: string;
  approved_at?: string;
  designId?: string;
  rateSnapshot?: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseItem {
  id: number;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
  category?: string;
}

export interface Expense {
  _id: string;
  expense_no: string;
  bill_date: string;
  vendor_name?: string;
  bill_number?: string;
  status: ExpenseStatus;
  payment_status: "pending" | "paid" | "partial";
  payment_method?: PaymentMethod;
  items: ExpenseItem[];
  sub_total: number;
  tax: number;
  tax_type: "percentage" | "value";
  discount: number;
  total_amount: number;
  currency: Currency;
  notes?: string;
  bill_images: string[];
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  project_id?: string;
  rateSnapshot?: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMilestone {
  _id: string;
  name: string;
  description?: string;
  due_date?: string;
  completed_at?: string;
  invoice_id?: string;
  notes?: string;
  createdAt?: string;
}

export interface ProjectNote {
  _id: string;
  content: string;
  createdAt: string;
}

export interface ProjectAttachment {
  _id: string;
  url: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
}

export interface Project {
  _id: string;
  project_no: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  start_date?: string;
  due_date?: string;
  expected_end_date?: string;
  completed_at?: string;
  budget: number;
  currency: Currency;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  tags?: string[];
  notes?: string;
  milestones?: ProjectMilestone[];
  project_notes?: ProjectNote[];
  attachments?: ProjectAttachment[];
  progress?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Service {
  _id: string;
  name: string;
  description?: string;
  category: string;
  default_price: number;
  currency: Currency;
  unit?: string;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DocTemplateItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
}

export interface DocTemplate {
  _id: string;
  name: string;
  type: "invoice" | "quotation" | "both";
  items: DocTemplateItem[];
  tax: number;
  tax_type: "percentage" | "value";
  discount: number;
  delivery_charges: number;
  currency: string;
  remarks?: string;
  payment_mode?: string;
  designId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  _id: string;
  name: string;
  sku?: string;
  description?: string;
  category: string;
  unit: string;
  default_price: number;
  currency: Currency;
  stock_qty: number;
  low_stock_threshold: number;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AppearanceSettings {
  themeId: string;
  sidebarCollapsed: boolean;
  accentColor: string;
  density: "comfortable" | "compact";
}

export interface LastUsedSettings {
  currency: string;
  paymentMethod: string;
  invoiceDesignId?: string;
  quotationDesignId?: string;
  receiptDesignId?: string;
}

export interface DocumentDesignConfig {
  preset?: string; headerBg?: string; accentColor?: string; fontFamily?: string;
  showLogo?: boolean; showAddress?: boolean; showPhone?: boolean; tableStyle?: string;
  showTax?: boolean; showDiscount?: boolean; showTerms?: boolean;
  footerText?: string; watermark?: string;
  marginTop?: number; marginRight?: number; marginBottom?: number; marginLeft?: number;
  // Header
  headerEnabled?: boolean;
  headerVisibility?: "all" | "first" | "last" | "first-last";
  headerTextColor?: string;
  logoUrl?: string;
  // Footer
  footerEnabled?: boolean;
  footerVisibility?: "all" | "first" | "last" | "first-last";
  showPageNumber?: boolean;
  footerBg?: string;
  footerTextColor?: string;
  // Page
  pageSize?: "A4" | "A5" | "Letter" | "Legal";
  pageOrientation?: "portrait" | "landscape";
  // Content
  termsPosition?: "start" | "end" | "every" | "first-last" | "start-every" | "end-every";
  termsFormat?: "paragraph" | "bullet" | "numbered";
  termsText?: string;
  contentGap?: number;
}

export interface DocumentDesign {
  id: string;
  name: string;
  type: "invoice" | "quotation" | "receipt" | "all";
  isDefault: boolean;
  config: DocumentDesignConfig;
}

export interface CurrencyRates {
  base: string;
  rates: Record<string, number>;
  thresholds: Record<string, number>;
  lastUpdated: string | null;
}

export interface SocialLinks {
  website?: string;
  facebook?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  youtube?: string;
  tiktok?: string;
  whatsapp?: string;
}

export interface IntegrationConfig {
  enabled: boolean;
  cloudName?: string;
  apiKey?: string;
  apiSecret?: string;
  clientId?: string;
  clientSecret?: string;
  provider?: string;
  uri?: string;
}

export interface WhatsAppConfig {
  enabled: boolean;
  mode: "sandbox" | "production";
  apiKey?: string;
  phoneNumber?: string;
  webhookBaseUrl?: string;
}

export interface Integrations {
  cloudinary?: IntegrationConfig;
  googleAuth?: IntegrationConfig;
  currencyApi?: IntegrationConfig;
  mongodb?: IntegrationConfig;
  whatsapp?: WhatsAppConfig;
  aiAssistant?: AiAssistantConfig;
}

export interface WhatsAppMessage {
  _id: string;
  direction: "in" | "out";
  from: string;
  to: string;
  body: string;
  type: "text" | "template";
  messageId: string;
  status: "sent" | "delivered" | "read" | "failed";
  isRead: boolean;
  errorCode?: string;
  errorDetails?: string;
  customer_id?: string;
  customer_name?: string;
  timestamp: string;
  createdAt: string;
}

export interface WhatsAppConversation {
  phone: string;
  customer_id?: string;
  customer_name?: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  direction: "in" | "out";
}

export interface Settings {
  _id: string;
  user_id?: string;
  company_name: string;
  company_email?: string;
  company_phone?: string;
  company_address?: string;
  company_logo?: string;
  company_website?: string;
  company_bio?: string;
  social_links?: SocialLinks;
  default_currency: string;
  enabledCurrencies: string[];
  invoice_prefix: string;
  quotation_prefix: string;
  expense_prefix: string;
  invoice_number_pattern?: string;
  quotation_number_pattern?: string;
  expense_number_pattern?: string;
  default_tax: number;
  default_payment_terms: number;
  terms_and_conditions?: string;
  invoice_notes?: string;
  appearance: AppearanceSettings;
  documentDesigns: DocumentDesign[];
  lastUsed: LastUsedSettings;
  currencyRates?: CurrencyRates;
  integrations?: Integrations;
}

export interface DashboardAlert {
  type: "warning" | "danger" | "info";
  message: string;
}

export interface DashboardStats {
  totalRevenue: number;
  totalReceived: number;
  totalOutstanding: number;
  totalExpenses: number;
  invoiceCount: number;
  quotationCount: number;
  customerCount: number;
  overdueCount: number;
  revenueByMonth: { month: string; revenue: number; received: number }[];
  topClients: { name: string; total: number; paid: number }[];
  recentInvoices: Invoice[];
  paymentStatusBreakdown: { status: string; count: number; amount: number }[];
  expensesByCategory: { category: string; total: number; count: number }[];
  alerts: DashboardAlert[];
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ─── AI Assistant ─────────────────────────────────────────────────────────────

export type AiAssistantProvider = "openai" | "azure_openai" | "anthropic";

/** LLM provider config for the AI assistant, stored under Settings.integrations.aiAssistant. */
export interface AiAssistantConfig {
  enabled: boolean;
  provider: AiAssistantProvider;
  /** OpenAI/Azure API surface. gpt-5-series & the new Azure endpoints use "responses". */
  apiStyle?: "chat" | "responses";
  /** API key. Falls back to the provider's env var when blank. */
  apiKey?: string;
  /** OpenAI / Anthropic model id (e.g. gpt-4o, claude-sonnet-4-6). */
  model?: string;
  /** Azure OpenAI resource endpoint, e.g. https://my-resource.openai.azure.com */
  azureEndpoint?: string;
  /** Azure OpenAI deployment name (used as the model for Azure). */
  azureDeployment?: string;
  /** Azure OpenAI API version, e.g. 2024-10-21. */
  azureApiVersion?: string;
  /** Optional OpenAI-compatible base URL override (proxies, gateways). */
  baseUrl?: string;
}

/** A tool the model asked to run, in provider-neutral form. */
export interface AssistantToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export type AssistantMessageRole = "user" | "assistant" | "tool";

/** Canonical (provider-neutral) message persisted on the conversation and replayed to the LLM. */
export interface AssistantMessage {
  id: string;
  role: AssistantMessageRole;
  content: string;
  /** Assistant turns that requested tool calls. */
  toolCalls?: AssistantToolCall[];
  /** Tool-result turns — the originating tool_use id. */
  toolCallId?: string;
  /** Tool-result turns — the tool name. */
  toolName?: string;
  /** User turns — uploaded image URLs attached to the message. */
  attachments?: string[];
  /** Set on the final assistant turn after a write, so the "View …" link survives reload. */
  documentLink?: string;
  documentLabel?: string;
  documentCard?: AssistantDocumentCard;
  createdAt: string;
}

export interface AssistantPendingActionPreview {
  label: string;
  value: string;
}

/** An editable field rendered in a form-style confirmation card (e.g. new customer). */
export interface AssistantFormField {
  key: string;
  label: string;
  type: "text" | "tel" | "email";
  value: string;
  required: boolean;
  placeholder?: string;
}

/** Client-facing summary of a write the assistant wants to perform (confirm card). */
export interface AssistantPendingAction {
  id: string;
  tool: string;
  title: string;
  summary: string;
  preview: AssistantPendingActionPreview[];
  /** When present, the card renders editable inputs (the user completes & confirms). */
  form?: AssistantFormField[];
  /** When present, the card lets the user choose the document status before saving. */
  statusValue?: string;
  statusOptions?: { value: string; label: string }[];
}

/** SSE events streamed from /api/assistant/chat to the client hook. */
export type AssistantStreamEvent =
  | { type: "text_delta"; content: string }
  | { type: "tool_started"; id: string; tool: string; label: string }
  | { type: "tool_result"; id: string; tool: string; ok: boolean; summary: string }
  | { type: "needs_confirmation"; conversationId: string; title: string; action: AssistantPendingAction }
  | {
      type: "completed";
      conversationId: string;
      title: string;
      message: string;
      documentLink?: string;
      documentLabel?: string;
      documentCard?: AssistantDocumentCard;
    }
  | { type: "error"; error: { message: string } };

export interface AssistantConversationSummary {
  _id: string;
  title: string;
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantUiToolEvent {
  id: string;
  tool: string;
  label: string;
  status: "running" | "done" | "error";
  summary?: string;
}

/** A rich preview card for a created/updated document, rendered in the chat. */
export interface AssistantDocumentCard {
  type: "quotation" | "invoice" | "customer";
  link: string;
  label: string; // e.g. INV-00012 or customer name
  subtitle?: string; // customer name, or phone for a customer
  amount?: number;
  currency?: string;
  status?: string;
}

/** Rendered chat message in the assistant UI. */
export interface AssistantUiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: string[];
  toolEvents?: AssistantUiToolEvent[];
  pendingAction?: AssistantPendingAction;
  documentLink?: string;
  documentLabel?: string;
  documentCard?: AssistantDocumentCard;
  error?: string;
  createdAt?: string;
}
