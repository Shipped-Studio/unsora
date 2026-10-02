/**
 * Client-side plan copy for the pricing dialog, keyed by plan `key`. The
 * commercial facts (name, price, credits) come from the DB via
 * `useSubscriptionPlans()`. Social account limits mirror
 * server/src/lib/limit.ts.
 */
export const PLAN_PRESENTATION: Record<string, { features: readonly string[] }> =
  {
    basic: {
      features: [
        "5 social accounts",
        "Scheduling, calendar and analytics",
        "REST API and MCP server",
        "All create tools",
      ],
    },
    pro: {
      features: [
        "10 social accounts",
        "Scheduling, calendar and analytics",
        "REST API and MCP server",
        "All create tools",
        "Priority support",
      ],
    },
    power: {
      features: [
        "50 social accounts",
        "Scheduling, calendar and analytics",
        "REST API and MCP server",
        "All create tools",
        "Priority support",
      ],
    },
  };



