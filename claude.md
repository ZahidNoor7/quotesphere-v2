# QuoteSphere v2

Full-stack business management app: invoicing, quotations, expenses, projects, customers, services, time tracking, and reports.

**Stack**: Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · NextAuth v5 · MongoDB + Mongoose · SWR · react-hook-form + zod · Recharts · sonner · Cloudinary

---

## Commands

```bash
pnpm dev      # dev server with Turbopack (port 3000)
pnpm build    # production build — must pass with zero TS/ESLint errors before done
pnpm lint     # eslint only
```

---

## Environment Variables

```text
MONGO_URI
NEXTAUTH_SECRET
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
NEXTAUTH_URL
CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET
```

---

## Route Structure

All app pages live under `app/(app)/`:

```text
app/
  page.tsx                              → root redirect
  layout.tsx                            → root layout (theme provider, SWR provider)
  (auth)/
    login/page.tsx
    register/page.tsx
  (app)/
    dashboard/page.tsx                  → revenue, invoice stats, top clients
    customers/
      page.tsx                          → customer list + bulk import
      [id]/page.tsx                     → customer detail
    invoices/
      page.tsx / new / [id] / [id]/edit
    quotations/
      page.tsx / new / [id] / [id]/edit
    expenses/
      page.tsx / new / [id] / [id]/edit
    projects/
      page.tsx / [id]/page.tsx
    services/page.tsx
    reports/
      page.tsx                          → reports hub
      aging/page.tsx                    → receivables aging report
      profit-loss/page.tsx              → P&L report
    settings/
      general/page.tsx
      document-design/page.tsx
```

---

## API Routes

All under `app/api/`, protected via `auth()` from `auth.ts`. Input validated with zod. Return shape: `{ data } | { error }`.

| Route | Methods | Description |
| --- | --- | --- |
| `/api/auth/[...nextauth]` | — | NextAuth handler |
| `/api/auth/register` | POST | Create user (bcrypt) |
| `/api/customers` | GET, POST | List / create |
| `/api/customers/[id]` | GET, PUT, DELETE | Single CRUD |
| `/api/customers/bulk` | POST | Bulk import (CSV/Excel) |
| `/api/invoices` | GET, POST | List / create |
| `/api/invoices/[id]` | GET, PUT, DELETE | Single CRUD |
| `/api/invoices/[id]/payments` | POST | Add payment |
| `/api/quotations` | GET, POST | List / create |
| `/api/quotations/[id]` | GET, PUT, DELETE | Single CRUD |
| `/api/quotations/[id]/convert` | POST | Convert → invoice |
| `/api/expenses` | GET, POST | List / create |
| `/api/expenses/[id]` | GET, PUT, DELETE | Single CRUD |
| `/api/projects` | GET, POST | List / create |
| `/api/projects/[id]` | GET, PUT, DELETE | Single CRUD |
| `/api/projects/stats` | GET | Aggregated stats |
| `/api/services` | GET, POST | List / create |
| `/api/services/[id]` | GET, PUT, DELETE | Single CRUD |
| `/api/reports/aging` | GET | Receivables aging |
| `/api/reports/profit-loss` | GET | P&L report |
| `/api/reports/recurring-invoices` | GET | Recurring invoice report |
| `/api/time-entries` | GET, POST | List / create |
| `/api/time-entries/[id]` | GET, PUT, DELETE | Single CRUD |
| `/api/dashboard` | GET | Aggregated stats |
| `/api/settings` | GET, PUT | User settings (upsert) |
| `/api/settings/document-designs` | GET, POST | List / create designs |
| `/api/settings/document-designs/[id]` | PUT, DELETE | Update / delete design |
| `/api/settings/currency-rates` | GET, PUT | Exchange rates |
| `/api/team` | GET | Team member list |
| `/api/cron/...` | POST | Cron job handlers (Vercel cron) |

---

## Key Files

| File | Purpose |
| --- | --- |
| `auth.ts` | NextAuth config — Google + Credentials providers, JWT callbacks |
| `auth.config.ts` | Shared auth config used in middleware |
| `types/index.ts` | All shared TS types — **add new types here, never inline** |
| `lib/db.ts` | Lazy MongoDB `clientPromise` — singleton for dev |
| `lib/mongoose.ts` | Mongoose connection helper |
| `lib/ds.ts` | Design system tokens — `CARD`, `GLASS_*`, `TABLE_STYLE`, `TOPBAR_STYLE`, etc. |
| `lib/themes.ts` | 10 theme presets, `applyTheme()`, `getResolvedBase()` |
| `lib/document-designs.ts` | 6 PDF design presets, `getAllDesigns()`, `resolveConfig()` |
| `lib/pdf-document.tsx` | `@react-pdf/renderer` template |
| `lib/pdf-export.ts` | `jspdf` + `html2canvas` export helper |
| `lib/utils.ts` | `cn()` (clsx + tailwind-merge) |
| `models/` | Mongoose models: Invoice, Quotation, Expense, Project, Customer, Service, Settings, Counter, User, TimeEntry |
| `hooks/use-settings.ts` | SWR hook for settings |
| `hooks/use-currency-rates.ts` | SWR hook for live exchange rates |
| `components/forms/document-builder.tsx` | Invoice / quotation line-item form |
| `components/document-design/document-renderer.tsx` | Live PDF preview |
| `components/custom-ui/data-table.tsx` | Reusable paginated data table |
| `components/custom-ui/search-filter-bar.tsx` | Search + filter bar |
| `components/shared/status-badges.tsx` | Status badges for all doc types |

---

## Auth & Session

- JWT strategy (no DB sessions). Use `auth()` from `auth.ts` in every API route.
- Roles: `"admin"` | `"manager"` | `"staff"` | `"viewer"` (in `UserRole` type).
- `session.user.role` injected via JWT callback; defaults to `"admin"`.
- Google OAuth: `allowDangerousEmailAccountLinking: true`.
- `middleware_old.ts` is unused — do not touch it.

---

## Data Models

- **Invoice**: line items, tax (% or flat), discount, delivery charges, payment entries, delivery status. `converted_from` tracks origin quotation.
- **Quotation**: same as invoice minus payments. `converted_to` tracks derived invoice. Status: `draft → pending → approved/rejected → invoiced/expired/cancelled`.
- **Expense**: vendor bills with line items. Linked to customer and/or project.
- **Project**: budget tracking, `progress` 0–100. Links invoices/quotations/expenses via `project_id`.
- **Settings**: per-user — company info, currency config, `appearance` (theme/accent/density), `documentDesigns`, `lastUsed`, `currencyRates`.
- **Counter**: auto-incrementing sequences for document numbers.
- **TimeEntry**: time tracking records linked to projects and users.

---

## Multi-Currency

Supported: `PKR | USD | EUR | GBP | AED | SAR`. Each document stores a `rateSnapshot` at creation (rates frozen at issue time). Live rates cached in `Settings.currencyRates`. Use `hooks/use-currency-rates.ts` in UI.

---

## Design System

`lib/ds.ts` is the **single source of truth** for all surface styles. Never hardcode `backdrop-filter`, `background`, or `border` inline.

**Token constants:**

- `T1`, `T2`, `T3` — text hierarchy
- `AC`, `AC2` — accent colors
- `GLASS`, `GLASS_HOVER`, `GLASS_BORDER`, `GLASS_BORDER_STRONG` — glassmorphism surfaces

**Reusable style objects:**

- `CARD`, `TOPBAR_STYLE`, `TABLE_STYLE`, `TH_STYLE`, `TD_STYLE`
- `GLASS_INPUT`, `GLASS_SELECT`, `FIELD_INPUT`, `TABLE_WRAP`, `ICON_PILL`

**Themes** (`lib/themes.ts`): 10 presets — `dark`, `light`, `system`, `midnight`, `forest`, `rose`, `slate`, `amber`, `nord`, `solarized`.

**PDF designs** (`lib/document-designs.ts`): `classic-corporate`, `modern-gradient` (default), `minimal-clean`, `executive-dark`, `bold-accent`, `retro-serif`. Custom designs stored in `Settings.documentDesigns`.

---

## Coding Rules (MANDATORY)

### Components

- **Always use shadcn/ui** for standard UI elements — never raw `<button>`, `<input>`, `<select>`, `<table>`.
- Use `mcp__shadcn__*` to look up components before writing custom implementations.
- Custom components go in `components/custom-ui/` or `components/shared/`.

### Icons

- **Always use Lucide React** (`lucide-react`) — never hand-craft SVGs.
- Import by name: `import { ChevronDown } from "lucide-react"`.

### Visual Style (iOS Liquid Glass)

- All surfaces use `lib/ds.ts` tokens: `GLASS`, `CARD`, `GLASS_INPUT`, etc.
- Never duplicate glass values across files — if a new variant is needed, add it to `lib/ds.ts`.

### TypeScript

- Strict mode — no `any`, no `as` to silence errors.
- All shared types in `types/index.ts`. Derive form types with `z.infer<typeof schema>`.

### Data Fetching

- **SWR** for all client-side fetching — no `useEffect` + raw `fetch`.
- API routes validate input with **zod** and return `{ data } | { error }`.

### Forms

- **react-hook-form + zod** everywhere — no uncontrolled inputs.

### Notifications

- **sonner** only — no `alert()` or custom toast components.

### Styling

- `cn()` from `lib/utils.ts` for conditional classes.
- Do not edit `components/ui/` directly — compose at call site with `cn()`.

---

## Workflow

### 1. Plan First

For any task with 3+ steps or architectural impact: write plan to `tasks/todo.md` with `- [ ]` checkboxes before touching code. Mandatory for: new routes, new models, new API routes, auth changes, design system tokens.

### 2. Verification Gate

Never mark done without:

- `pnpm build` passing with zero TS/ESLint errors
- Feature tested in browser (golden path + edge cases)
- "Would a staff engineer approve this?" — no `any`, correct SWR usage, typed responses

### 3. Autonomous Bug Fixing

Given a bug report: fix it. Trace to console error / network failure / broken component. Fix TS errors and ESLint warnings without being asked.

### 4. Self-Improvement Loop

After any user correction: update `tasks/lessons.md` with the rule that prevents the same mistake.

### 5. Subagent Strategy

For broad exploration (3+ file reads): spawn an Explore subagent to keep the main context clean.

### 6. Always Invoke UI Skills for UI Work

For ANY UI/UX work — new pages, component redesigns, layout changes, theming, styling, responsive fixes, accessibility passes — invoke BOTH skills at the start of the task, **before** writing any code:

- `/ui-ux-pro-max` — design intelligence: styles, palettes, font pairings, layout patterns, accessibility checklist
- `/senior-frontend` — React/Next.js patterns, performance rules, component scaffolding standards

This applies even when the user hasn't typed the slash commands. If the request mentions "UI", "design", "look", "layout", "alignment", "redesign", "polish", "improve the page", a screenshot, or a route to visually fix — both skills are mandatory. Run them in the same turn as your first response, then proceed with the work using their guidance. Also invoke `/tailwind-design-system` and `/shadcn` when touching design tokens (`lib/ds.ts`) or shadcn components.

### 7. Always Invoke Architecture, Backend, and Security Skills for Plan Mode

For ANY task that involves producing a plan, suggesting an approach, designing a feature, or proposing an implementation strategy — invoke ALL THREE skills at the start of the task, **before** writing the plan:

- `/senior-architect` — system design patterns, architecture diagrams, tech stack decisions, integration trade-offs
- `/senior-backend` — API design, database optimization, business logic, auth/authz, performance tuning
- `/security-review` — threat modeling, vulnerability assessment, OWASP checks, secure-by-default review

This applies even when the user hasn't typed the slash commands. Triggers include: "plan", "suggest a plan", "how should we approach", "design", "architect", "propose", "what's the best way to build", or any request that requires a multi-step implementation strategy. Run all three skills in the same turn as your first response so the resulting plan reflects:

- **Pros and cons** of each viable approach (architecture, performance, complexity, cost)
- **Security implications** (auth, data exposure, input validation, per-user data isolation)
- **Backend trade-offs** (Mongoose schema impact, API contract changes, query patterns)
- **Architectural fit** with the existing Next.js 16 + MongoDB QuoteSphere system

Only after these skills have informed your thinking should you write to `tasks/todo.md` or present the plan. A plan without architectural, backend, and security context is incomplete — do not skip this step even for "small" features.

### 8. Always Add Dirty Guards and Confirmation Dialogs for Editable Sheets / Drawers / Modals

Any `Sheet`, `Drawer`, `Dialog`, or side-panel that contains **editable fields** (form inputs, textareas, selects, toggles, rich-text editors, line-item builders, anything that mutates state) MUST implement a dirty-state guard. No exceptions.

Required behavior:

- **Track dirty state** — compare current form values against the initial snapshot taken on open. React Hook Form's `formState.isDirty` is the preferred source of truth; for non-RHF forms, hold an initial-snapshot ref and deep-compare.
- **Intercept all close and exit paths** — every one of the following must funnel through the same guard. Never let one path bypass it:
  - `onOpenChange`, X button, ESC key, backdrop / outside click, any "Cancel" button
  - **Page reload / tab close** — register a `beforeunload` listener while the form is dirty and call `event.preventDefault()` so the browser shows its native "Leave site?" prompt. Remove the listener on Save, Discard, or unmount.
  - **Browser back / forward** — push a sentinel `history.pushState` entry when the form goes dirty and listen for `popstate` to re-show the confirmation dialog; only proceed with navigation after the user confirms Discard.
  - **In-app link clicks / programmatic navigation** — `next/link`, `router.push`, sidebar nav, breadcrumb clicks must all trigger the guard before unmounting.
  - Encapsulate all of this inside a shared `useDirtyGuard` hook so feature code never wires `beforeunload` / `popstate` listeners by hand.
- **Confirmation dialog when dirty** — open an `AlertDialog` with three explicit choices:
  - **Save** — runs the mutation, closes the surface on success, surfaces a `sonner` toast on error and keeps it open.
  - **Discard** — resets the form to the initial snapshot and closes.
  - **Cancel** — keeps the surface open with edits intact.
- **No silent data loss** — never close, navigate away, or unmount an editable surface that is dirty without showing the dialog.
- **Reset on close** — once Save or Discard completes, clear dirty state so the next open starts clean.
- **Submitting / loading state** — while a save is in flight, disable Save/Discard, block close, and show a spinner; do not show the dirty-guard dialog mid-submit.

Extract this as a shared primitive (`hooks/use-dirty-guard.ts` and/or `components/custom-ui/dirty-guard-sheet.tsx`) so every editable surface consumes the same implementation. If you find yourself writing the guard logic inline in a feature file, STOP and lift it to the shared primitive first.

---

## Task Management

1. Plan → write `tasks/todo.md`
2. Verify plan → check in for significant UI/state changes
3. Track → mark `- [x]` as you go
4. Explain → one-line summary per step
5. Document → add review section to `tasks/todo.md` when done
6. Capture → update `tasks/lessons.md` after corrections

---

## Auditing Mindset

Think like: principal engineer · QA · security engineer · UX expert · accessibility auditor · performance engineer · mobile-first designer.

Identify root causes, not symptoms. Propose fixes, not observations.
