"use client";
import useSWR from "swr";
import { platformFetcher } from "@/lib/platform/client";
import type {
  PlatformOverview, PlatformTenantSummary, Plan, PlatformSettings,
  PaymentRecord, Subscription, SubscriptionStatus,
} from "@/types";

interface OrgLite { _id: string; name: string; createdAt: string; owner_user_id?: string }

/* eslint-disable @typescript-eslint/no-explicit-any */

const opts = { revalidateOnFocus: false, dedupingInterval: 4000 };

export function usePlatformOverview() {
  const { data, isLoading, mutate } = useSWR<{ data: PlatformOverview }>(
    "/api/platform/overview", platformFetcher, opts,
  );
  return { overview: data?.data, isLoading, mutate };
}

export interface TenantListParams { page: number; search: string; status: string }

export function usePlatformTenants({ page, search, status }: TenantListParams) {
  const qs = new URLSearchParams({ page: String(page), limit: "20" });
  if (search) qs.set("search", search);
  if (status) qs.set("status", status);
  const { data, isLoading, mutate } = useSWR<{
    data: PlatformTenantSummary[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }>(`/api/platform/tenants?${qs.toString()}`, platformFetcher, opts);
  return { tenants: data?.data ?? [], pagination: data?.pagination, isLoading, mutate };
}

export interface TenantDetail {
  org: OrgLite;
  subscription: Subscription | null;
  owner: { name?: string; email?: string } | null;
  payments: PaymentRecord[];
  memberCount: number;
  effectiveStatus: SubscriptionStatus;
}

export function usePlatformTenant(id: string | null) {
  const { data, isLoading, mutate } = useSWR<{ data: TenantDetail }>(
    id ? `/api/platform/tenants/${id}` : null, platformFetcher, opts,
  );
  return { tenant: data?.data, isLoading, mutate };
}

export function usePlatformPlans() {
  const { data, isLoading, mutate } = useSWR<{ data: Plan[] }>(
    "/api/platform/plans", platformFetcher, opts,
  );
  return { plans: data?.data ?? [], isLoading, mutate };
}

export function usePlatformSettings() {
  const { data, isLoading, mutate } = useSWR<{ data: PlatformSettings }>(
    "/api/platform/settings", platformFetcher, opts,
  );
  return { settings: data?.data, isLoading, mutate };
}

export interface SubscriptionRow {
  org_id: string;
  org_name: string;
  status: SubscriptionStatus;
  effectiveStatus: SubscriptionStatus;
  plan_name?: string;
  currency?: string;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  updatedAt?: string | null;
}
export interface PaymentRow {
  org_name: string; amount: number; currency: string; status: string;
  method: string; plan_slug?: string; createdAt?: string | null;
}

export function usePlatformSubscriptions({ page, status }: { page: number; status: string }) {
  const qs = new URLSearchParams({ page: String(page), limit: "20" });
  if (status) qs.set("status", status);
  const { data, isLoading, mutate } = useSWR<{
    data: { subscriptions: SubscriptionRow[]; payments: PaymentRow[]; pagination: { page: number; limit: number; total: number; pages: number } };
  }>(`/api/platform/subscriptions?${qs.toString()}`, platformFetcher, opts);
  return {
    subscriptions: data?.data?.subscriptions ?? [],
    payments: data?.data?.payments ?? [],
    pagination: data?.data?.pagination,
    isLoading, mutate,
  };
}

export interface InviteRow {
  _id: string; email: string; token: string; trial_days_override?: number | null;
  status: string; expires_at?: string | null; consumed_at?: string | null;
  createdAt: string; note?: string; plan?: { name?: string };
}

export function usePlatformInvites() {
  const { data, isLoading, mutate } = useSWR<{ data: InviteRow[] }>(
    "/api/platform/invites", platformFetcher, opts,
  );
  return { invites: data?.data ?? [], isLoading, mutate };
}

export interface PendingRequestRow {
  org_id: string;
  org_name: string;
  plan_name: string;
  direction: string;
  requested_at?: string | null;
}

export function usePlatformPendingRequests() {
  const { data, isLoading, mutate } = useSWR<{ data: PendingRequestRow[] }>(
    "/api/platform/pending-requests", platformFetcher,
    { ...opts, refreshInterval: 30000 },
  );
  return { requests: data?.data ?? [], count: data?.data?.length ?? 0, isLoading, mutate };
}
