# Tasks — QuoteSphere v2

<!-- Format:
## YYYY-MM-DD — Feature or Sprint Name
- [ ] task description
- [x] completed task
-->

## 2026-06-13 — Rich-text editing (Tiptap 3): line-item details + document remarks

Goal: add Tiptap 3.x rich-text to (a) a NEW optional per-line-item `description` and (b) the existing document `remarks` on invoices & quotations. Styled content must render identically in the editor, the live preview, and the Puppeteer PDF. One shared extension list, one stylesheet, one render utility, one font set. MIT-only; ProseMirror JSON canonical storage; legacy plain strings still render unchanged.

Decisions (approved): line items → new additive rich `description` (keep `name` plain so export/AI/search are untouched); scope → document `remarks` only (Settings `terms_and_conditions` / design footer left as-is).

### Phase 1 — Deps & data model
- [x] Install MIT pkgs (pinned 3.26.1 / 3.16.0): @tiptap/react @tiptap/pm @tiptap/core @tiptap/starter-kit @tiptap/extension-text-align @tiptap/extension-highlight @tiptap/extension-text-style @tiptap/extension-color @tiptap/static-renderer + isomorphic-dompurify. (StarterKit v3 already bundles Underline/Link/lists; `@tiptap/core` added direct so pnpm resolves type imports.)
- [x] types/index.ts: `RichTextJSON` + `RichTextContent = string | RichTextJSON`; `description?` on item types; `remarks?` widened.
- [x] models/Invoice.ts + models/Quotation.ts: itemSchema gains `description: Schema.Types.Mixed`; `remarks` String → Mixed. `name` stays plain. No migration.
- [x] zod: shared `lib/rich-text/zod.ts` (`richTextZod`, string|object, ~50KB cap) wired into invoices/quotations POST + PUT; quotation PUT also hardened (parse + strip ownership fields).
- [x] lib/doc-data.ts + DocumentData: carry item `description`.

### Phase 1.5 — Shared rich-text core
- [x] lib/rich-text/extensions.ts — single source: superset (remarks) + subset (lineItem); RENDER_EXTENSIONS = superset drives renderer + sanitizer.
- [x] lib/rich-text/normalize.ts — string → paragraph (hard breaks); JSON as-is; hosts dep-free `richTextToPlainText`/`isEmptyRichText` (so the AI route doesn't load jsdom).
- [x] lib/rich-text/render.ts — renderRichText() → sanitized HTML (static-renderer DOM-free + isomorphic-dompurify, allowlist from extensions).

### Phase 2 — Editor
- [x] components/custom-ui/rich-text-editor.tsx ('use client', immediatelyRender:false), JSON in/out, variant lineItem|remarks, shadcn Button + lucide toolbar (link/colour/highlight Popovers), useEditorState active state, caret-safe sync, surface = .qs-rich in design font.
- [x] Wired into document-builder.tsx: name stays `<Input>`; line-item details via **lazy** `<LineItemDescription>` (editor mounts only when opened); remarks `<Textarea>` → editor. isDirty deep-compares JSON; payload/state/preview carry it; SaveTemplate gets plain-text remarks.

### Phase 3 — Rendering (preview + PDF)
- [x] document-renderer.tsx: ItemsTable cell = name + sanitized description HTML; RemarksBlock = sanitized remarks HTML; `.qs-rich` at 8–9px + `suppressHydrationWarning` + overflow guard. Detail pages use the same util.
- [x] app/globals.css: self-contained **unlayered** `.qs-rich` (chosen over `prose` for 8–9px precision; em-relative) + `.qs-rich-editor` surface rules.
- [x] Fonts: added Inter-Italic.woff2 + Inter-BoldItalic.woff2 (OFL) + @font-face; editor uses design font → bold/italic embedded, not synthesized.

### Phase 4 — Security & multi-tenancy
- [x] Allowlist from extension set; blocks script/on*/javascript:/data:/img/remote (XSS+SSRF); inline style narrowed to colour/bg/text-align with value validation; links forced rel/nofollow/_blank (never fetched). isomorphic-dompurify externalized.
- [x] Export route never serialized remarks/items text (no projection needed); AI assistant snapshot → plain-text remarks; SaveTemplate → plain-text.
- [x] Tenant scoping unchanged (plugin + signed print token + runWithOrg); quotation PUT hardened against ownership overwrite.

### Phase 5 — Fidelity verification
- [x] test/rich-text.test.ts — 28 tests green: full formatting matrix, legacy strings, sanitizer (XSS/SSRF/style-injection), round-trip + helpers. Runs in node+jsdom = the same path the server PDF render uses.
- [x] `pnpm build` zero TS/ESLint errors; full `vitest run` 152/152 green.
- [ ] Live browser visual parity + manual e2e — needs running app (auth + DB + real doc); offered via /verify.

### Review

Tiptap 3.x rich text on two surfaces: a NEW additive per-line-item `description` (plain `name`/exports/AI/search untouched) and document `remarks`. Canonical = ProseMirror JSON in `Mixed`; legacy strings render unchanged (no migration). **Fidelity is structural:** preview & PDF use the same `DocumentTemplate` leaves + same `globals.css` + the one `renderRichText` driven by the one extension list, so preview == PDF by construction; unit tests assert the exact HTML the PDF embeds. Editor shares `.qs-rich` + the design font (embedded Inter italics) for WYSIWYG. Deviations (all improvements): self-contained `.qs-rich` over `prose`; lazy line-item editors for scale; projection applied where actually needed (AI + save-as-template); `@tiptap/core` as a direct dep; dep-free helpers in normalize.ts. One transient convert-test flake under parallel workers (1-node replica-set transaction) did not reproduce (152/152); convert route untouched.

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
