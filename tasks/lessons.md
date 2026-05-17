# Lessons — QuoteSphere v2

<!-- Format:
## YYYY-MM-DD — Short description
Rule: one-line rule.
Why: reason.
-->

<!-- Review this file at the start of every session before writing any code. -->

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
