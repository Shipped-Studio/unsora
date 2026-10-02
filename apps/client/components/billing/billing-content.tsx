"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageSection } from "@/components/layout/page-header";
import { ErrorState } from "@/components/shared/states";
import { usePricing } from "@/contexts/pricing-context";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { useCreditPacks } from "@/hooks/use-credit-packs";
import { useSubscriptionPlans } from "@/hooks/use-subscription-plans";
import { userUsageQueryKeys, useUserUsage } from "@/hooks/use-user-usage";
import { ActivatePlanDialog } from "./activate-plan-dialog";
import { BillingSkeleton } from "./billing-skeleton";
import { CancelSubscriptionDialog } from "./cancel-subscription-dialog";
import { CancelTrialDialog } from "./cancel-trial-dialog";
import { CreditHistory } from "./credit-history";
import { CreditPacks } from "./credit-packs";
import { CurrentPlanCard, type PlanState } from "./current-plan-card";
import { formatLongDate, planDisplayName } from "./format";
import { redirectToStripe } from "./redirect-to-stripe";
import { creditTransactionsQueryKeys } from "./use-credit-transactions";
import { useTopupRedirect } from "./use-topup-redirect";

export function BillingContent() {
  const queryClient = useQueryClient();
  const { authFetch } = useAuthFetch();
  const { openPricing } = usePricing();
  const { usage, loading, error, refetch } = useUserUsage();
  const { plans } = useSubscriptionPlans();

  const planKey = (usage?.user.plan ?? "free").toLowerCase();
  const plan = plans?.find((p) => p.key === planKey) ?? null;
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

  const canBuyCredits = state === "active" || state === "ending";
  const packsQuery = useCreditPacks({ enabled: canBuyCredits });

  const [pendingPackKey, setPendingPackKey] = useState<string | null>(null);
  const [portalPending, setPortalPending] = useState<"manage" | "resume" | null>(
    null,
  );
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [activating, setActivating] = useState(false);
  const [cancelTrialOpen, setCancelTrialOpen] = useState(false);
  const [cancellingTrial, setCancellingTrial] = useState(false);

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

  const handleActivate = async () => {
    setActivating(true);
    try {
      const res = await authFetch("/api/stripe/get-paid-subscription", {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (data?.subscription) {
        toast.success("Plan activated");
        refreshBilling();
        setActivateOpen(false);
      } else {
        toast.error("Couldn't activate your plan", {
          description: data?.error || "Try again in a moment.",
        });
      }
    } catch {
      toast.error("Couldn't activate your plan", {
        description: "Check your connection and try again.",
      });
    } finally {
      setActivating(false);
    }
  };

  const handleCancelTrial = async () => {
    setCancellingTrial(true);
    try {
      const res = await authFetch("/api/stripe/cancel-trial", {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        toast.success("Trial cancelled");
        refreshBilling();
        setCancelTrialOpen(false);
      } else {
        toast.error("Couldn't cancel your trial", {
          description: data?.error || "Try again in a moment.",
        });
      }
    } catch {
      toast.error("Couldn't cancel your trial", {
        description: "Check your connection and try again.",
      });
    } finally {
      setCancellingTrial(false);
    }
  };

  // The usage query waits for Clerk, so no data and no error means loading.
  if (!usage) {
    return error && !loading ? (
      <ErrorState
        title="Couldn't load billing"
        description={error}
        onRetry={() => void refetch()}
      />
    ) : (
      <BillingSkeleton />
    );
  }

  return (
    <div className="space-y-8">
      <PageSection title="Current plan">
        <CurrentPlanCard
          planName={planName}
          plan={isPaid ? plan : null}
          state={state}
          periodEnd={periodEnd}
          credits={usage.credits}
          portalPending={portalPending}
          activating={activating}
          onChangePlan={openPricing}
          onManageBilling={() => void handlePortal("manage")}
          onResume={() => void handlePortal("resume")}
          onCancelPlan={() => setCancelOpen(true)}
          onActivateTrial={() => setActivateOpen(true)}
          onCancelTrial={() => setCancelTrialOpen(true)}
        />
      </PageSection>

      <PageSection
        title="Buy credits"
        description="One-time packs. Top-up credits never expire and are used after your plan credits."
      >
        {canBuyCredits ? (
          <CreditPacks
            packs={packsQuery.packs}
            loading={packsQuery.loading}
            error={packsQuery.error}
            onRetry={() => void packsQuery.refetch()}
            pendingPackKey={pendingPackKey}
            onBuy={(key) => void handleBuyPack(key)}
          />
        ) : (
          <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
            {state === "trialing"
              ? "Credit packs are available once your plan is active."
              : "Credit packs are available on paid plans."}
          </p>
        )}
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
      <CancelTrialDialog
        open={cancelTrialOpen}
        onOpenChange={setCancelTrialOpen}
        planName={planName}
        isCancelling={cancellingTrial}
        onConfirm={() => void handleCancelTrial()}
      />
      <ActivatePlanDialog
        open={activateOpen}
        onOpenChange={setActivateOpen}
        planName={planName}
        isActivating={activating}
        onConfirm={() => void handleActivate()}
      />
    </div>
  );
}
