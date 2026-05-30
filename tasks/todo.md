# Tasks — QuoteSphere v2

<!-- Format:
## YYYY-MM-DD — Feature or Sprint Name
- [ ] task description
- [x] completed task
-->

## 2026-05-30 — Products page redesign (consistent with Services)

Goal: redesign `/products` to match the new `/services` design — same filter bar, Sheet-based create/edit with unsaved-changes guard, grouped glass cards — while keeping product-specific features (SKU, stock summary strip, stock badges, ± stock adjust).

### Plan
- [x] Backend: add the same safe `status` (active|inactive|all) param to `GET /api/products`.
- [x] New `components/products/product-sheet.tsx` — RHF + zod Sheet (reuses `useUnsavedChanges`); fields: name, sku, category, unit, price, currency, stock_qty, low_stock_threshold, description, is_active.
- [x] New `components/products/stock-adjust-sheet.tsx` — quick add/remove stock as a compact Sheet with add/remove toggle, live projected total, and a light unsaved-changes guard.
- [x] Rewrite `app/(app)/products/page.tsx` — filter bar (search, category, unit, stock, status, sort) + clear + count; clickable stock-summary strip; grouped glass cards with stock badges; wires both sheets.
- [x] `pnpm build` — ✓ compiled, zero TS/ESLint errors.

### Review
- Mirrors the Services patterns 1:1 (debounced server search, client-side category/unit/sort, `EmptyState`, `IconAction`, grouped-by-category glass cards) so the two catalogs are visually and behaviourally consistent. Reused `hooks/use-unsaved-changes.ts` for both create/edit and stock-adjust sheets. Inactive products dimmed + chip; prices use each product's own currency.

## 2026-05-30 — Services page redesign (filters + Sheet form + dirty guard)

Goal: redesign `/services` with proper filters, replace the create/edit Dialog with a right-side Sheet, and add a robust unsaved-changes guard (block sheet close, page reload, and browser back/forward when the form is dirty).

### Plan
- [x] Backend: add safe `status` (active|inactive|all) query param to `GET /api/services` so an Active/Inactive/All filter is possible (string compared to literals — no injection surface).
- [x] New hook `hooks/use-unsaved-changes.ts` — `beforeunload` (reload/close/external nav) + `popstate` (browser back/forward) guard with a confirm callback.
- [x] New component `components/services/service-sheet.tsx` — react-hook-form + zod inside a Sheet (right on desktop, bottom on mobile). Fields: name, category, unit, default_price, currency, description, is_active. Uses `formState.isDirty` for the guard; intercepts close/back with a "Discard changes?" AlertDialog.
- [x] Rewrite `app/(app)/services/page.tsx` — filter bar (search, category, unit, status, sort) + clear button + results count; grouped-by-category glass cards; wire the Sheet.
- [x] `pnpm build` passes with zero TS/ESLint errors.

### Review
- New `GET /api/services` `status` filter (active|inactive|all) — value only compared to literals, never interpolated; no injection surface. `category`/`search` unchanged.
- `hooks/use-unsaved-changes.ts` — `beforeunload` + `popstate` sentinel-entry guard; callback held in a ref so the effect only depends on `enabled`.
- `components/services/service-sheet.tsx` — RHF + zod Sheet (right desktop / bottom mobile). `isDirty` drives the guard; Esc / overlay / Cancel / Back all route through a "Discard unsaved changes?" AlertDialog; submit resets the form (clears dirty) before closing. Used `z.number()` + explicit numeric onChange (zod v4 `z.coerce` breaks RHF resolver typing).
- `app/(app)/services/page.tsx` — filter bar (search-debounced, category, unit, status, sort) + Clear + results count; grouped glass cards with per-group sort; inactive services dimmed with an "Inactive" chip; price uses each service's own currency. Replaced inline SVG action buttons with `IconAction` (Lucide) and `EmptyState`.
- `pnpm build` — ✓ compiled, zero TS/ESLint errors.

## 2026-05-30 — Light-mode (and all-theme) visibility audit & fix

Root cause: light/solarized design tokens too weak + hardcoded dark-mode `rgba(255,255,255,…)` values in components that can't adapt to light themes. Dark-based themes (dark/midnight/forest/rose/slate/amber/nord) inherit healthy `:root` tokens and are fine; only the two light-base themes break, plus any component bypassing tokens breaks regardless of theme.

### Plan
- [x] Phase 1 — Strengthen light & solarized tokens in `app/globals.css` (glass, glass-border, glass-hover, t2, t3) for visible surfaces/borders/muted text.
- [x] Phase 1 — Add light/solarized overrides for white-only utility effects (`.table-row-hover`, `.skeleton-shimmer`, `.kpi-card`/`.glass-card` sheens).
- [x] Phase 2 — Tokenize `components/ui/button.tsx` outline/secondary/ghost/link variants + Badge secondary/muted.
- [x] Phase 3 — Fix hardcoded interactive bits (currency toggle off-state, sidebar divider, skeleton borders, doc-builder drag handle, disabled icons, design-editor drag handle/line numbers).
- [x] Phase 4 — Swept hardcoded glass-whites → tokens across 19 page/component files (subagent), excluding PDF renderer (white = paper), accent-gradient `#fff`, and adaptive `isDark` ternaries.
- [x] Phase 4b — Charts: theme-aware tooltips (`var(--modal-bg)`/`var(--t1)`) + grid stroke (`var(--glass-border)`) in dashboard + profit-loss; removed hardcoded `#1a2035`.
- [x] Verify — `pnpm build` passes, zero TS/ESLint errors.
- [ ] Verify — visual check in light + solarized + a dark theme (offered to user).

### Review

Root cause was a weak token layer for the two light-base themes plus components bypassing tokens with hardcoded dark-mode `rgba(255,255,255,…)` values.

Fix is architecturally clean and cascades:
1. **Token layer** (`globals.css`): light/solarized now use frosted-white liquid glass (`--glass` 0.70/0.58) with slate/teal-tinted **visible** hairline borders (`--glass-border` 0.14/0.16) and readable text (`--t2` 0.78/0.80, `--t3` 0.56). This alone fixes ~90% of surfaces, borders, and muted labels everywhere. Added light overrides for white-only effects (row hover, skeleton shimmer, card/KPI sheens).
2. **Buttons** (`button.tsx`): outline/secondary/ghost/link now use `var(--glass)`/`var(--glass-border)`/`var(--t2)`/`var(--accent2)` — were hardcoded white-on-white in light (the "invisible buttons" bug).
3. **Components**: card Badges, currency toggle, sidebar/skeleton dividers, charts, drag handles, disabled icons, and ~19 page files converted from hardcoded whites to theme tokens.

Dark themes are unchanged: every `var(--glass*)`/`var(--t*)` resolves to the original `:root` dark values. Verified `pnpm build` clean.

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
