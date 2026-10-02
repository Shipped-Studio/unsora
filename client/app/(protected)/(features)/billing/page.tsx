"use client";

import { Suspense, useState } from "react";
import { toast } from "sonner";
import { PLAN_DETAILS } from "@/constant";
import { useUserUsage } from "@/hooks/use-user-usage";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { useCreditPacks } from "@/hooks/use-credit-packs";
import { useSubscriptionPlans } from "@/hooks/use-subscription-plans";
import { ActivatePlanDialog } from "@/components/billing/activate-plan-dialog";
import { BillingSkeleton } from "@/components/billing/billing-skeleton";
import { CancelSection } from "@/components/billing/cancel-section";
import { CancelSubscriptionDialog } from "@/components/billing/cancel-subscription-dialog";
import { CancelTrialDialog } from "@/components/billing/cancel-trial-dialog";
import { CurrentPlanCard } from "@/components/billing/current-plan-card";
import { PlansSection } from "@/components/billing/plans-section";
import { TopUpDialog } from "@/components/billing/top-up-dialog";
import { TopUpSection } from "@/components/billing/top-up-section";
import { TrialSection } from "@/components/billing/trial-section";
import { UpgradePlanDialog } from "@/components/billing/upgrade-plan-dialog";
import { useTopupRedirect } from "@/components/billing/use-topup-redirect";
import type { SubscriptionPlan } from "@/hooks/use-subscription-plans";

export default function BillingPage() {
  return (
    <Suspense fallback={<BillingSkeleton />}>
      <BillingPageContent />
    </Suspense>
  );
}

/**
 * Billing page — pure orchestrator. Owns the data fetches + handlers and
 * passes them down to presentational components in `@/components/billing`.
 *
 * Rendered inside a Suspense boundary so that useSearchParams() (called by
 * useTopupRedirect) doesn't cause a CSR bail-out during static prerendering.
 */
function BillingPageContent() {
  const { usage, loading, refetch } = useUserUsage();
  const { authFetch } = useAuthFetch();

  const currentPlanKey =
    (usage?.user?.plan?.toLowerCase() as keyof typeof PLAN_DETAILS) ?? "free";
  const currentPlan = PLAN_DETAILS[currentPlanKey] ?? PLAN_DETAILS.free;
  const isPaid = usage?.user?.isActive;
  const isTrialing = usage?.user?.status === "trialing";
  // User has clicked cancel but the period is still running. We still want
  // to render the billing UI (they're paid until period end) but swap the
  // "Cancel Plan" CTA for a "Resume Subscription" one.
  const isCancellationPending = !!isPaid && !!usage?.user?.isCancelled;
  const periodEnd = usage?.user?.stripeCurrentPeriodEnd ?? null;

  // Free users can't buy top-ups, so don't bother fetching the catalog —
  // the section is hidden anyway and the server rejects the purchase.
  const { packs, loading: packsLoading } = useCreditPacks({ enabled: isPaid });

  // Subscription tiers (name / price / credits) come from the DB, not
  // hardcoded constants. Only shown to free users, but the query is shared
  // (deduped) with the upgrade modal so it's effectively free to keep on.
  const { plans, loading: plansLoading } = useSubscriptionPlans();

  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [loadingPack, setLoadingPack] = useState<string | null>(null);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [activatingPlan, setActivatingPlan] = useState(false);
  const [cancellingTrial, setCancellingTrial] = useState(false);
  const [cancelTrialOpen, setCancelTrialOpen] = useState(false);
  const [activatePlanOpen, setActivatePlanOpen] = useState(false);
  const [upgradeTarget, setUpgradeTarget] = useState<SubscriptionPlan | null>(
    null,
  );
  const [upgrading, setUpgrading] = useState(false);

  // Stripe redirects back here with `?topup=success&credits=N` after a paid
  // pack purchase; the hook surfaces a toast and refreshes usage data.
  useTopupRedirect(refetch);

  const handleBuyPack = async (packKey: string) => {
    setLoadingPack(packKey);
    try {
      const response = await authFetch("/api/stripe/create-topup-session", {
        method: "POST",
        body: JSON.stringify({ packKey }),
      });
      const data = await response.json();
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error(data?.error || "Could not start checkout. Try again.");
        setLoadingPack(null);
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
      setLoadingPack(null);
    }
  };

  const handleSelectPlan = async (planKey: string) => {
    // Paid users don't go straight to checkout — a plan switch cancels the
    // current subscription (credits carry over), so confirm first. The
    // actual checkout happens in `handleUpgradeConfirm`.
    if (isPaid) {
      const target = plans?.find((p) => p.key === planKey) ?? null;
      if (target) setUpgradeTarget(target);
      return;
    }
    setLoadingPlan(planKey);
    try {
      const response = await authFetch("/api/stripe/create-checkout-session", {
        method: "POST",
        body: JSON.stringify({ key: planKey }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data?.error || "Could not start checkout. Try again.");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleUpgradeConfirm = async () => {
    if (!upgradeTarget) return;
    setUpgrading(true);
    try {
      const response = await authFetch("/api/stripe/upgrade-plan", {
        method: "POST",
        body: JSON.stringify({ key: upgradeTarget.key }),
      });
      const data = await response.json();
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      toast.error(data?.error || "Could not start checkout. Try again.");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setUpgrading(false);
    }
  };

  const handleActivatePlan = async () => {
    setActivatingPlan(true);
    try {
      const response = await authFetch("/api/stripe/get-paid-subscription", {
        method: "POST",
      });
      const data = await response.json();
      if (data.subscription) {
        toast.success("Your plan is now active!");
        refetch();
      } else {
        toast.error(data.error || "Could not activate plan. Try again.");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setActivatingPlan(false);
      setActivatePlanOpen(false);
    }
  };

  const handleCancelTrial = async () => {
    setCancellingTrial(true);
    try {
      const response = await authFetch("/api/stripe/cancel-trial", {
        method: "POST",
      });
      const data = await response.json();
      if (response.ok) {
        toast.success("Your trial has been cancelled.");
        refetch();
      } else {
        toast.error(data.error || "Could not cancel trial. Try again.");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setCancellingTrial(false);
      setCancelTrialOpen(false);
    }
  };

  const handleResume = async () => {
    setResuming(true);
    try {
      // Send the user to the Stripe billing portal first — they review the
      // plan there and click "Renew subscription". The actual flip of
      // `cancel_at_period_end` happens when they confirm in Stripe and we
      // pick it up via the `customer.subscription.updated` webhook.
      const response = await authFetch("/api/stripe/get-billing-portal-url");
      const data = await response.json();
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      toast.error(data?.error || "Could not open billing portal. Try again.");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setResuming(false);
    }
  };

  const handleCancel = async (_reason: string) => {
    setCancelling(true);
    try {
      const response = await authFetch("/api/stripe/get-billing-portal-url");
      const data = await response.json();
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      toast.error(data?.error || "Could not open billing portal. Try again.");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setCancelling(false);
      setCancelOpen(false);
    }
  };

  if (loading) {
    return <BillingSkeleton />;
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Billing</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your subscription and credits
          </p>
        </div>

        <CurrentPlanCard
          name={currentPlan.name}
          description={currentPlan.description}
          price={currentPlan.price}
          isPaid={isPaid}
          credits={usage?.credits ?? 0}
          monthlyCredits={currentPlan.credits}
        />

        {isTrialing && (
          <TrialSection
            planName={currentPlan.name}
            onActivate={() => setActivatePlanOpen(true)}
            onCancelTrial={() => setCancelTrialOpen(true)}
            isActivating={activatingPlan}
            isCancellingTrial={cancellingTrial}
          />
        )}

        {isPaid && !isTrialing && (
          <TopUpSection onBuyCreditsClick={() => setTopUpOpen(true)} />
        )}

        {/* Free users pick their first plan here; paid users see the same
            grid with Upgrade/Downgrade CTAs (plan switch with credit
            carryover). Trialing users activate their plan instead. */}
        {!isTrialing && (
          <PlansSection
            plans={plans}
            plansLoading={plansLoading}
            currentPlanKey={currentPlanKey}
            currentPrice={currentPlan.price}
            isPaid={isPaid}
            loadingPlanKey={loadingPlan}
            onSelect={handleSelectPlan}
          />
        )}

        {isPaid && !isTrialing && (
          <CancelSection
            isCancelled={isCancellationPending}
            periodEnd={periodEnd}
            isResuming={resuming}
            onCancelClick={() => setCancelOpen(true)}
            onResumeClick={handleResume}
          />
        )}
      </div>

      <TopUpDialog
        open={topUpOpen}
        onOpenChange={setTopUpOpen}
        packs={packs}
        loading={packsLoading}
        loadingPackKey={loadingPack}
        onBuy={handleBuyPack}
      />

      <CancelSubscriptionDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        currentPlanName={currentPlan.name}
        maxCredits={currentPlan.credits}
        isCancelling={cancelling}
        onConfirm={handleCancel}
      />

      <CancelTrialDialog
        open={cancelTrialOpen}
        onOpenChange={setCancelTrialOpen}
        currentPlanName={currentPlan.name}
        isCancelling={cancellingTrial}
        onConfirm={handleCancelTrial}
      />

      <ActivatePlanDialog
        open={activatePlanOpen}
        onOpenChange={setActivatePlanOpen}
        isActivating={activatingPlan}
        onConfirm={handleActivatePlan}
      />

      <UpgradePlanDialog
        targetPlan={upgradeTarget}
        onOpenChange={(open) => {
          if (!open) setUpgradeTarget(null);
        }}
        currentPlanName={currentPlan.name}
        isUpgrading={upgrading}
        onConfirm={handleUpgradeConfirm}
      />
    </div>
  );
}
