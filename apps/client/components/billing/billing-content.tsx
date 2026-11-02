"use client";

import { useCallback, useState } from "react";
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
import { PlanGrid, usePlanChoice } from "./plan-grid";
import { formatLongDate, planDisplayName } from "./format";
import { redirectToStripe } from "./redirect-to-stripe";
import { creditTransactionsQueryKeys } from "./use-credit-transactions";
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

  // Stripe is retrying a failed renewal. Access continues until it gives up.
  const pastDue = isPaid && usage?.user.status === "past_due";
  const packsQuery = useCreditPacks();

  const [pendingPackKey, setPendingPackKey] = useState<string | null>(null);
  const [portalPending, setPortalPending] = useState<"manage" | "resume" | null>(
    null,
  );
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const refreshBilling = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: userUsageQueryKeys.all });
    void queryClient.invalidateQueries({
      queryKey: creditTransactionsQueryKeys.all,
    });
  }, [queryClient]);

  useTopupRedirect(refreshBilling);

  const openPortal = () =>
    redirectToStripe(
      authFetch("/api/stripe/get-billing-portal-url"),
      "Couldn't open the billing portal",
    );

  const handlePortal = async (source: "manage" | "resume") => {
    setPortalPending(source);
    const redirecting = await openPortal();
    if (!redirecting) setPortalPending(null);
  };

  const handleBuyPack = async (packKey: string) => {
    setPendingPackKey(packKey);
    const redirecting = await redirectToStripe(
      authFetch("/api/stripe/create-topup-session", {
        method: "POST",
        body: JSON.stringify({ packKey }),
      }),
      "Couldn't start checkout",
    );
    if (!redirecting) setPendingPackKey(null);
  };

  // The reason isn't stored yet; cancellation finishes in the Stripe portal.
  const handleCancel = async () => {
    setCancelling(true);
    const redirecting = await openPortal();
    if (!redirecting) {
      setCancelling(false);
      setCancelOpen(false);
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

  return (
    <div className="space-y-8">
      {pastDue ? (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-xl bg-destructive-subtle px-4 py-3 sm:flex-row sm:items-center"
        >
          <p className="flex-1 text-sm text-destructive">
            <span className="font-medium">Your last payment didn&apos;t go through.</span> We&apos;ll
            retry it automatically. Update your card to keep your plan.
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={portalPending !== null}
            onClick={() => void handlePortal("manage")}
          >
            {portalPending === "manage" ? <Spinner /> : null}
            Update card
          </Button>
        </div>
      ) : null}
      <PageSection title="Current plan">
        <CurrentPlanCard
          planName={planName}
          plan={isPaid ? plan : null}
          state={state}
          periodEnd={periodEnd}
          credits={usage.credits}
          portalPending={portalPending}
          onChangePlan={() =>
            document.getElementById("plans")?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
          onManageBilling={() => void handlePortal("manage")}
          onResume={() => void handlePortal("resume")}
          onCancelPlan={() => setCancelOpen(true)}
        />
      </PageSection>

      {/* Plans sit on the page, not behind a button; "Change plan" above scrolls here. */}
      <div id="plans" className="scroll-mt-24">
        <PageSection
          title={choice.isPaid ? "Change plan" : "Choose a plan"}
          description={choice.description}
        >
          <PlanGrid choice={choice} />
        </PageSection>
      </div>

      <PageSection
        title="Buy credits"
        description="One-time packs for clipping and creating. Credits never expire, and you can buy them on any plan."
      >
        <CreditPacks
          packs={packsQuery.packs}
          loading={packsQuery.loading}
          error={packsQuery.error}
          onRetry={() => void packsQuery.refetch()}
          pendingPackKey={pendingPackKey}
          onBuy={(key) => void handleBuyPack(key)}
        />
      </PageSection>

      <PageSection
        title="Credit history"
        description="Credits added and spent, on the web and through your API keys."
      >
        <CreditHistory />
      </PageSection>

      <CancelSubscriptionDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        planName={planName}
        endsOn={formatLongDate(periodEnd)}
        isCancelling={cancelling}
        onConfirm={() => void handleCancel()}
      />
    </div>
  );
}
