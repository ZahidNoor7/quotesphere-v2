<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

## Project Overview

**Viafone Agent OS Frontend** — Next.js 16 App Router application serving the management UI for a multi-tenant enterprise AI orchestration platform.

Tech stack: Next.js 16, React 19, TypeScript 6 (strict), Tailwind v4 (CSS-first — no `tailwind.config.ts`), shadcn/ui, Zustand 5, TanStack Query v5, Axios, Zod 4, Framer Motion, Lucide React.

---

## Route Structure

```text
app/
  (auth)/             public, unauthenticated
    login/
    signup/
    forgot-password/
  (dashboard)/        SUPER_ADMIN only
    page.tsx          root dashboard
    tenants/
    capabilities/
    orchestrator/
    api-logs/
    settings/
  (workspace)/        TENANT_ADMIN and MEMBER
    workspace/
      customers/
      settings/
```

`proxy.ts` (at the repo root — **not** `middleware.ts`) handles role-based routing. It reads JWT claims from the `viafone-token` cookie and redirects SUPER_ADMIN to `(dashboard)` and TENANT_ADMIN/MEMBER to `(workspace)`. Never add auth or routing logic to individual page files — the backend enforces authorization too, but `proxy.ts` prevents broken UI states. Do **not** create a `middleware.ts`; it will conflict.

---

## Naming Conventions

| Artifact | Convention | Example |
| --- | --- | --- |
| Components | PascalCase, co-located with domain | `components/capabilities/CapabilityCard.tsx` |
| Hooks | camelCase with `use` prefix | `lib/hooks/useIngestion.ts` |
| Stores | camelCase with `.store` suffix | `lib/stores/auth.store.ts` |
| API clients | lowercase hyphen-separated | `lib/api/capability-drafts.ts` |
| Types | centralized in `lib/types.ts` | — |
| Pages | `page.tsx` | `app/(dashboard)/tenants/page.tsx` |
| Layouts | `layout.tsx` | `app/(dashboard)/layout.tsx` |

---

## Import Conventions

Always use the `@/` path alias (maps to repo root). Never use relative paths like `../../lib`.

```ts
// Correct
import { useAuthStore } from "@/lib/stores/auth.store"
import type { Tenant } from "@/lib/types"
import { apiClient, toArray } from "@/lib/api/client"

// Wrong
import { useAuthStore } from "../../lib/stores/auth.store"
```

---

## API Layer

All API calls use the shared Axios instance at `lib/api/client.ts`:

- Base URL: `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3001/api/v1`)
- Auth: JWT injected automatically from `localStorage` by the request interceptor
- 401 responses: interceptor clears token and redirects to `/login`

One file per feature domain in `lib/api/`. Standard function signature:

```ts
// lib/api/tenants.ts
export const tenantsApi = {
  list:   ()                      => apiClient.get<Tenant[]>("/tenants").then(r => toArray<Tenant>(r.data)),
  get:    (id: string)            => apiClient.get<Tenant>(`/tenants/${id}`).then(r => r.data),
  create: (dto: CreateTenantDto)  => apiClient.post<Tenant>("/tenants", dto).then(r => r.data),
}
```

**Always wrap list responses with `toArray<T>()`** (`lib/api/client.ts:10`). The backend may return either `T[]` or `{ data: T[] }` depending on the endpoint — the helper normalizes both shapes. Forgetting this is the #1 source of runtime errors on list pages.

---

## State Management

| Concern | Tool | Location |
| --- | --- | --- |
| Auth session (user, token, role) | Zustand + persist | `lib/stores/auth.store.ts` |
| Active tenant context | Zustand | `lib/stores/tenant.store.ts` |
| Server data (lists, single records) | TanStack Query `useQuery` | `lib/hooks/` |
| Mutations (create / update / delete) | TanStack Query `useMutation` | `lib/hooks/` |
| Local UI state (open/closed, form step) | React `useState` | component file |

Rules:

- Never fetch inside `useEffect` + `useState` — always `useQuery`.
- Never put server data in Zustand. Zustand is only for auth session and tenant context.
- Default `staleTime` is 30 seconds (configured in `components/providers.tsx`). Override per query when needed.

---

## Component Patterns

### Server Components (default in App Router)

Use for: static layouts, page shells, data-fetching wrappers that pass data as props.
Do not use: hooks, event listeners, browser APIs.

### Client Components (`"use client"` directive)

Use for: anything with hooks, interactivity, or browser APIs.
Place the `"use client"` directive at the very top of the file, before any imports.

### shadcn/ui

Components live in `components/ui/`. Never edit them directly. Compose variants at the call site using `cn()` and Tailwind utilities:

```ts
import { cn } from "@/lib/utils"
```

### Design System

Design language: **iOS 26 Liquid Glass + Enterprise glassmorphism**. Key CSS variables (defined in `app/globals.css`):

| Token | Purpose |
| --- | --- |
| `--glass-bg`, `--glass-border`, `--glass-shadow`, `--glass-blur` | Glassmorphism surface |
| `--accent` (`#6366f1`), `--accent-light` (`#818cf8`) | Primary brand colours |
| `--font-sans` (Inter), `--font-mono` (JetBrains Mono) | Typography |

Use Tailwind semantic utilities (`bg-card`, `text-foreground`, `border-border`) that map to the CSS variable tokens. Do not add inline `style` props for colours.

---

## SSE Streaming

The orchestrator endpoint streams Server-Sent Events. Use the existing `useOrchestratorStream` hook at `lib/hooks/useOrchestratorStream.ts` — it wraps `eventsource-parser`. Do not reimplement SSE parsing. Event types are defined in `lib/types.ts` as `OrchestratorStreamEvent`.

---

## TypeScript Rules

- `strict: true` across the board — no `any`, no `object` at component or hook boundaries
- All shared types live in `lib/types.ts` unless genuinely local to a single file
- Form validation uses Zod; derive types from schemas with `z.infer<typeof schema>` — do not duplicate into separate `interface` declarations
- Never use `as` to silence type errors — fix the underlying type

---

## Files That Require Care

| File | Why |
| --- | --- |
| `proxy.ts` | Role-based routing — changes affect all navigation |
| `lib/api/client.ts` | Shared Axios instance with interceptors — changes affect every API call |
| `lib/stores/auth.store.ts` | Persisted auth — changes may invalidate stored sessions |
| `app/layout.tsx` | Root layout — changes affect font loading and provider wrapping |
| `components/providers.tsx` | QueryClient config and ThemeProvider — changes affect global data behaviour |
