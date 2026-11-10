"use client";

import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, CalendarCheck, Check, Scissors } from "@phosphor-icons/react";
import { formatUsd } from "@/components/billing/format";
import { CardGridSkeleton, PackCard, cardGridClass, cardItemClass } from "@/components/billing/pricing-cards";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { useAuthFetch } from "@/hooks/use-auth-fetch";
import { useCreditPacks, type CreditPack } from "@/hooks/use-credit-packs";
import { userUsageQueryKeys, useUserUsage } from "@/hooks/use-user-usage";
import { cn } from "@/lib/utils";
import {
  CREDITS_PARAM,
  PACKS_VIEW,
  TOPUP_PARAM,
  VIEW_PARAM,
  type SetupContext,
} from "./setup";
import { CARD, StepFooter, StepHeader } from "./setup-steps";

/*
 * The credits step, right after the free trial. A trial unlocks the scheduler
 * but includes no credits, so clipping wouldn't work yet: first the question,
 * then, on a yes, the packs. Both can be skipped. No Back to the trial, which
 * has already started.
 */


/** What the scheduler came with: someone who's had a plan before gets no new trial. */
function usePlanWord() {
  const { usage } = useUserUsage();
  return usage?.user.status === "active" ? "plan" : "free trial";
}

export function CreditsAskStep({ ctx, finishing }: { ctx: SetupContext; finishing?: boolean }) {
  const { packs } = useCreditPacks();
  const planWord = usePlanWord();
  const lowest = packs?.length ? Math.min(...packs.map((pack) => pack.priceUsd)) : null;
  const showPacks = () =>
    window.history.pushState(null, "", ctx.hrefFor("credits", { [VIEW_PARAM]: PACKS_VIEW }));

  return (
    <section className="mx-auto w-full max-w-xl">
      <StepHeader
        eyebrow="Scheduler unlocked"
        title="Do you also need clipping and AI credits?"
        lead={`Scheduling is included in your ${planWord}. Clipping and AI creation use credits.`}
      />

      <ul className={cn(CARD, "mt-10 divide-y")}>
        <li className="flex items-center gap-4 p-4 sm:p-5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
            <CalendarCheck className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">Scheduling and posting</p>
            <p className="text-sm text-muted-foreground">Unlocked with your {planWord}.</p>
          </div>
          <Check className="size-4 shrink-0 text-success" weight="bold" />
        </li>
        <li className="flex items-center gap-4 p-4 sm:p-5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Scissors className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">Clipping and AI creation</p>
            <p className="text-sm text-muted-foreground">
              Needs credits{lowest !== null ? `, from ${formatUsd(lowest)}` : ""}.
            </p>
          </div>
        </li>
      </ul>

      <StepFooter back={null}>
        <Button size="lg" variant="outline" className="max-sm:flex-1" onClick={ctx.next} disabled={finishing}>
          {finishing ? <Spinner data-icon="inline-start" /> : null}
          Skip for now
        </Button>
        <Button size="lg" onClick={showPacks} disabled={finishing}>
          Yes, add credits
          <ArrowRight data-icon="inline-end" />
        </Button>
      </StepFooter>
    </section>
  );
}

export function CreditPacksStep({ ctx, finishing }: { ctx: SetupContext; finishing?: boolean }) {
  const searchParams = useSearchParams();
  const { authFetch } = useAuthFetch();
  const queryClient = useQueryClient();
  const { packs, loading, error, refetch } = useCreditPacks();
  const planWord = usePlanWord();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  // One id per pack on this screen, so trying again after an error or a lost
  // response can't charge the card a second time.
  const requestIds = useRef(new Map<string, string>());

  // In the URL so a reload keeps it, and a purchase that went through Stripe
  // Checkout comes back to the same place.
  const bought = searchParams.get(TOPUP_PARAM) === "success";
  const boughtCredits = Number(searchParams.get(CREDITS_PARAM) || 0);
  const packsHref = (extra: Record<string, string> = {}) =>
    ctx.hrefFor("credits", { [VIEW_PARAM]: PACKS_VIEW, ...extra });

  const buy = async (pack: CreditPack) => {
    setPendingKey(pack.key);
    const requestId = requestIds.current.get(pack.key) ?? crypto.randomUUID();
    requestIds.current.set(pack.key, requestId);
    try {
      const res = await authFetch("/api/stripe/buy-credits", {
        method: "POST",
        body: JSON.stringify({
          packKey: pack.key,
          requestId,
          returnPath: packsHref(),
        }),
      });
      const data = await res.json().catch(() => null);
      // The card can't be charged here: Stripe takes it from there.
      if (typeof data?.url === "string" && data.url) {
        window.location.assign(data.url);
        return;
      }
      if (!res.ok || !data?.success) {
        toast.error("Couldn't buy credits", { description: data?.error || "Try again in a moment." });
        setPendingKey(null);
        return;
      }
      void queryClient.invalidateQueries({ queryKey: userUsageQueryKeys.all });
      window.history.replaceState(
        null,
        "",
        packsHref({ [TOPUP_PARAM]: "success", [CREDITS_PARAM]: String(data.credits) }),
      );
    } catch {
      toast.error("Couldn't buy credits", { description: "Check your connection and try again." });
      setPendingKey(null);
    }
  };

  if (bought) {
    return (
      <section className="mx-auto w-full max-w-xl">
        <StepHeader
          title={boughtCredits > 0 ? `${boughtCredits.toLocaleString()} credits added` : "Credits added"}
          lead="You're ready to clip and create. Credits never expire."
        />
        <div className="mt-10 flex justify-center">
          <span className="flex size-16 animate-in items-center justify-center rounded-full bg-brand text-brand-foreground duration-300 zoom-in-75 fade-in">
            <Check className="size-8" weight="bold" />
          </span>
        </div>
        <StepFooter back={null}>
          <Button size="lg" onClick={ctx.next} disabled={finishing}>
            {finishing ? <Spinner data-icon="inline-start" /> : null}
            Proceed
            {finishing ? null : <ArrowRight data-icon="inline-end" />}
          </Button>
        </StepFooter>
      </section>
    );
  }

  const busy = pendingKey !== null;
  const back = () => window.history.pushState(null, "", ctx.hrefFor("credits"));

  return (
    <section className="mx-auto w-full max-w-6xl">
      <StepHeader
        title="Add clipping and AI credits"
        lead="One click to buy. Credits never expire."
      />

      <div className="mt-10">
        {loading ? (
          <CardGridSkeleton />
        ) : error ? (
          <ErrorState title="Couldn't load credit packs" description={error} onRetry={() => void refetch()} />
        ) : !packs?.length ? (
          <EmptyState title="No credit packs right now" description="You can add credits later from Billing." />
        ) : (
          <>
            <ul className={cardGridClass(packs.length)}>
              {packs.map((pack) => (
                <li key={pack.key} className={cardItemClass(packs.length)}>
                  <PackCard
                    pack={pack}
                    highlight={Boolean(pack.popular)}
                    badge={pack.popular ? "Popular" : undefined}
                    action={{
                      label: `Buy for ${formatUsd(pack.priceUsd)}`,
                      onClick: () => void buy(pack),
                      pending: pendingKey === pack.key,
                      disabled: busy || finishing,
                    }}
                  />
                </li>
              ))}
            </ul>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              It all comes from the same credits: each number is the whole pack spent on just that,
              at standard settings.
              <br />
              Charged now to the card you just added, separate from your {planWord}.
            </p>
          </>
        )}
      </div>

      <StepFooter back={busy ? null : back}>
        <Button size="lg" variant="outline" onClick={ctx.next} disabled={busy || finishing}>
          {finishing ? <Spinner data-icon="inline-start" /> : null}
          Skip for now
        </Button>
      </StepFooter>
    </section>
  );
}
