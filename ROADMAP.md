# QuoteSphere v2 — Feature Roadmap

Full codebase audit completed on 2026-05-13. The app is feature-complete for MVP — invoice/quotation/expense/project CRUD, multi-currency, PDF export, and document design system. This roadmap identifies what must be fixed for production readiness, what would significantly improve the product, and what belongs on a longer-term backlog.

---

## 🔴 MUST — Critical for Production (Fix/Build Now)

### 1. Role-Based Access Control (RBAC)
**Problem:** `admin | manager | staff | viewer` roles exist in JWT + DB but are never checked in any API route. Every authenticated user can CRUD all data.
- Add `lib/rbac.ts` — permission matrix mapping roles → allowed actions per resource
- Wire role guard into all 34 routes under `app/api/`
- **Impact:** Without this, any "viewer" or "staff" can delete invoices, change settings, etc.

### 2. Email Notification System
**Problem:** Zero email integration. No invoice delivery, no payment reminders, no quotation expiry alerts, no team invitations.
- Integrate Resend (recommended) or Nodemailer + SMTP
- **Emails needed:**
  - Invoice PDF delivery to client
  - Payment due / overdue reminder (day 0, 7, 14 past due)
  - Quotation expiry warning (3 days before `valid_until`)
  - New team member invite with temp password
  - Payment receipt confirmation
- New route: `app/api/notifications/send/route.ts`

### 3. PDF Design System Actually Applied
**Problem:** `lib/pdf-document.tsx` never reads `designId` from the document. All PDFs render in hardcoded style regardless of design selection in Settings.
- Wire `designId` → `PRESET_CONFIGS` lookup in `lib/pdf-document.tsx`
- `resolveConfig()` already exists in `lib/document-designs.ts` — just call it
- **Impact:** The entire document design feature (settings page, 6 presets) is visually broken for PDF output

### 4. Input Validation on All API Routes
**Problem:** Zod validation only exists on `/api/auth/register`. All other POST/PUT endpoints accept arbitrary payloads.
- Add Zod schemas for: invoices, quotations, expenses, projects, customers, services
- Match existing `zod` v4 usage pattern from `auth.ts`

### 5. "Unsaved Changes" Navigation Warning
**Problem:** Navigating away from document builder silently loses all unsaved work.
- File: `components/forms/document-builder.tsx`
- Add `useBeforeUnload` + Next.js router event guard

### 6. Default Document Design Applied on Create
**Problem:** Default document design selected in Settings is not pre-selected when creating new invoices/quotations.
- Files: `app/(app)/invoices/new/page.tsx`, `app/(app)/quotations/new/page.tsx`
- Fetch `settings.lastUsed.design` and pass as default to `DocumentBuilder`

### 7. Referential Integrity on Delete
**Problem:** Deleting a customer with active invoices orphans `customer_id`. Deleting a converted invoice leaves `converted_from` dangling.
- Add cascade-check middleware on DELETE routes for customers, invoices, quotations
- Or implement soft-delete pattern (`deleted_at` field, filter in all queries)

### 8. Distributed Rate Limiting
**Problem:** `lib/rate-limit.ts` uses in-memory store — resets on every Vercel cold start, ineffective under horizontal scaling.
- Replace with Upstash Redis (`@upstash/ratelimit`) or Vercel KV

---

## 🟡 RECOMMENDED — High-Value Improvements (Next Sprint)

### 9. Recurring Invoices / Scheduled Billing
Set an invoice as recurring (weekly/monthly/quarterly). Auto-generate on schedule.
- New field: `Invoice.recurrence: { frequency, next_date, end_date }`
- Mechanism: Vercel Cron or a background worker
- **Value:** Automates retainer/subscription clients entirely

### 10. Payment Gateway Integration
Accept online payments directly from an invoice. Auto-mark as paid on success.
- Integrate Stripe (international) + optional Easypaisa/JazzCash for PKR clients
- New route: `app/api/payments/stripe/webhook/route.ts`
- New page: `app/(app)/invoices/[id]/pay/page.tsx` — public-facing payment page

### 11. Client Portal (Secure Public Share Links)
Share a secure, public link to an invoice or quotation. Client can view, download PDF, and optionally pay online.
- New route: `app/(public)/share/[token]/page.tsx`
- Add `share_token` field to Invoice and Quotation models
- New API: `POST /api/invoices/[id]/share` → generate token
- **Value:** Eliminates WhatsApp PDF sharing workaround

### 12. Quotation Approval Workflow
Client receives quotation link → can approve or reject with digital confirmation.
- Extends Client Portal — add approve/reject buttons on public quotation view
- Status flow: `pending → approved (by client)` with timestamp + IP log
- **Value:** Creates audit trail for approvals; eliminates back-and-forth

### 13. Advanced Reporting — Profit & Loss
Per-period and per-project P&L: revenue vs. expenses, gross margin, top/bottom clients.
- New page: `app/(app)/reports/profit-loss/page.tsx`
- New API: `GET /api/reports/profit-loss?from=&to=&project_id=`
- Charts: Recharts BarChart (revenue vs. expense) + PieChart (cost breakdown)

### 14. Aging Receivables Report
Grouped overdue invoices: 0–30 days, 31–60 days, 61–90 days, 90+ days.
- New section under Reports page
- New API: `GET /api/reports/aging`
- **Value:** Standard accounting report; shows cash flow risk at a glance

### 15. Project Time Tracking
Log time (start/stop timer or manual entry) against a project. Convert hours × rate to invoice line item.
- New model: `TimeEntry { project_id, user_id, date, hours, description, hourly_rate }`
- New page: `app/(app)/projects/[id]/time/page.tsx`
- Add to DocumentBuilder: "Add time entries as line items" button

### 16. Bulk Customer Import (CSV Upload)
Import customers from a CSV/Excel file.
- New component: `CustomerImportDialog` in `components/forms/`
- Parse with `xlsx` (already installed)
- New API: `POST /api/customers/bulk`

### 17. Expense Category Analytics
Pie/bar chart breaking down expenses by category on dashboard and reports.
- Add expense breakdown card to Dashboard Analytics tab
- New aggregation in `GET /api/dashboard` → `expensesByCategory`

### 18. Invoice Number Pattern Customization
Support year-based or client-based numbering (e.g., `INV-2026-0001`).
- Add `Settings.invoiceNumberingPattern` with format tokens
- Update `models/Counter.ts` + `models/Invoice.ts`

### 19. Multi-Language Document Output
Generate PDF invoices/quotations in Arabic or Urdu for international clients.
- Add RTL layout support + translated labels in `lib/pdf-document.tsx`
- New field: `Invoice.document_language: 'en' | 'ar' | 'ur'`

### 20. Dashboard KPI Alerts / Thresholds
Warning banners when overdue invoices exceed a threshold or collection rate drops.
- Add alert cards above KPI row in `app/(app)/dashboard/page.tsx`
- New API: `GET /api/dashboard/alerts`

---

## 🔵 FUTURE — Strategic / Enterprise (Backlog)

### 21. WhatsApp Business API Integration
Send invoice and payment reminders via WhatsApp Business API (not just share links).
- Integrate 360dialog or Twilio WhatsApp API
- Same trigger schedule as email notifications
- **Value:** High open-rate for SMB clients in Pakistan/ME markets

### 22. Xero / QuickBooks Accounting Sync
Sync invoices and expenses to Xero or QuickBooks for accountant access.
- Sync invoices on create/update, payments on record, expenses on verify
- **Value:** Eliminates double-entry for businesses using an external accountant

### 23. Product Inventory Management
Track stock; auto-decrement when products are added to invoices; low-stock alerts.
- `Product.ts` already has `stock_qty` and `low_stock_threshold` — never updated
- Fix: decrement stock in `POST /api/invoices` when items reference product SKUs
- New page: `app/(app)/products/page.tsx` with stock level dashboard

### 24. Project Milestone Tracking
Break projects into milestones with dates and completion status. Auto-update progress.
- New sub-model: `Milestone { name, due_date, completed_at, invoice_id? }`
- New page section: `app/(app)/projects/[id]/milestones`
- Auto-billing: trigger invoice creation when milestone marked complete

### 25. Multi-Tenancy / Workspace Support
Allow a user to belong to multiple organizations. All data scoped to workspace.
- New model: `Workspace { name, owner_id, members: [{ user_id, role }] }`
- Add `workspace_id` to all models
- **Required for:** agency/team use cases (accountants managing multiple clients)

### 26. AI-Assisted Invoice Generation
Describe work done in plain text → AI generates line items with suggested prices.
- Integrate Claude API (`claude-sonnet-4-6`)
- New button in DocumentBuilder: "Generate from description"

### 27. Cash Flow Forecasting
Project incoming payments and outgoing costs for next 30/60/90 days.
- New page: `app/(app)/reports/cash-flow/page.tsx`
- Chart: stacked area chart (projected vs. actual) using Recharts
- Data: aggregate from Invoice due dates + Expense bill dates

### 28. Audit Trail / Activity Log
Full log of who changed what and when.
- New model: `AuditLog { user_id, resource, resource_id, action, before, after, timestamp }`
- Hook into all API PUT/DELETE routes via middleware wrapper
- New page: `app/(app)/settings/audit-log/page.tsx`

### 29. Two-Factor Authentication (2FA)
TOTP-based 2FA (Google Authenticator) for admin accounts.
- Integrate `otplib` library
- New Security tab in Settings

### 30. Mobile App (React Native)
iOS/Android app for on-the-go expense capture, invoice status, and payment reminders.
- API layer is already REST-based — no backend changes needed
- Stack: React Native + Expo

---

## Summary Table

| # | Feature | Priority | Effort | Impact |
|---|---------|----------|--------|--------|
| 1 | RBAC enforcement | 🔴 MUST | M | Security |
| 2 | Email notifications | 🔴 MUST | M | Core UX |
| 3 | PDF design fix | 🔴 MUST | S | Broken feature |
| 4 | API input validation | 🔴 MUST | M | Security |
| 5 | Unsaved changes warning | 🔴 MUST | S | Known bug |
| 6 | Default design on create | 🔴 MUST | S | Known bug |
| 7 | Referential integrity | 🔴 MUST | M | Data integrity |
| 8 | Distributed rate limiting | 🔴 MUST | S | Infra |
| 9 | Recurring invoices | 🟡 REC | L | Revenue automation |
| 10 | Payment gateway | 🟡 REC | L | Revenue |
| 11 | Client portal | 🟡 REC | M | Client UX |
| 12 | Quotation approval | 🟡 REC | M | Workflow |
| 13 | P&L reporting | 🟡 REC | M | Analytics |
| 14 | Aging receivables | 🟡 REC | S | Analytics |
| 15 | Time tracking | 🟡 REC | L | Planned |
| 16 | Bulk customer import | 🟡 REC | S | Onboarding |
| 17 | Expense analytics | 🟡 REC | S | Dashboard |
| 18 | Invoice # patterns | 🟡 REC | S | Customization |
| 19 | Multi-language docs | 🟡 REC | M | Market fit |
| 20 | KPI alerts | 🟡 REC | S | Visibility |
| 21 | WhatsApp Business API | 🔵 FUTURE | M | Comms |
| 22 | Xero/QuickBooks sync | 🔵 FUTURE | L | Accounting |
| 23 | Inventory management | 🔵 FUTURE | M | Product depth |
| 24 | Project milestones | 🔵 FUTURE | M | Project mgmt |
| 25 | Multi-tenancy | 🔵 FUTURE | XL | Enterprise |
| 26 | AI invoice generation | 🔵 FUTURE | M | AI |
| 27 | Cash flow forecast | 🔵 FUTURE | L | Analytics |
| 28 | Audit trail | 🔵 FUTURE | M | Compliance |
| 29 | 2FA | 🔵 FUTURE | M | Security |
| 30 | Mobile app | 🔵 FUTURE | XL | Distribution |

**Effort key:** S = days · M = 1–2 weeks · L = 3–4 weeks · XL = months
