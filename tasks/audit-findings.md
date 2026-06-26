# QuoteSphere v2 — Full Application Security & Quality Audit

**Type:** Read-only investigation (no code changed). **Date:** 2026-06-25.
**Method:** First-hand control-plane review + a 16-agent read-only finder sweep across Phases 1–14, then a
71-candidate adversarial-refutation pass (19 false positives removed). Severities below are **re-calibrated
by hand** against the task's scale — the finder agents over-rated many items (e.g. 16 "CRITICAL" RBAC gaps);
within-tenant privilege issues are HIGH, and CRITICAL is reserved for cross-tenant exposure/modification,
auth bypass, snapshot mutation, or secret leakage.

**Baseline:** `pnpm build` ✅ passes (Next.js 16.2.9, 69 routes). `npx tsc --noEmit` ✅ clean.
`pnpm test` ❌ **1 failed / 187 passed** — `test/convert.test.ts` proves a real double-conversion defect (see CON-001).

---

## 1. Executive summary

The **tenant-isolation substrate is genuinely strong and the audit confirmed it holds**: every tenant model
applies the fail-closed `tenantScope` plugin, `resolveOrgScope` throws with no context, the aggregation
`$match` is prepended un-reorderably, `bypassTenant`/`platformRead`/`actOnTenant` are used correctly, the
platform portal 404s non-admins, `plan_snapshot` immutability holds (editing a Plan never cascades), payroll
period-lock + mark-paid are transaction-safe, and the AI `pendingAction`/8-iteration controls are enforced
server-side. The middleware (`proxy.ts`, the Next 16 rename) is live and correct.

The damage is **not** in the substrate but in **specific routes that sidestep it**. The most serious findings:

1. **Cross-tenant writes via `org_id` mass-assignment (CRITICAL).** The plugin only stamps `org_id` when it
   is `null`; routes that pass a raw body to `Model.create()` (`/api/products`, `/api/templates`, and the
   `/api/settings` `$set`) let a caller set `org_id` to **another tenant** and create/relocate records there.
2. **Cross-tenant data destruction via `Counter.deleteMany({})` (CRITICAL).** `Counter` is deliberately
   non-tenant-scoped, but `/api/settings/bulk-delete?type=all` calls it with an empty filter, wiping **every
   tenant's** document-numbering counters.
3. **RBAC is not enforced by the wrapper (HIGH, systemic).** `withTenant` checks auth + subscription + feature
   but **not role**; ~15 write routes never call `requireRole`, so a `viewer` can wipe their org's data,
   record/delete payments, convert quotations, send WhatsApp, and rewrite company settings.
4. **Integration secrets round-trip to the client (HIGH).** `GET /api/settings` returns the raw `integrations`
   object — WhatsApp/email/Cloudinary/AI **API keys in plaintext** — to any authenticated user (no role check).
5. **Entitlement/subscription gating is bypassed (HIGH)** on the AI-assistant and WhatsApp routes (they use
   `enterOrg` instead of `withTenant`), so a blocked/un-entitled tenant can still burn LLM/messaging cost.

Core money/payroll integrity and cross-tenant **reads** are sound. The cross-tenant **write** primitives above
plus the systemic RBAC gap are the priorities. None require architectural change — they are surgical fixes
(force-stamp `org_id`, scope the counter delete, add `requireRole`, strip secrets on read, gate the bypass routes).

---

## 2. Severity tally (hand-calibrated)

| Severity | Count | Headline items |
|---|---|---|
| **CRITICAL** | 2 | Cross-tenant create via `org_id` mass-assignment; cross-tenant `Counter` wipe |
| **HIGH** | 11 | Systemic RBAC gap; secrets in Settings GET/PUT; assistant/WhatsApp entitlement bypass; payroll loan direct-mutate; convert double-conversion; stale-session role; invite double-consume; XFF rate-limit bypass |
| **MEDIUM** | 24 | SSRF (assistant Host header, AI baseUrl, vision); platform lost-update/double-pay races; login enumeration/timing; pagination & index gaps; N+1s; WhatsApp webhook fail-open; rate-limit coverage; PII logging; dirty-guard & SWR gaps |
| **LOW** | 11 | duplicate `sku` index; no timeout/retry on Cloudinary/email/PDF; raw `<input>`/SVG/hardcoded colors; type drift; 30s cache window; build-time DB connect |
| **INFO** | 7 | payment webhook stub; duplicate WhatsApp webhook route; platform-read no-audit (by design); PlatformAuditLog no-TTL (correct); Google linking off (good); confirmed guarantees |

---

## 3. Findings by domain

> Each: **ID · Severity · Location · What · Why · Fix direction (described, not implemented) · Confidence · Effort.**

### Phase 1 — Tenant isolation

**TEN-001 · CRITICAL · [app/api/products/route.ts:38-39](app/api/products/route.ts#L38-L39), [app/api/templates/route.ts:29-31](app/api/templates/route.ts#L29-L31), root cause [lib/tenant-plugin.ts:59-64](lib/tenant-plugin.ts#L59-L64)**
*What:* POST handlers do `Model.create(await req.json())` on the raw body. The plugin's `validate` hook stamps
`org_id` **only when it is `null`** (`if (this.isNew && this[ORG_FIELD] == null)`), and `org_id` is a real
schema path (not stripped by strict mode).
*Why:* A caller can POST `{ "org_id": "<victim-org-id>", ... }` and create a Product/Template **inside another
tenant's** catalog — cross-tenant write / data pollution. This is the single most important class of finding.
*Fix:* Make the plugin **force-stamp** `org_id` to the current context on every insert (overwrite any client
value), and/or never pass raw bodies to `create` — validate with zod and omit `org_id` (the bulk routes
already do this correctly). *Confidence:* Confirmed. *Effort:* S (plugin) / M (sweep all create sites).

**TEN-002 · CRITICAL · [app/api/settings/bulk-delete/route.ts:57](app/api/settings/bulk-delete/route.ts#L57)**
*What:* For `type=all`, the handler calls `Counter.deleteMany({})`. `Counter` is intentionally **not**
tenant-scoped ([models/Counter.ts:9-11](models/Counter.ts#L9-L11)), so the empty filter is global. (The sibling
`Invoice/Quotation/…deleteMany({})` calls *are* plugin-scoped to the caller's org — those are within-tenant.)
*Why:* Any authenticated user of **any** org wipes the document-numbering counters of **all** tenants → number
collisions/resets across the whole platform. Compounded by TEN/RBAC-003 (no role check on this route).
*Fix:* Scope the delete to the caller's org explicitly (`Counter.deleteMany({ org_id })`), or reset only the
relevant counters. *Confidence:* Confirmed. *Effort:* S.

**TEN-003 · HIGH · [app/api/settings/route.ts:71-76](app/api/settings/route.ts#L71-L76)**
*What:* `PUT /api/settings` builds `$set = flattenObject(body)` from the unvalidated body and `findOneAndUpdate({}, {$set}, {upsert:true})`. A body `org_id` flattens into `$set.org_id`.
*Why:* On a matched update this rewrites the caller's Settings `org_id` to a victim org (cross-tenant relocate);
the `unique` index on `org_id` only partially mitigates (collision → E11000). Same root cause as TEN-001.
*Fix:* Strip `org_id`/`_id`/`__v` and validate with a zod schema before `$set`. *Confidence:* Confirmed. *Effort:* S.

**TEN-004 (holds) · INFO** — Confirmed SAFE by adversarial review: the query-hook regex covers find/count/update/delete/replace; `distinct`/`bulkWrite`/`insertMany`-with-raw-body are **not used anywhere** in the codebase; the aggregate `$match` prepend is un-reorderable; `populate` targets are all tenant-scoped models; `currency-rates` and `document-designs` upserts use only hardcoded `$set` keys (no body passthrough). Fail-closed behavior verified.

### Phase 2 — Authentication & session

**AUTH-001 · HIGH · [auth.ts:100-122](auth.ts#L100-L122)**
*What:* The `jwt` callback only sets `role`/`org_id` when a `user` object is present (sign-in); later requests
return the cached token unchanged. No `maxAge` set → 30-day default.
*Why:* A user demoted admin→viewer, moved orgs, or whose subscription changed keeps their old claims for up to
30 days. Failed offboarding / privilege-recovery window.
*Fix:* Re-resolve `role`/`org_id` from the DB on token refresh (or short-TTL the token / add a token-version
check invalidated on role/org change). *Confidence:* Confirmed. *Effort:* M.

**AUTH-002 · MEDIUM · [auth.ts:39](auth.ts#L39) vs [auth.ts:44](auth.ts#L44)**
*What:* Tenant Credentials provider throws distinct "No account found" vs "Incorrect password"; the missing-user
path returns before `bcrypt.compare` (timing oracle too). (`platform-credentials` is already generic.)
*Why:* User/-org enumeration via direct API calls (the login UI masks it, but the API differentiates).
*Fix:* Return one generic message for both, and run a dummy bcrypt compare on the missing-user path. *Confidence:* Confirmed. *Effort:* S.

**AUTH-003 · MEDIUM · [lib/rate-limit.ts:69-73](lib/rate-limit.ts#L69-L73)**
*What:* `getClientIP` trusts the first `x-forwarded-for` value with no validation; used as the login/register/platform-login rate-limit key.
*Why:* An attacker rotates `X-Forwarded-For` to get a fresh bucket per request → brute-force past the 10/15min limit. (Vercel sets a trusted XFF, but the code takes the client-influenced first hop.)
*Fix:* Derive the client IP from the trusted platform header/connection, not arbitrary XFF. *Confidence:* Confirmed. *Effort:* S.

**AUTH-004 · MEDIUM · [auth.ts:138](auth.ts#L138)** — No session `maxAge` configured (30-day JWT). Widens the window for AUTH-001 and stolen-token reuse. *Fix:* set a shorter `maxAge` + rotation. Confirmed / S.

**AUTH-005 · MEDIUM · [auth.ts:117-119](auth.ts#L117-L119)** — Stale `org_id` claim survives org transfer/deletion (latent; compounds AUTH-001). Confirmed / M.

**AUTH-006 (holds) · INFO** — Google provider does **not** set `allowDangerousEmailAccountLinking` (defaults off) — safe. (The project doc note saying it's on is stale.) `proxy.ts` is the **active** Next 16 middleware and its `authorized` allowlist is correct. *Note:* a finder/verifier wrongly claimed `proxy.ts` "has no effect" — that reasoning assumed Next ≤15's `middleware.ts`; it is incorrect for Next 16.2.9.

### Phase 3 — Subscriptions / billing / entitlements

**BILL-001 · HIGH · [app/api/assistant/chat/route.ts:57-64](app/api/assistant/chat/route.ts#L57-L64), assistant/rewrite, whatsapp/*** 
*What:* These routes use `enterOrg(orgId)` instead of `withTenant`, so they skip the 402 subscription-status
gate and the 403 `ai_assistant`/`messaging` feature gate.
*Why:* A blocked/expired or un-entitled tenant can still invoke billable LLM calls and send WhatsApp messages —
entitlement-boundary bypass at the API (UI gating is not enforcement).
*Fix:* Wrap these in `withTenant` (or call `resolveEntitlements` + status/feature checks before any provider
call). *Confidence:* Confirmed. *Effort:* M.

**BILL-002 (holds) · INFO** — Confirmed SAFE: `plan_snapshot` immutability holds (Plan edits never cascade);
`invalidateEntitlements` is called on cron + platform actions; the entitlement cache is per-org; `billing/change-request`
only writes `pending_change` (no self-escalation); `computeEffectiveStatus` boundaries and `VALID_TRANSITIONS` are correct.

**BILL-003 · LOW · [lib/entitlements/resolve.ts:22](lib/entitlements/resolve.ts#L22)** — 30s in-process entitlement cache means a just-suspended tenant keeps access up to 30s on instances that didn't run the invalidation. Currently single-instance (Vercel), so low impact; revisit before horizontal scale (use a shared cache or pub/sub invalidation). Confirmed / M.

### Phase 4 — Platform owner portal

**PLAT-001 (holds) · INFO** — Confirmed SAFE: all `/api/platform/**` use `withPlatform` (404 to non-admins);
`platformRead` bypass always pairs with explicit filters; `actOnTenant` re-enters the target org's fail-closed
scope; state-changing actions write `PlatformAuditLog`; `PlatformAuditLog` has no TTL and no tenant plugin (correct).
*Observation (INFO):* platform **read** routes don't write audit entries — acceptable (reads), but consider an
access log for cross-tenant reads if compliance requires it.

### Phase 5 — Payroll integrity

**PAY-001 · HIGH · [app/api/payroll/loans/[id]/route.ts:9-17,31-48](app/api/payroll/loans/[id]/route.ts#L9-L48)**
*What:* The loan `PUT` schema allows `remainingBalance` and `status` and applies them via `Object.assign(loan, data); save()` with no guard.
*Why:* An admin can set `status:"closed"` or change `remainingBalance` directly, bypassing the mark-paid
deduction path — orphaning applied payslip deductions or zeroing a balance without payment. Payroll integrity.
*Fix:* Make `remainingBalance` server-derived only (never client-settable); restrict status transitions; disallow
editing loans referenced by paid payslips. *Confidence:* Confirmed. *Effort:* M.

**PAY-002 (holds) · INFO** — Confirmed SAFE: payslips snapshot employee + components + config + `fxRate` at run
time and are immutable; period-lock `(org_id, period_lock)` unique partial index + `E11000`→409 backstops the
TOCTOU; mark-paid is a single transaction with loan decrements protected by the run-doc write-conflict; FX
missing-rate throws before any `fxRate=0` is recorded; employee/structure/period deletes are blocked when referenced.

### Phase 6 — AI assistant safety

**AI-001 · HIGH** — Same as BILL-001 (no subscription/feature gate on assistant routes).

**AI-002 · MEDIUM · [app/api/assistant/chat/route.ts](app/api/assistant/chat/route.ts), [lib/assistant/agent.ts:21](lib/assistant/agent.ts#L21)** — No per-request/per-tenant rate limit or token-cost cap; `MAX_ITERATIONS=8` bounds call count, not token spend. Cost-abuse vector. *Fix:* add `rateLimit` keyed by org/user + a token budget. Confirmed / M.

**AI-003 · MEDIUM · [lib/assistant/base-url.ts:12](lib/assistant/base-url.ts#L12), [lib/assistant/executor.ts:30-59](lib/assistant/executor.ts#L30-L59)** — `getBaseUrl` derives the self-call origin from `Host`/`X-Forwarded-Host`; `selfFetch` forwards the **session cookie** to that origin. A spoofed Host (where not normalized upstream) → session-cookie exfiltration / SSRF. *Fix:* use the env origin (`NEXTAUTH_URL`) for server-to-server self-calls, not request headers. Confirmed / S.

**AI-004 · MEDIUM · [lib/assistant/vision.ts:46-114](lib/assistant/vision.ts#L46-L114)** — User-supplied image URLs are passed to the LLM provider to fetch (`z.url()` validates syntax only). Provider-side SSRF / metadata-endpoint reach is possible. *Fix:* restrict to your own Cloudinary/host or pre-fetch+validate. Confirmed / M.

**AI-005 (holds) · INFO** — Confirmed SAFE: `pendingAction` requires id match; merged form values are restricted to a **hardcoded** allowlist of keys (not user-derived); the 8-iteration cap is server-enforced; tools mutate only via cookie-forwarded calls to the app's own `withTenant`+`requireRole`-gated routes (so RBAC/tenant still apply downstream — though see AI-003 for the cookie-forward risk).

### Phase 7 — RBAC (systemic — HIGH)

**RBAC-001 · HIGH · [lib/with-tenant.ts:29-71](lib/with-tenant.ts#L29-L71) + the routes below**
*What:* `withTenant` enforces auth + subscription + feature, but **never role**. Role is each handler's job via
`requireRole`/`requireAdmin`, and many write handlers omit it. A `viewer` (read-only per [lib/rbac.ts:13-18](lib/rbac.ts#L13-L18))
can perform create/update/delete on:

| Route | Methods missing `requireRole` | Impact |
|---|---|---|
| [settings/bulk-delete](app/api/settings/bulk-delete/route.ts#L18) | DELETE | **wipe entire org's data** (+ cross-tenant counters, TEN-002) |
| [settings](app/api/settings/route.ts#L57) | PUT | rewrite company config + integration secrets |
| [settings/document-designs](app/api/settings/document-designs/route.ts#L23) + `[id]` | POST/PUT/PATCH/DELETE | alter org-wide doc branding |
| [settings/currency-rates](app/api/settings/currency-rates/route.ts) | POST | change FX used in all invoices/quotes |
| [products](app/api/products/route.ts#L33) + `[id]` | POST/PUT/DELETE | mutate catalog/pricing |
| [templates](app/api/templates/route.ts#L24) + `[id]` | POST/PUT/DELETE | inject content into comms |
| [invoices/[id]/payments](app/api/invoices/[id]/payments/route.ts#L9) | POST/DELETE | **financial fraud** (record/delete payments) |
| [quotations/[id]/convert](app/api/quotations/[id]/convert/route.ts#L10) | POST | create billable invoices |
| [projects/[id]/attachments](app/api/projects/[id]/attachments/route.ts#L8) & [notes](app/api/projects/[id]/notes/route.ts#L8) | POST/DELETE | tamper project history |
| [upload](app/api/upload/route.ts#L7) | POST | consume Cloudinary quota |
| [whatsapp/messages](app/api/whatsapp/messages/route.ts#L47), send-document, [mark-read](app/api/whatsapp/mark-read/route.ts#L14), [conversations](app/api/whatsapp/conversations/route.ts#L117) DELETE | POST/DELETE | send/spam, hide, delete customer comms |
| [assistant/rewrite](app/api/assistant/rewrite/route.ts#L15) | POST | — |

*Why:* In-tenant privilege escalation beyond the user's RBAC role; `bulk-delete` and `payments` are the worst.
All are org-scoped (no cross-tenant read), hence HIGH not CRITICAL.
*Fix:* Either make `withTenant` apply the default method→operation `requireRole` automatically (with per-route
overrides), or add `requireRole(session, req.method[, "settings"])` to each handler above. *Confidence:* Confirmed. *Effort:* M.

### Phase 8 — Input validation & API contracts

**VAL-001 · HIGH · [app/api/settings/route.ts:57-76](app/api/settings/route.ts#L57-L76)**
*What:* `PUT /api/settings` accepts an unvalidated body and recursively `flattenObject`-merges every key,
including `integrations.*.apiKey/apiSecret/smtp.*/aiAssistant.apiKey`.
*Why:* Any user can write/overwrite integration secrets (redirect email/WhatsApp to attacker infra, set
`aiAssistant.baseUrl` to an internal address → SSRF via AI-004/EXT-006), plus the TEN-003 `org_id` vector.
*Fix:* zod-validate the settings shape; never accept secrets via the generic settings PUT (dedicated, role-gated,
write-only secret endpoints). *Confidence:* Confirmed. *Effort:* M.

**VAL-002 · MEDIUM · invoices/[id] PUT, quotations/[id] PUT, expenses/[id], projects/[id], time-entries/[id], services/[id], products, milestones/[milestoneId]**
*What:* These PUTs spread the body (loose `z.record` or none) into the model. Most strip `org_id/_id/__v` and
Mongoose strict mode drops unknown keys, so cross-tenant/schema-escape is blocked.
*Why:* Residual **business-field tampering** — a client can set `status`, `total_amount`, `customer_id`, prices,
etc. to arbitrary valid-typed values. *Fix:* per-route zod schemas with explicit allowed fields. Confirmed / M.

**VAL-003 (holds) · INFO** — Confirmed SAFE: bulk customer/product/service routes validate with zod (no `org_id`
field) — the correct pattern; `projects/[id]` PUT mass-assignment is neutralized by strict mode.

### Phase 9 — Concurrency, races & idempotency

**CON-001 · HIGH · [app/api/quotations/[id]/convert/route.ts:24-69](app/api/quotations/[id]/convert/route.ts#L24-L69)** — *(test-confirmed)*
*What:* The "already invoiced?" check (line 26) and the create-invoice transaction (64-69) are a check-then-act
with **no unique constraint on `Invoice.converted_from`**. `test/convert.test.ts` fails: a second convert returns
200 (expected 400), and an internal `DocumentNotFoundError` at line 65 is swallowed.
*Why:* Concurrent or retried converts create **duplicate invoices** from one quotation — revenue/audit corruption.
*Fix:* Add a unique index on `(org_id, converted_from)` and/or do the status flip atomically
(`findOneAndUpdate({_id, status:{$ne:"invoiced"}}, …)`); fix the swallowed-error 200. *Confidence:* Confirmed (failing test). *Effort:* M.

**CON-002 · HIGH · [lib/provisioning.ts:79-101](lib/provisioning.ts#L79-L101)** — TenantInvite consumption is a non-atomic read-modify-write; concurrent OAuth first-logins can consume one invite twice (trial/plan-override abuse). *Fix:* atomic `findOneAndUpdate({_id, status:"pending"}, {$set:{status:"consumed"}})`. Confirmed / S.

**CON-003 · MEDIUM · [lib/provisioning.ts:32-44](lib/provisioning.ts#L32-L44), [auth.ts:118](auth.ts#L118)** — `ensureUserOrg` reads `org_id` then creates org+sub non-atomically → concurrent first-logins create **duplicate orgs + trial subscriptions** for one user. *Fix:* unique index on `Organization.owner_user_id` (or atomic guarded update). Confirmed / M.

**CON-004 · MEDIUM · [app/api/platform/tenants/[id]/actions/route.ts:134-147](app/api/platform/tenants/[id]/actions/route.ts#L134-L147)** — Platform `mark_paid` creates a `PaymentRecord` with no idempotency key; the partial-unique `(provider, provider_ref)` index **exempts null `provider_ref`** ([models/PaymentRecord.ts:56-59](models/PaymentRecord.ts#L56-L59)), so a double-click logs two payments. *Fix:* require/synthesize an idempotency key; include manual records in the unique constraint. Confirmed / S.

**CON-005 · MEDIUM · [app/api/platform/tenants/[id]/actions/route.ts:78-205](app/api/platform/tenants/[id]/actions/route.ts#L78-L205)** — Subscription mutations are read-modify-`save()` with `versionKey:false` (no optimistic lock); a concurrent admin action + cron expiry can lose an update. *Fix:* optimistic version or targeted `$set`. Confirmed / M.

**CON-006 · MEDIUM · [app/api/billing/change-request/route.ts:30-76](app/api/billing/change-request/route.ts#L30-L76)** — `pending_change` POST/DELETE race (read-modify-write). Low blast radius. Confirmed / S.

**CON-007 · MEDIUM · [app/api/cron/recurring-invoices/route.ts:45-99](app/api/cron/recurring-invoices/route.ts#L45-L99)** — No lock/processing flag; overlapping runs (manual trigger + schedule, or run >interval) can double-generate invoices. *Fix:* claim each source atomically before generating (`findOneAndUpdate` advancing `next_date`). Confirmed / M.

**CON-008 (holds) · INFO** — Confirmed SAFE: invoice payment add/delete uses an **atomic aggregation-pipeline** `findOneAndUpdate` (not read-modify-write); `Counter.getNextNumber` is atomic `$inc`; the cron subscription job excludes `suspended`/`expired` from its query so it can't un-suspend an admin action.

### Phase 10 — Scale & performance

**SCALE-001 · MEDIUM** — Unbounded list endpoints (return all org rows, no `limit`): [products](app/api/products/route.ts#L26), [services](app/api/services/route.ts#L36), [templates](app/api/templates/route.ts#L17), [time-entries](app/api/time-entries/route.ts#L29), [payroll/loans](app/api/payroll/loans/route.ts#L32), [whatsapp/conversations](app/api/whatsapp/conversations/route.ts#L45). (The main invoice/quote/customer/expense/project lists *do* paginate.) *Fix:* add `page/limit` (default 50, max 200). Confirmed / M.

**SCALE-002 · MEDIUM** — Hot tenant collections declare compound indexes that **don't lead with `org_id`**
(Invoice/Quotation/Expense/Project `customer_id|status|payment_status`; Customer `phone_no`/text; Product/Service
`category`; TimeEntry; WhatsAppMessage). Isolation still holds (filter injects `org_id`), but the planner can't
use them for org-scoped reads → cross-tenant index scans at scale. *Fix:* make compound indexes `{ org_id, … }`-leading. Confirmed / M.

**SCALE-003 · MEDIUM** — N+1 loops: [customers/[id]](app/api/customers/[id]/route.ts#L38-L42) detail (3 unbounded arrays), [reminders cron](app/api/cron/reminders/route.ts) per-invoice customer lookup, [mark-paid](app/api/payroll/runs/[id]/mark-paid/route.ts#L41-L50) per-payslip loan lookup, [whatsapp/conversations](app/api/whatsapp/conversations/route.ts#L45-L114). *Fix:* batch with `$in` + maps. Confirmed / M.

**SCALE-004 · MEDIUM · [app/api/export/route.ts:103-124](app/api/export/route.ts#L103-L124)** — In-memory export with a 10k cap, no streaming. Large tenants hit memory/latency walls. *Fix:* stream/batch. Confirmed / M.

**SCALE-005 · LOW · [models/Product.ts](models/Product.ts)** — Duplicate `sku` index (field-level `index:true` + `schema.index`) — Mongoose warns at boot. *Fix:* declare once. Confirmed (build log) / S.

### Phase 11 — External integrations & secrets

**SEC-001 · HIGH · [app/api/settings/route.ts:51](app/api/settings/route.ts#L51)**
*What:* `GET /api/settings` returns `{ ...settings, … }` — the raw `integrations` subtree, i.e. WhatsApp/email/
Cloudinary/AI **API keys & secrets in plaintext** — and has **no `requireRole`** (any role, incl. viewer).
*Why:* Secrets that should be write-only round-trip to the browser/network for any authenticated org member.
(Note: the GET *adds* boolean `*Configured` flags but does not strip the underlying secrets.)
*Fix:* never return secret fields; serve only masked booleans / last-4; gate read behind admin. *Confidence:* Confirmed. *Effort:* M.

**SEC-002 · MEDIUM · [lib/email.ts:65](lib/email.ts#L65), AI provider keys** — `RESEND_API_KEY`/`ANTHROPIC_API_KEY`/`OPENAI_API_KEY` env fallbacks mean a tenant **without** its own configured key silently uses the **platform's** key (platform pays / emails sent from platform identity). Acceptable only as an explicit platform default; today it's implicit. *Fix:* require per-tenant config or log + meter the fallback. Confirmed / M.

**SEC-003 · MEDIUM · [app/api/webhooks/whatsapp/route.ts:55](app/api/webhooks/whatsapp/route.ts#L55), [lib/email.ts:130](lib/email.ts#L130)** — PII in logs: the WhatsApp webhook logs raw inbound payloads (phone numbers, message bodies); Resend errors log full response. *Fix:* log metadata only. Confirmed / S.

**SEC-004 · MEDIUM · [lib/assistant/providers/index.ts:50](lib/assistant/providers/index.ts#L50), [lib/assistant/vision.ts:66](lib/assistant/vision.ts#L66)** — Per-tenant `baseUrl`/`azureEndpoint` come from Settings with no host validation → SSRF (reachable today by any user via VAL-001). *Fix:* allowlist HTTPS provider hosts; reject private IPs. Confirmed / M.

**SEC-005 (holds) · INFO** — Confirmed SAFE: Cloudinary/WhatsApp credentials are per-tenant from DB (not env); the PDF print token is HMAC-signed (60s TTL, timing-safe); PDF navigation URL is env-derived (no user-SSRF); no tenant secret is exposed via `NEXT_PUBLIC_*`.

### Phase 12 — Audit logging & rate limiting + webhooks

**WH-001 · MEDIUM · [app/api/webhooks/whatsapp/route.ts:15-26](app/api/webhooks/whatsapp/route.ts#L15-L26)** — HMAC verification **fails open** when `WHATSAPP_WEBHOOK_SECRET` is unset (returns `true` + warns), and the single-enabled-org fallback ([:91-100](app/api/webhooks/whatsapp/route.ts#L91-L100)) attributes any payload to that org. → forged inbound messages. *Fix:* fail closed if the secret is missing; require exact phone-number match. Confirmed / S.

**RL-001 · MEDIUM · [lib/rate-limit.ts](lib/rate-limit.ts)** — Rate limiting is applied only to login/platform-login/register. **No** limit on: AI chat (LLM cost), WhatsApp send, email send, PDF generation, upload, export. *Fix:* add `rateLimit` keyed by org/user on these abusable endpoints. Confirmed / M.

**AUD-001 · MEDIUM · [app/api/billing/change-request/route.ts](app/api/billing/change-request/route.ts), whatsapp/assistant sends** — Sensitive actions without an audit entry: tenant plan-change requests, WhatsApp sends, assistant-driven mutations, uploads. *Fix:* `recordAudit` on these. Confirmed / M.

**AUD-002 · MEDIUM · [app/api/cron/*/route.ts](app/api/cron/)** — `CRON_SECRET` bearer check uses plain string comparison (timing) and crons aren't rate-limited. *Fix:* constant-time compare. Confirmed / S.

**AUD-003 · LOW · [lib/audit.ts:6-20](lib/audit.ts#L6-L20)** — `OMIT_KEYS` is a denylist; it *does* currently strip `integrations` (so secrets don't reach the audit trail — the finder's "secret leak to audit" claim is mitigated), but a future secret field outside that list would leak. *Fix:* recursive leaf-level secret sanitization. Confirmed / S.

**WH-002 (holds) · INFO** — Duplicate WhatsApp webhook routes ([webhooks/whatsapp](app/api/webhooks/whatsapp/route.ts) is public; [whatsapp/webhook](app/api/whatsapp/webhook/route.ts) sits under the authed matcher → effectively dead externally) — clarify/remove one. Payment webhook `webhooks/payments/[provider]` is an unauthenticated **501 stub** (planned work — INFO, not a live bug). `PlatformAuditLog` has no TTL (correct, immutable); tenant `AuditLog` TTL is 2 years.

### Phase 13 — Frontend correctness

**FE-001 · MEDIUM · [hooks/use-dirty-guard.ts](hooks/use-dirty-guard.ts), editable sheets** — The mandated `useDirtyGuard` is **underutilized**: only `CustomerFormDialog` consumes it; ~10 sheets (products/services/payroll/platform) use a different `useUnsavedChanges`+manual `AlertDialog`, `DocumentBuilder` wires its own `beforeunload`, and [AssistantSettingsSheet](components/assistant/assistant-settings-sheet.tsx) has **no** guard at all. *Why:* inconsistent coverage of close/ESC/backdrop/`beforeunload`/`popstate`/in-app-nav → silent data loss on some surfaces (esp. AssistantSettingsSheet). *Fix:* migrate all editable sheets to the shared hook. Confirmed / M.

**FE-002 · MEDIUM · invoices/expenses/quotations list pages; [invoices/[id] payment delete](app/(app)/invoices/[id]/page.tsx#L208-L211)** — Some mutations (delete/update, payment delete) lack `res.ok` checks / try-catch → silent failures with no `sonner` error toast. (Coverage is good on the major list pages — see SWR-003 hold.) *Fix:* validate response + error toast everywhere. Confirmed / S.

**FE-003 · LOW** — shadcn/ds drift: raw `<input>`/`<textarea>` in [assistant/page.tsx](app/(app)/assistant/page.tsx), hand-crafted `<svg>` in [invoices/[id]/page.tsx](app/(app)/invoices/[id]/page.tsx), hardcoded `#ef4444`/`#f87171` in [customers/page.tsx](app/(app)/customers/page.tsx) instead of `lib/ds.ts` tokens. Confirmed / S.

**FE-004 (holds) · INFO** — SWR usage and loading/empty/error UI are comprehensive across the major list pages; client/server zod schemas largely match (minor customer-form drift — FORM-001, LOW).

### Phase 14 — Type safety & tests

**TYPE-001 · MEDIUM · app/api/** (≈189 `: any`/`as any`)** — Heavy `any`/`as any` use, including security-sensitive spots (platform actions, billing). Erodes the type guarantees the rest of the codebase relies on. *Fix:* introduce typed request/response envelopes; remove `as any` in platform/billing/auth first. Confirmed / M.

**TYPE-002 · LOW** — Model interfaces/enums (`AuditAction`, `PayrollRunStatus`, `LoanStatus`, …) live in `models/*` instead of `types/index.ts` (project convention). Confirmed / S.

**TEST-001 · MEDIUM** — Highest-risk **untested** paths: rate-limit enforcement, webhook HMAC verification, RBAC beyond `team`, route-level entitlement gating, payment/mark-paid idempotency, AI tool safety/permission, grace-period clock edges, and **the cross-tenant `org_id` mass-assignment (TEN-001) and counter-wipe (TEN-002)**. These are exactly the surfaces with confirmed findings. *Fix:* add targeted tests as each fix lands. Confirmed / M.

**TEST-002 · HIGH** — The existing suite has a **failing** test (`test/convert.test.ts`, see CON-001) — a real regression in the build, not a flaky test. *Fix:* covered by CON-001. Confirmed / —.

---

## 4. Cross-cutting themes

1. **The wrapper enforces tenant + subscription + feature, but not role.** RBAC is bolted on per-handler and
   inconsistently — the single largest source of HIGH findings. Centralizing role enforcement in `withTenant`
   (with overrides) would close ~12 routes at once.
2. **Raw `req.body` reaches the data layer.** `Model.create(body)` / `flattenObject(body)` / spread-into-`$set`
   produce the two CRITICALs (org_id mass-assignment) plus the secret-write and business-field-tampering issues.
   A consistent "validate-with-zod, never pass raw body, never accept `org_id`" rule fixes the class.
3. **A handful of routes opt out of the safe wrapper** (`enterOrg`/manual `auth`) — assistant, WhatsApp, export,
   cloudinary-test — and thereby skip subscription gating, feature gating, and (mostly) rate limiting.
4. **Secrets are treated as ordinary fields** — returned by Settings GET, accepted by Settings PUT, fall back to
   shared env keys. Secrets need a write-only, role-gated, masked-on-read path.
5. **Read-modify-write where atomic ops belong** — convert, invite consumption, org bootstrap, platform
   mark_paid / subscription save, recurring cron. The substrate already uses transactions/atomic updates well in
   payroll and payments — extend that discipline to these.
6. **Isolation correctness is excellent; the gaps are at the edges** (one non-scoped `Counter` delete, one
   conditional org_id stamp). Small, surgical fixes close the cross-tenant exposure.

---

## 5. Top 10 prioritized remediation backlog (severity × reach)

1. **Force-stamp `org_id` in the tenant plugin on every insert** + stop passing raw bodies to `create` — closes **TEN-001 / TEN-003** (CRITICAL, cross-tenant write).
2. **Scope `Counter.deleteMany` to the caller's org** in bulk-delete — closes **TEN-002** (CRITICAL).
3. **Enforce RBAC in `withTenant`** (default method→op `requireRole`, per-route overrides) — closes **RBAC-001** across ~12 routes incl. bulk-delete, payments, convert.
4. **Stop returning integration secrets** from Settings GET and **stop accepting them** via the generic Settings PUT (write-only, role-gated, masked) — closes **SEC-001 / VAL-001**.
5. **Wrap assistant + WhatsApp routes in `withTenant`** (or add status+feature checks) — closes **BILL-001 / AI-001** entitlement bypass; add rate limits (**RL-001 / AI-002**).
6. **Fix quotation→invoice convert** (unique `converted_from`, atomic status flip, stop swallowing the error) — closes **CON-001** (failing test).
7. **Re-resolve role/org on token refresh + set session `maxAge`** — closes **AUTH-001 / AUTH-004 / AUTH-005**.
8. **Guard payroll loan mutation** (server-derived balance, restricted status) — closes **PAY-001**.
9. **Make consumption/bootstrap/payment ops atomic** (invite, `ensureUserOrg`, platform `mark_paid`, recurring cron) — closes **CON-002…007**.
10. **SSRF + egress hardening + PII logging** (env origin for `selfFetch`; allowlist AI `baseUrl`/vision URLs; fail-closed WhatsApp webhook; strip PII logs; add timeouts) — closes **AI-003/004, SEC-003/004, WH-001**.

(Then the scale tier: org-leading indexes, pagination on the unbounded lists, N+1 batching — **SCALE-001…004**.)

---

## 6. Open questions for the owner

1. **Multi-tenant `User`/`Counter` model:** `User` is intentionally multi-org and `Counter` is intentionally
   non-scoped — confirm the intended model so the TEN-001/002 fixes (force-stamp + org-scoped counter delete)
   match your roadmap (e.g. future "one user, many orgs").
2. **Settings secrets:** do you want a dedicated secrets/vault path now, or an interim "mask on read + admin-only
   write" on the existing Settings route?
3. **Deployment topology:** single-instance (Vercel) today — confirm, so I can scope the 30s entitlement-cache
   window (BILL-003) correctly (shared cache only needed once horizontally scaled).
4. **`bulk-delete` / `export`:** are these intended as admin-only power tools? That decides whether to add
   `requireRole("settings")` + confirmation + rate limit, or remove them from the tenant API.
5. **Env provider-key fallbacks:** keep `RESEND/ANTHROPIC/OPENAI` env keys as a platform default for un-configured
   tenants (metered), or require per-tenant keys?

---

*Investigation only — no code, schema, config, or dependency was changed. Tell me which findings (or which
backlog batches) to turn into phased implementation prompts, and I'll prepare them one approved batch at a time.*
