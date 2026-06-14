import type { BillingCurrency } from "@/types";

/**
 * Provider-agnostic payment abstraction (DESIGN + STUBS ONLY this pass).
 *
 * The portal works today with manual "Mark paid". When a real gateway is added
 * (Paddle / Lemon Squeezy for international cards, Safepay / JazzCash / Easypaisa
 * for local PKR — see docs/payments-provider-memo.md), implement `PaymentProvider`
 * for it and register it below. The data model already carries nullable
 * `provider` / `provider_ref` on PaymentRecord, so no schema change is needed.
 */
export interface CheckoutSessionParams {
  orgId: string;
  planId: string;
  currency: BillingCurrency;
  amount: number;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
}

export interface CheckoutSession {
  /** Hosted checkout URL to redirect the payer to. */
  url: string;
  /** The provider's reference for this attempt (→ PaymentRecord.provider_ref). */
  reference: string;
}

export type WebhookEventType =
  | "payment.succeeded" | "payment.failed" | "subscription.canceled" | "unknown";

export interface WebhookEvent {
  type: WebhookEventType;
  orgId?: string;
  providerRef?: string;
  amount?: number;
  currency?: BillingCurrency;
  raw: unknown;
}

export interface PaymentProvider {
  readonly id: string;
  /** Create a hosted-checkout session for a plan purchase. */
  createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSession>;
  /** Verify the provider signature and normalize the webhook payload. */
  verifyAndParseWebhook(req: Request, rawBody: string): Promise<WebhookEvent>;
}

/** Default provider — manual portal management. No checkout, no webhooks. */
export class ManualProvider implements PaymentProvider {
  readonly id = "manual";
  async createCheckoutSession(): Promise<CheckoutSession> {
    throw new Error("Manual billing has no checkout — record payments via the portal (Mark paid).");
  }
  async verifyAndParseWebhook(): Promise<WebhookEvent> {
    throw new Error("Manual billing has no webhooks.");
  }
}

// Registry. Real providers register here once implemented.
const REGISTRY: Record<string, PaymentProvider> = {
  manual: new ManualProvider(),
};

export function getProvider(id: string): PaymentProvider | undefined {
  return REGISTRY[id];
}
