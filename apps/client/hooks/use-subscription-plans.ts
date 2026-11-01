import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/nextjs";
import { useAuthFetch } from "./use-auth-fetch";

export type PlanInterval = "MONTH" | "YEAR";

export interface SubscriptionPlan {
  key: string;
  name: string;
  description?: string;
  credits: number;
  priceUsd: number;
  /** Billing interval. Only rendered when the server sends it. */
  interval?: PlanInterval | null;
  isPopular?: boolean;
  sortOrder: number;
  /** Bullet points for the pricing card, set at /admin/pricing. */
  features?: string[];
  /** Social accounts the plan allows. */
  socialAccounts?: number | null;
  /**
   * False for a plan that's no longer sold, sent only as the subscriber's
   * own current plan (Basic / Pro / Power after the move to account-based
   * plans).
   */
  available?: boolean;
}

/** The plans anyone can pick, without a subscriber's off-sale plan. */
export function plansForSale(plans: SubscriptionPlan[] | null | undefined) {
  return plans?.filter((p) => p.available !== false) ?? null;
}

/**
 * The plan a user is on. `User.plan` holds the Stripe product name, which
 * only equals the plan key for the default plans ("pro"), so match either.
 */
export function findUserPlan(plans: SubscriptionPlan[] | null | undefined, userPlan: string | null | undefined) {
  const value = (userPlan ?? "").trim().toLowerCase();
  if (!value || !plans) return undefined;
  return plans.find((p) => p.key.toLowerCase() === value) ?? plans.find((p) => p.name.trim().toLowerCase() === value);
}

export const subscriptionPlansQueryKeys = {
  all: ["subscription-plans"] as const,
  list: () => [...subscriptionPlansQueryKeys.all, "list"] as const,
};

/**
 * Subscription tiers from the server. The DB `plans` table is the single
 * source of truth for names, prices and credits, so the UI can never
 * advertise a different amount than the webhook grants. Checkout is driven by
 * the plan `key`; the Stripe price ID never reaches the browser.
 */
export function useSubscriptionPlans() {
  const { authFetch } = useAuthFetch();
  const { isSignedIn } = useUser();

  const query = useQuery({
    queryKey: subscriptionPlansQueryKeys.list(),
    queryFn: async (): Promise<SubscriptionPlan[]> => {
      const res = await authFetch("/api/stripe/subscription-plans");
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Couldn't load plans.");
      }
      return data.data as SubscriptionPlan[];
    },
    enabled: !!isSignedIn,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return {
    plans: query.data ?? null,
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}

/**
 * Free-trial days the user's next checkout would start with (0 = none; the
 * trial is first-subscription only). `null` until loaded, and 0 if the check
 * fails (checkout still applies the trial if one is due). Only fetched while
 * `enabled`, since the server asks Stripe for the user's invoices.
 */
export function useTrialDays(enabled: boolean) {
  const { authFetch } = useAuthFetch();
  const { isSignedIn } = useUser();

  const query = useQuery({
    queryKey: [...subscriptionPlansQueryKeys.all, "trial-days"],
    queryFn: async (): Promise<number> => {
      const res = await authFetch("/api/stripe/trial-eligibility");
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Couldn't check trial eligibility.");
      }
      return data.data.trialDays as number;
    },
    enabled: enabled && !!isSignedIn,
    staleTime: 5 * 60 * 1000,
  });

  return query.data ?? (query.isError ? 0 : null);
}
