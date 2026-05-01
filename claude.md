# QuoteSphere v2

Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4 full-stack business management app. Handles invoicing, quotations, expenses, projects, customers, and services. Auth via NextAuth v5 (credentials + Google OAuth). Database: MongoDB via Mongoose. Component library: shadcn/ui (Radix UI primitives + Tailwind).

## Stack

- **Framework**: Next.js 16, React 19, TypeScript
- **Styling**: Tailwind CSS v4 + shadcn/ui (Radix UI)
- **Auth**: NextAuth v5 — credentials + Google OAuth, JWT session strategy, MongoDB adapter
- **Database**: MongoDB + Mongoose (models in `models/`)
- **PDF export**: `@react-pdf/renderer` + `jspdf` + `html2canvas`
- **Forms**: `react-hook-form` + `zod`
- **Data fetching**: SWR (`hooks/use-settings.ts`, client-side fetcher pattern)
- **Charts**: Recharts
- **Notifications**: sonner
- **Image hosting**: Cloudinary

## Commands

```bash
pnpm dev      # dev server with Turbopack (port 3000)
pnpm build    # production build
pnpm lint     # eslint
```

## Environment Variables

```
MONGO_URI                 # MongoDB connection string
NEXTAUTH_SECRET           # NextAuth secret
GOOGLE_CLIENT_ID          # Google OAuth client ID
GOOGLE_CLIENT_SECRET      # Google OAuth client secret
NEXTAUTH_URL              # App base URL (e.g. http://localhost:3000)
CLOUDINARY_CLOUD_NAME     # Cloudinary config
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

## Route Structure

```
app/
  page.tsx                              → root redirect
  layout.tsx                            → root layout (theme provider, SWR provider)
  auth/
    login/page.tsx                      → credentials + Google sign-in
    register/page.tsx                   → new account registration
  dashboard/page.tsx                    → stats overview (revenue, invoices, top clients)
  customers/
    page.tsx                            → customer list
    [id]/page.tsx                       → customer detail
  invoices/
    page.tsx                            → invoice list
    new/page.tsx                        → create invoice
    [id]/page.tsx                       → invoice detail + payments
    [id]/edit/page.tsx                  → edit invoice
  quotations/
    page.tsx                            → quotation list
    new/page.tsx                        → create quotation
    [id]/page.tsx                       → quotation detail
    [id]/edit/page.tsx                  → edit quotation
  expenses/
    page.tsx                            → expense list
    new/page.tsx                        → create expense
    [id]/page.tsx                       → expense detail
    [id]/edit/page.tsx                  → edit expense
  projects/
    page.tsx                            → project list
    [id]/page.tsx                       → project detail (linked invoices/quotations/expenses)
  services/page.tsx                     → service catalogue
  settings/
    page.tsx                            → general settings (company info, currency, themes)
    document-design/page.tsx            → PDF document design editor
  api/                                  → Next.js API routes (see API Routes below)
```

## API Routes

All routes are under `app/api/` and protected via `auth()` from `auth.ts`.

| Route | Methods | Description |
|---|---|---|
| `/api/auth/[...nextauth]` | — | NextAuth handler |
| `/api/auth/register` | POST | Create new user (bcrypt password) |
| `/api/customers` | GET, POST | List / create customers |
| `/api/customers/[id]` | GET, PUT, DELETE | Single customer CRUD |
| `/api/invoices` | GET, POST | List / create invoices |
| `/api/invoices/[id]` | GET, PUT, DELETE | Single invoice CRUD |
| `/api/invoices/[id]/payments` | POST | Add payment entry |
| `/api/quotations` | GET, POST | List / create quotations |
| `/api/quotations/[id]` | GET, PUT, DELETE | Single quotation CRUD |
| `/api/quotations/[id]/convert` | POST | Convert quotation → invoice |
| `/api/expenses` | GET, POST | List / create expenses |
| `/api/expenses/[id]` | GET, PUT, DELETE | Single expense CRUD |
| `/api/projects` | GET, POST | List / create projects |
| `/api/projects/[id]` | GET, PUT, DELETE | Single project CRUD |
| `/api/projects/stats` | GET | Project-level aggregated stats |
| `/api/services` | GET, POST | List / create services |
| `/api/services/[id]` | GET, PUT, DELETE | Single service CRUD |
| `/api/dashboard` | GET | Aggregated dashboard stats |
| `/api/settings` | GET, PUT | User settings (upsert) |
| `/api/settings/document-designs` | GET, POST | List / create document designs |
| `/api/settings/document-designs/[id]` | PUT, DELETE | Update / delete design |
| `/api/settings/currency-rates` | GET, PUT | Fetch / update currency exchange rates |
| `/api/team` | GET | Team member list |

## Key Files

| File | Purpose |
|---|---|
| `auth.ts` | NextAuth config — Google + Credentials providers, JWT callbacks |
| `auth.config.ts` | Shared auth config (pages, callbacks used in middleware) |
| `middleware_old.ts` | (legacy, unused) |
| `types/index.ts` | All shared TS types: `Invoice`, `Quotation`, `Expense`, `Project`, `Customer`, `Service`, `Settings`, etc. |
| `lib/db.ts` | Lazy MongoDB `clientPromise` — single connection pool, dev-mode singleton |
| `lib/mongoose.ts` | Mongoose connection helper |
| `lib/ds.ts` | Design system tokens — CSS custom property constants + reusable inline style objects (`CARD`, `TABLE_STYLE`, `GLASS_INPUT`, etc.) |
| `lib/themes.ts` | Theme definitions (10 themes), `applyTheme()`, `getResolvedBase()` |
| `lib/document-designs.ts` | Built-in PDF design presets, `getAllDesigns()`, `getDefaultDesign()`, `resolveConfig()` |
| `lib/pdf-document.tsx` | `@react-pdf/renderer` PDF template component |
| `lib/pdf-export.ts` | HTML-to-canvas PDF export helper (`jspdf` + `html2canvas`) |
| `lib/utils.ts` | `cn()` utility (clsx + tailwind-merge) |
| `models/` | Mongoose models: `Invoice`, `Quotation`, `Expense`, `Project`, `Customer`, `Service`, `Settings`, `Counter`, `User` |
| `hooks/use-settings.ts` | SWR hook for settings — `updateAppearance`, `updateLastUsed`, `updateEnabledCurrencies` |
| `hooks/use-currency-rates.ts` | SWR hook for live exchange rates |
| `hooks/use-mobile.tsx` | Viewport breakpoint detection |
| `components/layout/app-shell.tsx` | Main app shell wrapping sidebar + content |
| `components/layout/sidebar.tsx` | Collapsible sidebar with nav links |
| `components/layout/theme-provider.tsx` | `next-themes` provider |
| `components/layout/swr-provider.tsx` | SWR global config provider |
| `components/forms/document-builder.tsx` | Invoice / quotation form with line items |
| `components/document-design/document-renderer.tsx` | Live PDF preview renderer |
| `components/custom-ui/data-table.tsx` | Reusable paginated data table |
| `components/custom-ui/search-filter-bar.tsx` | Search + filter bar component |
| `components/settings/currency-rates-panel.tsx` | Currency rate management UI |
| `components/shared/status-badges.tsx` | Status badge components for invoices, quotations, expenses, projects |

## Auth & Session

- **Strategy**: JWT (no database sessions). `auth()` from `auth.ts` is used in API routes to get the session.
- **Providers**: Email/password (bcrypt) and Google OAuth. `allowDangerousEmailAccountLinking: true` on Google.
- **Session shape**: `session.user.role` is added via JWT callback. Defaults to `"admin"` if not set.
- **Roles**: `"admin"` | `"manager"` | `"staff"` | `"viewer"` (defined in `UserRole` type).
- **MongoDB adapter**: `@auth/mongodb-adapter` persists OAuth accounts/users.

## Design System

All styling uses CSS custom properties set per-theme via `[data-theme="X"]` selectors in `globals.css`. Never hardcode color values — import tokens from `lib/ds.ts`.

**Token constants** (`lib/ds.ts`):
- `T1`, `T2`, `T3` — primary/secondary/muted text
- `AC`, `AC2` — accent colors (theme-specific)
- `GLASS`, `GLASS_HOVER`, `GLASS_BORDER`, `GLASS_BORDER_STRONG` — glassmorphism surface values

**Reusable style objects** (inline styles for custom layouts):
- `CARD`, `TOPBAR_STYLE`, `TABLE_STYLE`, `TH_STYLE`, `TD_STYLE`
- `GLASS_INPUT`, `GLASS_SELECT`, `FIELD_INPUT`, `TABLE_WRAP`, `ICON_PILL`

**Themes** (`lib/themes.ts`): 10 presets — `dark`, `light`, `system`, `midnight`, `forest`, `rose`, `slate`, `amber`, `nord`, `solarized`. Applied by setting `data-theme` attribute + `dark`/`light` class on `<html>`.

## Document Designs (PDF)

6 built-in presets in `lib/document-designs.ts`: `classic-corporate`, `modern-gradient` (default), `minimal-clean`, `executive-dark`, `bold-accent`, `retro-serif`.

Users can create custom designs stored in `Settings.documentDesigns`. Use `getAllDesigns()` to merge built-ins with user designs. Use `resolveConfig()` to merge preset base config with user overrides before rendering a PDF.

## Core Data Models

- **Invoice**: line items, tax (% or value), discount, delivery charges, payment entries, delivery status. Linked to customer and optionally a project. `converted_from` tracks origin quotation.
- **Quotation**: similar to invoice, no payments. `converted_to` tracks derived invoice. Status: `draft → pending → approved/rejected → invoiced/expired/cancelled`.
- **Expense**: vendor bills with line items. Linked to customer and optionally a project.
- **Project**: budget tracking. Links to invoices/quotations/expenses via `project_id`. Has `progress` (0–100).
- **Settings**: per-user. Holds company info, currency config, `appearance` (theme, accent, density), `documentDesigns`, `lastUsed` (remembers last currency/payment method/design per doc type), and `currencyRates`.
- **Counter**: auto-incrementing number sequences for invoice/quotation/expense document numbers.

## Multi-Currency

Currencies: `PKR | USD | EUR | GBP | AED | SAR`. Each document stores a `rateSnapshot` at creation time (rates frozen at time of issue). Live rates fetched from external API and cached in `Settings.currencyRates`. Use `hooks/use-currency-rates.ts` for UI.

## Styling Conventions

- Use `cn()` from `lib/utils.ts` for conditional class merging.
- shadcn/ui components live in `components/ui/` — don't edit these directly unless fixing a bug.
- Custom reusable components go in `components/custom-ui/` or `components/shared/`.
- Inline styles using `lib/ds.ts` tokens are acceptable for complex custom layouts; prefer Tailwind classes for standard components.
- Page layouts use `app-shell` + `sidebar`. Page sections use `TOPBAR_STYLE` for filter/action bars and `TABLE_WRAP` + `TABLE_STYLE` for data tables.
