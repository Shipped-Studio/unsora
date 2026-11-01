import type { SubscriptionPlan } from "@/hooks/use-subscription-plans";

/**
 * What every account-based plan includes, after its account count. Only list
 * what the app does today, and keep it in step with the landing's pricing
 * cards (unsora-landing-new: `planFeatures` in src/lib/home-v4.ts).
 */
export const PLAN_FEATURES = [
  "Unlimited posts",
  "Multiple accounts per platform",
  "Post to TikTok, Instagram, YouTube and more",
  "Posting queue with time slots",
  "Works in ChatGPT and Claude (MCP)",
  "REST API included",
  "Carousel posts",
  "Post analytics",
];

/** Admin-set lines the shared list above already covers. */
const COVERED = /social accounts|scheduling|rest api|mcp/i;

/**
 * The checklist on a plan card. Account-based plans lead with their account
 * count, then the shared list, then any extra lines set at /admin/pricing
 * (e.g. "Priority support"). Older credit plans keep their own list.
 */
export function planCardFeatures(plan: SubscriptionPlan): { lead: string | null; items: string[] } {
  const own = plan.features ?? [];
  if (plan.credits > 0) return { lead: null, items: own };
  return {
    lead: plan.socialAccounts ? `${plan.socialAccounts} connected social accounts` : null,
    items: [...PLAN_FEATURES, ...own.filter((f) => !COVERED.test(f))],
  };
}
