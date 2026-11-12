"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageSection } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ErrorState } from "@/components/shared/states";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { useCreditPacks } from "@/hooks/use-credit-packs";
import { findUserPlan, useSubscriptionPlans } from "@/hooks/use-subscription-plans";
import { userUsageQueryKeys, useUserUsage } from "@/hooks/use-user-usage";
import { BillingSkeleton } from "./billing-skeleton";
import { CancelSubscriptionDialog } from "./cancel-subscription-dialog";
import { CreditHistory } from "./credit-history";
import { CreditPacks } from "./credit-packs";
import { CurrentPlanCard, type PlanState } from "./current-plan-card";
import { CurrentCreditsCard, creditsStateOf } from "./current-credits-card";
import { CreditBalanceCard } from "./credit-balance-card";
import { CreditPlanGrid, useCreditPlanChoice } from "./credit-plan-grid";
import { PlanGrid, usePlanChoice } from "./plan-grid";
import { PlanTabs } from "./plan-tabs";
import { BILLING_TAB_EVENT } from "@/lib/toast-error";
import { formatLongDate, planDisplayName } from "./format";
import { redirectToStripe } from "./redirect-to-stripe";
import { creditTransactionsQueryKeys } from "./use-credit-transactions";
import { useBuyCreditPack } from "./use-buy-credit-pack";
import { useTopupRedirect } from "./use-topup-redirect";

export function BillingContent() {
  const queryClient = useQueryClient();
  const { authFetch } = useAuthFetch();
  const choice = usePlanChoice(true);
  const { usage, loading, error, refetch } = useUserUsage();
  const { plans } = useSubscriptionPlans();

  const plan = findUserPlan(plans, usage?.user.plan) ?? null;
  const planKey = plan?.key ?? (usage?.user.plan ?? "free").toLowerCase();
  const planName = plan?.name ?? planDisplayName(planKey);
  const isPaid = usage?.user.isActive === true && planKey !== "free";
  const periodEnd = usage?.user.stripeCurrentPeriodEnd ?? null;

  const state: PlanState = !isPaid
    ? "free"
    : usage?.user.status === "trialing"
      ? "trialing"
      : usage?.user.isCancelled
        ? "ending"
        : "active";

  // Stripe is retrying a failed renewal. The plan stays, but posting is
  // paused until a payment goes through (server require-paid-plan.ts).
  const pastDue = isPaid && usage?.user.status === "past_due";
  const creditsState = creditsStateOf(usage?.creditSubscription);
  const creditChoice = useCreditPlanChoice();
  const packsQuery = useCreditPacks();
  const { pendingPackKey, buy: handleBuyPack } = useBuyCreditPack();

  const [portalPending, setPortalPending] = useState<"manage" | "resume" | "credits" | null>(
    null,
  );
  const [cancelling, setCancelling] = useState<CancelTarget | null>(null);
  const [cancelOpen, setCancelOpen] = useState<CancelTarget | null>(null);

  const refreshBilling = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: userUsageQueryKeys.all });
    void queryClient.invalidateQueries({
      queryKey: creditTransactionsQueryKeys.all,
    });
  }, [queryClient]);

  useTopupRedirect(refreshBilling);

  // What's on sale sits behind tabs. Links pick one with a hash
  // (/billing#credits), "Change plan" and friends with showTab.
  // The page is a skeleton on the server (usage loads in the browser), so
  // reading the hash here can't cause a hydration mismatch.
  const [tab, setTab] = useState<BillingTab>(() => {
    const hash = typeof window === "undefined" ? "" : window.location.hash.slice(1);
    return isBillingTab(hash) ? hash : "plans";
  });
  const showTab = useCallback((next: BillingTab, smooth = true) => {
    setTab(next);
    // After the tab renders, so the page is its final height.
    requestAnimationFrame(() =>
      document
        .getElementById("shop")
        ?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" }),
    );
  }, []);

  // A hash link lands before the page has loaded, so the browser can't
  // scroll to it by itself.
  const loaded = Boolean(usage);
  useEffect(() => {
    if (loaded && isBillingTab(window.location.hash.slice(1))) {
      document.getElementById("shop")?.scrollIntoView({ block: "start" });
    }
  }, [loaded]);

  // "Buy credits" elsewhere in the app while this page is open.
  useEffect(() => {
    const onTab = (event: Event) => {
      const next = (event as CustomEvent<unknown>).detail;
      if (isBillingTab(next)) showTab(next);
    };
    window.addEventListener(BILLING_TAB_EVENT, onTab);
    return () => window.removeEventListener(BILLING_TAB_EVENT, onTab);
  }, [showTab]);

  const openPortal = () =>
    redirectToStripe(
      authFetch("/api/stripe/get-billing-portal-url"),
      "Couldn't open the billing portal",
    );

  const handlePortal = async (source: "manage" | "resume" | "credits") => {
    setPortalPending(source);
    const redirecting = await openPortal();
    if (!redirecting) setPortalPending(null);
  };

  // The reason isn't stored yet; cancellation finishes in the Stripe portal,
  // which lists both subscriptions.
  const handleCancel = async (target: CancelTarget) => {
    setCancelling(target);
    const redirecting = await openPortal();
    if (!redirecting) {
      setCancelling(null);
      setCancelOpen(null);
    }
  };

  // The usage query waits for Clerk, so no data and no error means loading.
  if (!usage) {
    return error && !loading ? (
      <ErrorState
        title="Couldn't load billing"
        onRetry={() => void refetch()}
      />
    ) : (
      <BillingSkeleton />
    );
  }

  const creditSub = usage.creditSubscription ?? null;
  const creditsEndOn = formatLongDate(creditSub?.currentPeriodEnd);

  return (
    <div className="space-y-8">
      {pastDue ? (
        <PastDueBanner
          what="scheduler plan"
          effect="Posting is paused until it goes through."
          pending={portalPending === "manage"}
          disabled={portalPending !== null}
          onUpdate={() => void handlePortal("manage")}
        />
      ) : null}
      {creditsState === "past_due" ? (
        <PastDueBanner
          what="monthly credits"
          effect="New monthly credits are added once it's paid."
          pending={portalPending === "credits"}
          disabled={portalPending !== null}
          onUpdate={() => void handlePortal("credits")}
        />
      ) : null}

      <CreditBalanceCard
        credits={usage.credits}
        monthly={usage.monthlyCredits ?? null}
        subscribedToCredits={creditsState !== "none"}
        onTopUp={() => showTab("credits")}
        onGetMonthly={() => showTab("monthly")}
      />

      <PageSection
        title="Your subscriptions"
        description="Posting and monthly credits are billed separately. Have either, or both."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <CurrentPlanCard
            planName={isPaid ? planName : "No scheduler plan"}
            plan={isPaid ? plan : null}
            state={state}
            periodEnd={periodEnd}
            portalPending={portalPending === "manage" || portalPending === "resume" ? portalPending : null}
            onChangePlan={() => showTab("plans")}
            onManageBilling={() => void handlePortal("manage")}
            onResume={() => void handlePortal("resume")}
            onCancelPlan={() => setCancelOpen("scheduler")}
          />
          <CurrentCreditsCard
            subscription={creditSub}
            state={creditsState}
            portalPending={portalPending === "credits"}
            onChoosePlan={() => showTab("monthly")}
            onManageBilling={() => void handlePortal("credits")}
            onCancel={() => setCancelOpen("credits")}
          />
        </div>
      </PageSection>

      {/* Everything on sale, one tab each. "Change plan" and the other
          buttons above switch the tab and scroll here. */}
      <section id="shop" className="scroll-mt-24 space-y-5">
        <PlanTabs
          value={tab}
          onValueChange={setTab}
          items={[
            { value: "plans", label: "Scheduler" },
            { value: "monthly", label: "Monthly credits" },
            { value: "credits", label: "One-time packs" },
          ]}
        />
        <div className="space-y-1">
          <h2 className="text-base font-medium">{TAB_HEADINGS[tab](choice.isPaid, creditChoice.subscribed)}</h2>
          <p className="text-sm text-muted-foreground">
            {tab === "plans"
              ? choice.description
              : tab === "monthly"
                ? creditChoice.description
                : "Top-ups for when you run out. They never expire, and are used after your monthly credits. Buy them with or without a plan."}
          </p>
        </div>
        {tab === "plans" ? <PlanGrid choice={choice} /> : null}
        {tab === "monthly" ? <CreditPlanGrid choice={creditChoice} /> : null}
        {tab === "credits" ? (
          <CreditPacks
            packs={packsQuery.packs}
            loading={packsQuery.loading}
            error={packsQuery.error}
            onRetry={() => void packsQuery.refetch()}
            pendingPackKey={pendingPackKey}
            onBuy={(key) => void handleBuyPack(key)}
          />
        ) : null}
      </section>

      <PageSection
        title="Credit history"
        description="Credits added and spent, on the web and through your API keys."
      >
        <CreditHistory />
      </PageSection>

      <CancelSubscriptionDialog
        open={cancelOpen === "scheduler"}
        onOpenChange={(open) => setCancelOpen(open ? "scheduler" : null)}
        planName={planName}
        endsOn={formatLongDate(periodEnd)}
        isCancelling={cancelling === "scheduler"}
        onConfirm={() => void handleCancel("scheduler")}
      />
      <CancelSubscriptionDialog
        open={cancelOpen === "credits"}
        onOpenChange={(open) => setCancelOpen(open ? "credits" : null)}
        planName={`${creditSub?.planName ?? "monthly credits"} monthly credits`}
        endsOn={creditsEndOn}
        isCancelling={cancelling === "credits"}
        consequence={`Your monthly credits work until ${creditsEndOn ?? "the end of the billing period"}, then stop renewing. Top-ups and your scheduler plan aren't affected.`}
        onConfirm={() => void handleCancel("credits")}
      />
    </div>
  );
}

type CancelTarget = "scheduler" | "credits";

/** The tabs, named as other pages link to them (/billing#credits). */
type BillingTab = "plans" | "monthly" | "credits";

function isBillingTab(value: unknown): value is BillingTab {
  return value === "plans" || value === "monthly" || value === "credits";
}

const TAB_HEADINGS: Record<BillingTab, (paid: boolean, subscribed: boolean) => string> = {
  plans: (paid) => (paid ? "Change scheduler plan" : "Scheduler plans"),
  monthly: (_paid, subscribed) => (subscribed ? "Change monthly credits" : "Monthly credits"),
  credits: () => "One-time packs",
};

function PastDueBanner({
  what,
  effect,
  pending,
  disabled,
  onUpdate,
}: {
  what: string;
  effect: string;
  pending: boolean;
  disabled: boolean;
  onUpdate: () => void;
}) {
  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-xl bg-destructive-subtle px-4 py-3 sm:flex-row sm:items-center"
    >
      <p className="flex-1 text-sm text-destructive">
        <span className="font-medium">Your last payment for {what} didn&apos;t go through.</span>{" "}
        {effect} We&apos;ll retry it automatically.
      </p>
      <Button size="sm" variant="outline" disabled={disabled} onClick={onUpdate}>
        {pending ? <Spinner /> : null}
        Update card
      </Button>
    </div>
  );
}
