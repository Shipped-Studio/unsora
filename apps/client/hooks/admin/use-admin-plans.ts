"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthFetch } from "../use-auth-fetch";
import { creditPacksQueryKeys } from "../use-credit-packs";
import { subscriptionPlansQueryKeys } from "../use-subscription-plans";
import { useIsAdmin } from "./use-admin-data";

export type PlanType = "SUBSCRIPTION" | "TOPUP" | "PROMO";
export type PlanInterval = "MONTH" | "YEAR";

export interface AdminPlan {
  id: string;
  key: string;
  name: string;
  description: string | null;
  type: PlanType;
  credits: number;
  priceCents: number;
  currency: string;
  interval: PlanInterval | null;
  trialDays: number | null;
  stripePriceId: string | null;
  stripeProductId: string | null;
  sortOrder: number;
  isActive: boolean;
  isPopular: boolean;
  features: string[];
  socialAccounts: number | null;
  previousStripePriceIds: string[];
  /** Active users on this plan (subscriptions only). */
  subscribers: number | null;
}

export interface AdminPlansData {
  plans: AdminPlan[];
  /** Which Stripe account the server's key belongs to. */
  stripeMode: "live" | "test";
}

/** Body for create/update. Omitted fields stay as they are on update. */
export interface PlanInput {
  key?: string;
  name?: string;
  description?: string | null;
  type?: PlanType;
  credits?: number;
  priceCents?: number;
  currency?: string;
  interval?: PlanInterval | null;
  trialDays?: number | null;
  features?: string[];
  socialAccounts?: number | null;
  stripePriceId?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  isPopular?: boolean;
}

export interface PricingConfig {
  /** Fraction on top of the provider's cost: 0.2 = 20%. */
  margin: number;
  /** Dollars one credit is costed at. */
  creditUsd: number;
  source: "admin" | "env";
}

const PLANS_KEY = ["admin", "plans"] as const;
const PRICING_KEY = ["admin", "pricing"] as const;

async function readJson<T>(res: Response): Promise<{ data: T; json: Record<string, unknown> }> {
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || `Request failed (${res.status})`);
  }
  return { data: json.data as T, json };
}

export function useAdminPlans() {
  const { authFetch } = useAuthFetch();
  const { isAdmin } = useIsAdmin();
  return useQuery({
    queryKey: PLANS_KEY,
    queryFn: async (): Promise<AdminPlansData> => {
      const { data, json } = await readJson<AdminPlan[]>(await authFetch("/api/admin/plans"));
      return { plans: data, stripeMode: json.stripeMode === "live" ? "live" : "test" };
    },
    enabled: isAdmin,
    staleTime: 15_000,
  });
}

export function useSavePlan() {
  const { authFetch } = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: PlanInput }) =>
      (
        await readJson<AdminPlan>(
          await authFetch(id ? `/api/admin/plans/${id}` : "/api/admin/plans", {
            method: id ? "PUT" : "POST",
            body: JSON.stringify(input),
          }),
        )
      ).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: PLANS_KEY });
      // Pricing cards and the admin plan pickers read the public list.
      void qc.invalidateQueries({ queryKey: subscriptionPlansQueryKeys.all });
      void qc.invalidateQueries({ queryKey: creditPacksQueryKeys.all });
    },
  });
}

export function useGenerationPricing() {
  const { authFetch } = useAuthFetch();
  const { isAdmin } = useIsAdmin();
  return useQuery({
    queryKey: PRICING_KEY,
    queryFn: async () =>
      (await readJson<PricingConfig>(await authFetch("/api/admin/pricing"))).data,
    enabled: isAdmin,
    staleTime: 15_000,
  });
}

export function useSaveGenerationPricing() {
  const { authFetch } = useAuthFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (value: { margin: number; creditUsd: number }) =>
      (
        await readJson<PricingConfig>(
          await authFetch("/api/admin/pricing", {
            method: "PUT",
            body: JSON.stringify(value),
          }),
        )
      ).data,
    onSuccess: (data) => qc.setQueryData(PRICING_KEY, data),
  });
}
