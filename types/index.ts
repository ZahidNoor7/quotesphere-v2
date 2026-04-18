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
  createdAt: string;
  updatedAt: string;
}

export interface QuotationItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
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

export interface Project {
  _id: string;
  project_no: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  start_date?: string;
  due_date?: string;
  completed_at?: string;
  budget: number;
  currency: Currency;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  tags?: string[];
  notes?: string;
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

export interface Settings {
  _id: string;
  user_id?: string;
  company_name: string;
  company_email?: string;
  company_phone?: string;
  company_address?: string;
  company_logo?: string;
  default_currency: string;
  enabledCurrencies: string[];
  invoice_prefix: string;
  quotation_prefix: string;
  expense_prefix: string;
  default_tax: number;
  default_payment_terms: number;
  terms_and_conditions?: string;
  invoice_notes?: string;
  appearance: AppearanceSettings;
  documentDesigns: DocumentDesign[];
  lastUsed: LastUsedSettings;
  currencyRates?: CurrencyRates;
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
