# Payment Gateway — Recommendation Memo (design only)

**Status:** No live gateway is integrated. The owner portal manages billing
manually ("Mark paid" records a `PaymentRecord` and activates a period). The model
is provider-agnostic (`PaymentRecord.provider` / `provider_ref` are nullable), and
`lib/payments/provider.ts` defines the abstraction a real gateway plugs into with
no schema change.

**Context:** Pakistan-based business, billing in **PKR + USD**, selling to both
local and international tenants.

---

## The core constraint

**Stripe does not onboard Pakistani merchants.** Stripe Connect/standard accounts
aren't available to PK-registered businesses, so the usual default is out. Plan
around a **merchant-of-record (MoR)** for international cards and a **local rail**
for PKR.

## Recommended split

### 1. International cards + tax/VAT → Merchant of Record
A MoR sells to the customer as the seller of record, handling global card
acceptance, **sales-tax/VAT/GST calculation and remittance**, fraud, and payouts
to a PK bank account. This removes the hardest compliance work.

| Option | Notes | Indicative fee |
| --- | --- | --- |
| **Paddle** | SaaS-focused MoR, subscriptions + tax handled, supports PK payouts. Strong fit. | ~5% + 50¢ per txn |
| **Lemon Squeezy** | Simple MoR, great DX, subscriptions + tax. (Now Stripe-owned — confirm current PK payout support.) | ~5% + 50¢ |

Either gives USD (and multi-currency) card acceptance without a PK Stripe account.
**Recommendation: Paddle** as the primary international rail.

### 2. Local PKR → domestic rail
For Pakistani tenants paying in PKR, a local aggregator is cheaper and more
familiar (cards + wallets):

| Option | Rails |
| --- | --- |
| **Safepay** | Cards + bank; modern API/webhooks. Recommended primary. |
| **JazzCash** | Mobile wallet + cards; huge local reach. |
| **Easypaisa** | Mobile wallet; huge local reach. |

**Recommendation: Safepay** for PKR card/bank, optionally add JazzCash/Easypaisa
wallets for reach.

## Fixed-cost implications
- MoR fees (~5% + fixed) are higher than raw Stripe (~2.9%+30¢) — that premium buys
  tax compliance + PK payouts. Price plans with this in mind.
- Local rails: per-transaction % + possible monthly minimums — confirm at signup.
- No fixed infra cost to add: webhooks + checkout are serverless route handlers.

## How it plugs in (already stubbed)
1. Implement `PaymentProvider` (`createCheckoutSession`, `verifyAndParseWebhook`)
   for the chosen provider(s) in `lib/payments/` and register in the provider
   registry.
2. Portal "Upgrade/Pay" → `createCheckoutSession` → redirect to hosted checkout.
3. Provider webhook → `app/api/webhooks/payments/[provider]/route.ts` (already
   exists as a 501 stub) → verify signature → upsert `PaymentRecord` (idempotent on
   `provider_ref`) → transition `Subscription` (`bypassTenant`/`runWithOrg`) →
   `invalidateEntitlements(orgId)`.
4. Per-tenant provider keys live in the app's settings/secrets layer — **never env**
   (this is a multi-tenant app; keys vary per deployment-as-merchant, secrets stay
   out of `.env`).

## Suggested sequencing
1. Ship manual portal billing (done).
2. Add **Safepay** (PKR) first — most local volume, simplest onboarding.
3. Add **Paddle** (international USD + tax) second.
4. Wire the webhook stub for each as you go; keep "Mark paid" as the manual fallback.
