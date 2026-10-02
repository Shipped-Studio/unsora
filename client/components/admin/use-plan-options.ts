import { useSubscriptionPlans } from "@/hooks/use-subscription-plans";

/**
 * Plan keys an account can be on: "free" plus every subscription tier in the
 * DB catalog. `include` keeps an unexpected stored value selectable.
 */
export function usePlanOptions(include?: string | null): string[] {
  const { plans } = useSubscriptionPlans();
  const keys = ["free", ...(plans ?? []).map((p) => p.key)];
  if (include && !keys.includes(include)) keys.push(include);
  return keys;
}
