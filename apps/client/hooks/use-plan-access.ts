import { useUserUsage } from "./use-user-usage";

/**
 * What the user's plan lets them do in the scheduler, from /usage. The
 * server decides the limit: the plan's while it's live, otherwise the free
 * allowance (0 when the free tier is off). Null while usage loads.
 */
export function usePlanAccess() {
  const { usage } = useUserUsage();
  if (!usage) return null;
  const plan = (usage.user?.plan ?? "free").toLowerCase();
  const isPaid = Boolean(usage.user?.isActive) && plan !== "free";
  const limit = usage.limits?.socialAccounts ?? 0;
  const used = usage.counts?.socialAccounts ?? 0;
  return {
    isPaid,
    /** Stripe is retrying a failed renewal; access continues meanwhile. */
    pastDue: usage.user?.status === "past_due",
    limit,
    used,
    /** The plan allows no accounts at all (free tier switched off). */
    noScheduler: limit === 0,
    atLimit: limit > 0 && used >= limit,
  };
}
