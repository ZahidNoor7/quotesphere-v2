# QuoteSphere v2 — Audit Remediation: Phased Implementation Prompts

Source: [tasks/audit-findings.md](audit-findings.md). Sequenced CRITICAL → HIGH → races → scale.
**Each phase below is a self-contained brief to execute on your approval — one batch at a time.** Nothing here is
implemented yet. Design decisions you confirmed are baked in:

- **Counter delete → org-scoped** (never global).
- **Secrets → mask-on-read + admin-write** on the existing Settings route (no new vault layer now).
- **`bulk-delete` / `export` → admin-only** (`requireRole("settings")` + confirmation + rate limit).
- **Env provider keys (RESEND/ANTHROPIC/OPENAI) → kept** as platform default for un-configured tenants, but **logged/metered**.

Global guardrails for every phase: keep `pnpm build` + `tsc --noEmit` clean and **0 ESLint errors**; no `any`/unsafe
`as`; shared types in `types/index.ts`; add/adjust tests; do not regress the isolation substrate; update
`tasks/lessons.md` if a correction is needed.

---

## R1 — CRITICAL: close cross-tenant write primitives  *(TEN-001, TEN-002, TEN-003)*

**Objective:** make it impossible for a request to create/relocate a record into another tenant.

**Approach**
1. **Force-stamp `org_id` on insert** in [lib/tenant-plugin.ts](../lib/tenant-plugin.ts): in the `validate` and
   `insertMany` hooks, **always overwrite** `this[ORG_FIELD]` with the resolved context org when **not** in bypass
   (drop the `== null` condition). In bypass/system paths leave the explicitly-provided `org_id` (cron/webhook still
   set it deliberately via `runWithOrg`, so the resolved org is correct there too). Add a guard: if a non-bypass
   write arrives with an `org_id` that differs from the context org, overwrite it (never trust the body).
2. **Stop passing raw bodies to `create`**: [app/api/products/route.ts:39](../app/api/products/route.ts#L39) and
   [app/api/templates/route.ts:31](../app/api/templates/route.ts#L31) — add zod schemas (mirror the bulk-route
   schemas, which already omit `org_id`), parse, and create from the parsed object.
3. **Strip identity keys in Settings PUT**: [app/api/settings/route.ts:71](../app/api/settings/route.ts#L71) — before
   `flattenObject`, delete `org_id`/`_id`/`__v`/`createdAt`/`updatedAt` (and validate the shape — see R3).
4. **Scope the counter wipe**: [app/api/settings/bulk-delete/route.ts:57](../app/api/settings/bulk-delete/route.ts#L57)
   — replace `Counter.deleteMany({})` with `Counter.deleteMany({ org_id })` (pass the tenant `orgId` from the wrapper).

**Acceptance / tests**
- New test: a request body containing a foreign `org_id` to `POST /api/products`, `POST /api/templates`, and
  `PUT /api/settings` results in a record owned by the **caller's** org (never the foreign one).
- New test: `bulk-delete?type=all` from org A leaves org B's `Counter` documents intact.
- Existing `tenant-isolation.test.ts` and bulk-route tests still pass.

**Out of scope:** the RBAC gap on these same routes (R2) and the secrets read/write (R3) — sequenced next.

---

## R2 — HIGH: enforce RBAC at the wrapper  *(RBAC-001; bulk-delete/export = admin-only)*

**Objective:** a `viewer` can never mutate; destructive/admin tools require admin.

**Approach**
1. In [lib/with-tenant.ts](../lib/with-tenant.ts), after the subscription/feature gate, apply a **default**
   `requireRole(session, req.method)` for non-GET/HEAD — so every write route is role-checked by default. Provide an
   opt-out/override map for routes that legitimately need a different rule (e.g. `settings` operations require the
   `"settings"` op = admin; `team` already admin-only; assistant/whatsapp once wrapped in R4).
2. Audit the ~15 routes in the RBAC-001 table; remove now-redundant inline checks or keep them as explicit overrides.
3. **`bulk-delete` and `export` → admin-only:** require `requireRole(session, req.method, "settings")`; bulk-delete
   already destructive — also require an explicit confirmation token/param and a rate limit (R9 covers limits, but
   add this one now). Keep the existing client confirmation dialog.

**Acceptance / tests**
- Extend the RBAC test pattern (like `team.test.ts`) to assert: viewer→403 on POST/PUT/DELETE for products,
  templates, payments, convert, projects notes/attachments, upload, settings, document-designs, currency-rates,
  whatsapp send/delete; manager allowed where appropriate; admin-only for settings/bulk-delete/export.
- Confirm GET routes still work for viewers.

---

## R3 — HIGH: secrets are write-only, admin-gated, masked-on-read  *(SEC-001, VAL-001)*

**Objective:** integration secrets never round-trip to the client; only admins can write them; bodies are validated.

**Approach**
1. **Mask on read:** [app/api/settings/route.ts GET:51](../app/api/settings/route.ts#L51) — strip every secret leaf
   under `integrations.*` (`apiKey`, `apiSecret`, `password`, `smtpPassword`, `token`) before responding; keep the
   existing boolean `*Configured` flags (and optionally a `last4`). Centralize as a `maskSettings()` helper.
2. **Validate + admin-gate write:** add a zod schema for the settings PUT body; restrict integration/secret writes to
   admin (`requireRole(..., "settings")`, from R2). Preserve write-only semantics: a blank/omitted secret field
   leaves the stored secret unchanged (don't overwrite with empty).
3. Keep `org_id`/`_id` strip from R1.

**Acceptance / tests**
- Test: `GET /api/settings` response contains no `apiKey`/`apiSecret`/`password` values (only booleans/last4).
- Test: non-admin PUT to settings → 403; admin PUT with omitted secret preserves the existing secret.
- Note: audit already strips `integrations` (AUD-003) — verify no secret reaches `AuditLog`.

---

## R4 — HIGH: gate assistant + WhatsApp routes + rate-limit billable calls  *(BILL-001, AI-001, RL-001, AI-002)*

**Objective:** blocked/un-entitled tenants can't invoke billable LLM/messaging; abuse is rate-limited.

**Approach**
1. Wrap `app/api/assistant/{chat,rewrite,test}` and `app/api/whatsapp/*` (non-webhook) in `withTenant` so they get
   the 402 status gate + 403 feature gate (`ai_assistant` / `messaging`). Where `withTenant`'s callback signature
   doesn't fit the SSE/streaming handlers, extract the gate into a small `requireEntitlement(orgId, feature)` helper
   and call it before any provider call (keep `enterOrg` for the ALS context if needed, but add the checks).
2. Add `rateLimit` (existing [lib/rate-limit.ts](../lib/rate-limit.ts)) keyed by `org`/`user` on: assistant chat,
   whatsapp send/send-document, email send, pdf, upload, export. Add a per-request **token budget** for the
   assistant (cap input+output tokens; 429 when exceeded).

**Acceptance / tests**
- Test: a tenant whose plan lacks `ai_assistant` → assistant chat returns 403 before any provider call; a `blocked`
  subscription → 402. Same for `messaging` on whatsapp send.
- Test: exceeding the rate limit returns 429 with `Retry-After`.

---

## R5 — HIGH: fix quotation→invoice double-conversion  *(CON-001 — failing test)*

**Objective:** one quotation → at most one invoice, concurrency-safe; no swallowed errors.

**Approach**
- Add a **unique partial index** on `Invoice` `{ org_id: 1, converted_from: 1 }` (partial: `converted_from` exists).
- Make the conversion atomic: flip the quotation with a guarded `findOneAndUpdate({ _id, status: { $ne: "invoiced" } },
  …)` inside the transaction; if it doesn't match, abort with 400 "Already converted".
- Stop swallowing the transaction error → return 409/400, not 200.

**Acceptance / tests**
- `test/convert.test.ts` (currently failing) passes: second convert → 400.
- New test: two concurrent converts → exactly one invoice, the other 409.

---

## R6 — HIGH: session freshness  *(AUTH-001, AUTH-004, AUTH-005)*

**Objective:** role/org/subscription changes take effect without a 30-day wait; tokens aren't long-lived.

**Approach**
- In [auth.ts](../auth.ts) `jwt`: on token refresh (no `user`), re-resolve `role` + `org_id` from the DB (cheap,
  cached) — or add a `tokenVersion` on `User` bumped on role/org change and re-validated here.
- Set `session.maxAge` to a shorter window (e.g. 8h–24h) with rolling refresh.
- Handle org transfer/deletion: if the user's `org_id` no longer resolves, force re-auth.

**Acceptance / tests:** demote admin→viewer, assert next request is 403 on a write within one refresh cycle.

---

## R7 — HIGH: payroll loan mutation guard  *(PAY-001)*

**Objective:** loan balance moves only via mark-paid; status transitions are controlled.

**Approach:** remove `remainingBalance` from the loan `PUT` schema (server-derived only);
restrict `status` transitions; block edits to loans referenced by **paid** payslips
([app/api/payroll/loans/[id]/route.ts](../app/api/payroll/loans/[id]/route.ts)).
**Tests:** PUT attempting to set `remainingBalance`/force `closed` → rejected; mark-paid remains the only balance mover.

---

## R8 — MED/HIGH: make consumption/bootstrap/payment ops atomic  *(CON-002…CON-007)*

**Objective:** no duplicate orgs, double-consumed invites, double payments, or double-generated recurring invoices.

**Approach**
- **Invite (CON-002):** atomic `findOneAndUpdate({ _id, status:"pending" }, { $set:{ status:"consumed", … } })`.
- **`ensureUserOrg` (CON-003):** add a unique index on `Organization.owner_user_id`; guard create with an atomic
  `User.findOneAndUpdate({ _id, org_id: { $exists:false } }, …)` or catch the dup-key and re-read.
- **Platform `mark_paid` (CON-004):** require/synthesize an idempotency key; include manual records in the unique
  `(provider, provider_ref)` constraint (drop the null exemption for manual).
- **Subscription save (CON-005):** add optimistic versioning or convert to targeted `$set`.
- **Recurring cron (CON-007):** claim each source atomically (advance `next_date` via `findOneAndUpdate`) before generating.

**Tests:** concurrency tests for each (duplicate suppressed).

---

## R9 — MED: SSRF, egress hardening, PII logging, webhook fail-closed  *(AI-003/004, SEC-003/004, WH-001)*

**Approach**
- `selfFetch` base URL from env origin (`NEXTAUTH_URL`), not `Host`/`X-Forwarded-Host` ([lib/assistant/base-url.ts](../lib/assistant/base-url.ts)).
- Allowlist AI `baseUrl`/`azureEndpoint` to HTTPS provider hosts; reject private IPs; validate `vision.ts` image URLs (own host only).
- WhatsApp webhook: **fail closed** if `WHATSAPP_WEBHOOK_SECRET` unset; require exact phone match (drop single-org fallback).
- Strip PII from webhook/Resend logs; add timeouts/retries to Cloudinary + email (match WhatsApp's `AbortSignal.timeout`).
- Env key fallbacks: keep, but `console.warn`/meter when the platform key is used for a tenant.

**Tests:** webhook with missing secret → rejected; spoofed Host doesn't change `selfFetch` origin; private-IP `baseUrl` rejected.

---

## R10 — MED: scale tier  *(SCALE-001…004, plus SCALE-005 duplicate index)*

**Approach**
- Make hot compound indexes **org_id-leading** (Invoice/Quotation/Expense/Project/Customer/Product/Service/TimeEntry/WhatsAppMessage).
- Add pagination (`page`/`limit`, default 50, max 200) to the unbounded lists (products, services, templates, time-entries, payroll/loans, whatsapp/conversations).
- Batch the N+1 loops (customers detail, reminders cron, mark-paid, whatsapp conversations) with `$in` + maps.
- Remove the duplicate `Product.sku` index.
- **Index changes touch a large collection → present the index plan for approval before applying** (per the heavy-infra rule).

**Tests:** pagination contract tests; `explain()` confirms org-leading index use on representative queries.

---

### Suggested execution order
R1 → R2 → R3 → R4 → R5 → R6 → R7 → R8 → R9 → R10. R1–R3 are the highest value (both CRITICALs + the systemic RBAC +
secrets) and are mostly small. Approve a phase and I'll implement it, run the build + targeted tests, and report back
before moving to the next.
