# Tasks — QuoteSphere v2

<!-- Format:
## YYYY-MM-DD — Feature or Sprint Name
- [ ] task description
- [x] completed task
-->

## 2026-05-17 — New Features Branch (`new-features`)

Tracking work in progress on the current branch. Based on git diff from `main`.

### Completed

- [x] Rate limiting on API routes
- [x] API input validation (zod schemas)
- [x] RBAC enforcement on API routes
- [x] Email sending gateway
- [x] Invoice/Quotation duplication feature
- [x] Save as template feature
- [x] Data export — CSV / Excel / PDF
- [x] App settings reflected across the product (currency, theme, document design)
- [x] Dashboard API updated with new stats
- [x] Expenses API — validation + filtering improvements
- [x] Invoices API — validation + filtering improvements
- [x] Quotations API — validation + filtering improvements
- [x] Customer bulk import API (`/api/customers/bulk`)
- [x] Customer import UI (`components/forms/customer-import.tsx`)
- [x] Reports hub page (`app/(app)/reports/page.tsx`)
- [x] Receivables aging report page + API (`/api/reports/aging`)
- [x] Profit & Loss report page + API (`/api/reports/profit-loss`)
- [x] Recurring invoices report API (`/api/reports/recurring-invoices`)
- [x] Time entries model (`models/TimeEntry.ts`) + API (`/api/time-entries`)
- [x] Cron job handlers (`/api/cron/`)
- [x] Vercel deployment config (`vercel.json`)
- [x] Counter model updates
- [x] Invoice model updates
- [x] Settings model updates
- [x] `types/index.ts` updated for new features
- [x] `document-builder.tsx` form updates
- [x] Customer page updates
- [x] Dashboard page updates
- [x] Project detail page updates
- [x] Reports page updates
- [x] Settings general page updates

### In Progress / Pending

- [ ] Verify `pnpm build` passes with zero TS/ESLint errors on `new-features` branch
- [ ] Test aging report end-to-end in browser
- [ ] Test P&L report end-to-end in browser
- [ ] Test customer bulk import (CSV + Excel) in browser
- [ ] Test time entries CRUD in browser
- [ ] Verify cron jobs work with Vercel cron config
- [ ] Write/update RBAC docs for new routes
- [ ] PR review and merge to `main`
