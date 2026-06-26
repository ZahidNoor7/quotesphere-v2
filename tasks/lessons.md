# Lessons — QuoteSphere v2

<!-- Format:
## YYYY-MM-DD — Short description
Rule: one-line rule.
Why: reason.
-->

<!-- Review this file at the start of every session before writing any code. -->

## 2026-06-26 — Tenant isolation: force-stamp org_id, don't trust the body

Rule: The tenant plugin FORCE-stamps `org_id` from context on every insert (overwriting any caller value) and strips client `org_id` from update/upsert `$set`/`$setOnInsert`. Never pass a raw `req.body` to `Model.create()` — validate with zod and omit `org_id`.
Why: The old `validate` hook only stamped `org_id` when it was `null`, so a body `org_id` survived → cross-tenant create. Routes spreading raw bodies (products, templates, settings) were the exploit surface.

## 2026-06-26 — Shared settings endpoint mixes admin config and member preferences

Rule: `PUT /api/settings` is `writeRole:"none"` and does its OWN role logic: display/cache prefs (`PREFERENCE_KEYS`: appearance, lastUsed, enabledCurrencies, currencyRates, default_currency) are open to any member; everything else — company info AND `integrations` (secrets) — needs admin.
Why: Blanket-admin-gating the endpoint 403'd non-admins on routine theme/sidebar/currency writes (the `useSettings.patch` helper swallows the error, so prefs silently never persist).

## 2026-06-26 — Don't recurse generic deep-walkers into ObjectId/Buffer

Rule: A recursive object transform (e.g. secret masking) must only descend into PLAIN objects (`value.constructor === Object`) and arrays — return Date/ObjectId/Buffer/class instances as leaves.
Why: Recursing into a Mongoose lean doc's `_id`/`org_id` ObjectId rebuilds it as `{}`/`{buffer:…}`, corrupting the response shape.

## 2026-06-26 — SSRF host checks must canonicalize numeric IPs

Rule: A URL allow-guard must reject numeric IP literals in ALL encodings (decimal `2130706433`, hex `0x7f000001`, octal `0177.0.0.1`, trailing-dot) and IPv6 literals — not just dotted-quad. Legit provider endpoints use DNS hostnames.
Why: `127.0.0.1` / `169.254.169.254` (cloud metadata) are trivially reachable via these encodings if you only match `d.d.d.d`.

## 2026-06-26 — withTenant enforces auth+subscription+feature, NOT role by default for legacy routes

Rule: Role is enforced centrally in `withTenant` for writes (method→op). Self-service routes (own profile, own AI conversations) pass `writeRole:"none"`; admin-only routes (settings/*) pass `writeRole:"settings"` or check inline.
Why: Many write routes historically forgot `requireRole`; centralizing it closes the class, but the override is needed so self-service flows aren't over-gated.

## 2026-05-17 — Data fetching pattern

Rule: Use **SWR** for all client-side data fetching — never `useEffect` + raw `fetch`.
Why: `useEffect`/`fetch` patterns bypass SWR caching, cause race conditions, and duplicate loading state logic.

## 2026-05-17 — Form handling pattern

Rule: Use **react-hook-form + zod** for every form — no uncontrolled inputs or manual `useState` for field values.
Why: Uncontrolled inputs skip validation, make testing harder, and don't integrate with zod schema types.

## 2026-05-17 — API route response shape

Rule: Every API route must return `{ data } | { error }` — never a bare array or object.
Why: Consistent shape lets client code handle errors uniformly without per-route special-casing.

## 2026-05-17 — API route input validation

Rule: Every POST/PUT API route must validate the request body with **zod** before touching the database.
Why: Without validation, malformed input reaches Mongoose and produces cryptic 500 errors instead of clear 400s.

## 2026-05-17 — Type definitions location

Rule: All shared TypeScript types go in `types/index.ts` — never inline in component files.
Why: Scattering types across files causes drift and makes refactoring painful.

## 2026-05-17 — Design system tokens

Rule: Never hardcode `backdrop-filter`, `background`, or `border` values inline — always use tokens from `lib/ds.ts`.
Why: `lib/ds.ts` is the single source of truth; duplicating values breaks theme consistency when tokens change.

## 2026-05-17 — Icon usage

Rule: Always import icons from `lucide-react` by name — never hand-craft SVG paths.
Why: Hand-crafted SVGs are fragile, inaccessible by default, and visually inconsistent with the rest of the icon set.

## 2026-05-17 — shadcn/ui first

Rule: Always use shadcn/ui components for standard UI elements — never raw HTML tags.
Why: Raw `<button>`, `<input>`, `<select>` skip accessibility attributes, focus styles, and design token wiring that shadcn handles.

## 2026-05-17 — Notification system

Rule: Use **sonner** for all toast notifications — never `alert()` or custom toast components.
Why: sonner is already configured globally; duplicating toast infrastructure fragments the UX.

## 2026-05-17 — Middleware file naming

Rule: Do **not** create or reference `middleware.ts` — auth config lives in `auth.ts` and `auth.config.ts`.
Why: `middleware_old.ts` is legacy/unused; the active config is in `auth.ts`. Creating `middleware.ts` adds a duplicate that can conflict.

## 2026-05-17 — Multi-currency rate handling

Rule: Always store a `rateSnapshot` on documents at creation time — never recalculate from live rates later.
Why: Exchange rates fluctuate; historical documents must reflect the rate at the time of issue, not the current rate.

## 2026-06-13 — Mongoose `Mixed` fields need `markModified` on load-modify-save

Rule: When a route loads a doc, assigns a `Schema.Types.Mixed` (or array-with-Mixed) path, and calls `.save()`, also call `doc.markModified("path")`. `findByIdAndUpdate`/`$set` does NOT need it.
Why: Mongoose can't always auto-detect changes to Mixed values, so the change silently won't persist. (Invoice PUT uses `Object.assign` + `save`, so it marks `remarks`/`items`.)

## 2026-06-13 — Tiptap v3 packaging gotchas

Rule: StarterKit v3 ALREADY bundles Underline, Link, and the list extensions — don't re-install them. `Color` ships from `@tiptap/extension-text-style` (extension-color just re-exports it). Add `@tiptap/core` as a DIRECT dep so type imports (`AnyExtension`, `Content`, `JSONContent`) resolve under pnpm.
Why: Double-adding bundled extensions causes duplicate-extension warnings; importing a transitive `@tiptap/core` fails pnpm resolution.

## 2026-06-13 — Server-safe JSON→HTML for rich text

Rule: Render ProseMirror JSON to HTML with `@tiptap/static-renderer/pm/html-string` (`renderToHTMLString({ content, extensions })`) — it's DOM-free and uses the shared extension list. Always sanitize the output with isomorphic-dompurify before `dangerouslySetInnerHTML`, and externalize `isomorphic-dompurify` in `next.config.ts`.
Why: It runs identically on the server print route and the client preview (one render path = zero drift), and avoids needing a DOM to generate HTML.

## 2026-06-13 — Keep dep-free helpers out of jsdom-loading modules

Rule: Pure helpers (e.g. `richTextToPlainText`, `isEmptyRichText`) that server modules need go in a module with NO heavy imports (normalize.ts), then re-export from the render module. Don't make a server route import a module that top-level-imports isomorphic-dompurify just for a string helper.
Why: `isomorphic-dompurify` initializes jsdom at import time; pulling it into the AI assistant route is wasteful.

## 2026-06-13 — Rich-text editor styling shares ONE stylesheet at two scales

Rule: For editor ⇄ preview ⇄ PDF fidelity, use one scoped `.qs-rich` stylesheet with em-relative spacing (NOT Tailwind `prose`), placed UNLAYERED so it overrides Tailwind preflight. Set the base font-size per context (editor ~13px, document 8–9px); formatting stays identical, only absolute scale differs. Editor surface must use the active design's font so bold/italic embed instead of synthesizing.
Why: `prose` is rem-based and opinionated and fights an 8px print scale; a layered rule loses to preflight's list/heading resets.
