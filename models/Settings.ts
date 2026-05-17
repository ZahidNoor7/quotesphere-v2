import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISocialLinks {
  website?: string;
  facebook?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  youtube?: string;
  tiktok?: string;
  whatsapp?: string;
}

export interface ISettings extends Document {
  user_id: mongoose.Types.ObjectId;
  company_name: string;
  company_email?: string;
  company_phone?: string;
  company_address?: string;
  company_logo?: string;
  company_website?: string;
  company_bio?: string;
  social_links?: ISocialLinks;
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
  appearance: {
    themeId: string;
    sidebarCollapsed: boolean;
    accentColor: string;
    density: "comfortable" | "compact";
  };
  documentDesigns: Array<{
    id: string;
    name: string;
    type: "invoice" | "quotation" | "receipt" | "all";
    isDefault: boolean;
    config: {
      preset?: string; headerBg?: string; accentColor?: string; fontFamily?: string;
      showLogo?: boolean; showAddress?: boolean; showPhone?: boolean; tableStyle?: string;
      showTax?: boolean; showDiscount?: boolean; showTerms?: boolean;
      footerText?: string; watermark?: string;
      marginTop?: number; marginRight?: number; marginBottom?: number; marginLeft?: number;
    };
  }>;
  lastUsed: {
    currency: string;
    paymentMethod: string;
    invoiceDesignId?: string;
    quotationDesignId?: string;
    receiptDesignId?: string;
  };
  integrations?: {
    cloudinary?: { enabled: boolean; cloudName?: string; apiKey?: string; apiSecret?: string };
    googleAuth?: { enabled: boolean; clientId?: string; clientSecret?: string };
    currencyApi?: { enabled: boolean; apiKey?: string; provider?: string };
    mongodb?: { enabled: boolean; uri?: string };
  };
  currencyRates?: {
    base: string;
    rates: Record<string, number>;
    thresholds: Record<string, number>;
    lastUpdated: Date | null;
  };
}

const currencyRatesSchema = new Schema(
  {
    base: { type: String, default: "PKR" },
    rates: { type: Schema.Types.Mixed, default: {} },
    thresholds: { type: Schema.Types.Mixed, default: {} },
    lastUpdated: { type: Date, default: null },
  },
  { _id: false }
);

const documentDesignConfigSchema = new Schema(
  {
    // Base
    preset: String, headerBg: String, accentColor: String, fontFamily: String,
    showLogo: Boolean, showAddress: Boolean, showPhone: Boolean, tableStyle: String,
    showTax: Boolean, showDiscount: Boolean, showTerms: Boolean,
    footerText: String, watermark: String,
    marginTop: Number, marginRight: Number, marginBottom: Number, marginLeft: Number,
    // Header
    headerEnabled: Boolean,
    headerVisibility: String,
    headerTextColor: String,
    logoUrl: String,
    // Footer
    footerEnabled: Boolean,
    showPageNumber: Boolean,
    footerBg: String,
    footerTextColor: String,
    // Page
    pageSize: String,
    pageOrientation: String,
    // Content / Terms
    termsPosition: String,
    termsFormat: String,
    termsText: String,
    contentGap: Number,
  },
  { _id: false }
);

const settingsSchema = new Schema<ISettings>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    company_name: { type: String, default: "My Company" },
    company_email: String,
    company_phone: String,
    company_address: String,
    company_logo: String,
    company_website: String,
    company_bio: String,
    social_links: {
      website: String, facebook: String, instagram: String, twitter: String,
      linkedin: String, youtube: String, tiktok: String, whatsapp: String,
    },
    default_currency: { type: String, default: "PKR" },
    enabledCurrencies: { type: [String], default: ["PKR", "USD", "EUR", "GBP", "AED"] },
    invoice_prefix: { type: String, default: "INV" },
    quotation_prefix: { type: String, default: "QT" },
    expense_prefix: { type: String, default: "EXP" },
    invoice_number_pattern: { type: String, default: null },
    quotation_number_pattern: { type: String, default: null },
    expense_number_pattern: { type: String, default: null },
    default_tax: { type: Number, default: 0 },
    default_payment_terms: { type: Number, default: 30 },
    terms_and_conditions: String,
    invoice_notes: String,
    appearance: {
      themeId: { type: String, default: "dark" },
      sidebarCollapsed: { type: Boolean, default: false },
      accentColor: { type: String, default: "#6366f1" },
      density: { type: String, enum: ["comfortable", "compact"], default: "comfortable" },
    },
    documentDesigns: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true },
        type: { type: String, enum: ["invoice", "quotation", "receipt", "all"], required: true },
        isDefault: { type: Boolean, default: false },
        config: { type: documentDesignConfigSchema, default: {} },
      },
    ],
    lastUsed: {
      currency: { type: String, default: "PKR" },
      paymentMethod: { type: String, default: "cash" },
      invoiceDesignId: String,
      quotationDesignId: String,
      receiptDesignId: String,
    },
    integrations: {
      cloudinary: { enabled: { type: Boolean, default: false }, cloudName: String, apiKey: String, apiSecret: String },
      googleAuth: { enabled: { type: Boolean, default: false }, clientId: String, clientSecret: String },
      currencyApi: { enabled: { type: Boolean, default: false }, apiKey: String, provider: { type: String, default: "exchangerate-api" } },
      mongodb: { enabled: { type: Boolean, default: false }, uri: String },
    },
    currencyRates: {
      type: currencyRatesSchema,
      default: () => ({ base: "PKR", rates: {}, thresholds: {}, lastUpdated: null }),
    },
  },
  { timestamps: true, versionKey: false }
);

const Settings: Model<ISettings> =
  mongoose.models.Settings ||
  mongoose.model<ISettings>("Settings", settingsSchema);

export default Settings;
