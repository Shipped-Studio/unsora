"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AdminPage } from "@/components/admin/admin-page";
import { PlanDialog } from "@/components/admin/plan-dialog";
import { formatUsd, intervalLabel } from "@/components/billing/format";
import { ErrorState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  useAdminPlans,
  useGenerationPricing,
  useSaveGenerationPricing,
  useSavePlan,
  type AdminPlan,
  type PlanType,
  type PricingConfig,
} from "@/hooks/admin/use-admin-plans";
import { cn } from "@/lib/utils";

// Card fees for a US card, used to estimate what each credit actually earns.
const STRIPE_PCT = 0.029;
const STRIPE_FIXED = 0.3;

type DialogState = { plan: AdminPlan | null; type: PlanType } | null;

export default function AdminPricingPage() {
  const plans = useAdminPlans();
  const pricing = useGenerationPricing();
  const [dialog, setDialog] = useState<DialogState>(null);

  const all = plans.data?.plans ?? [];
  const subs = all.filter((p) => p.type === "SUBSCRIPTION");
  const packs = all.filter((p) => p.type === "TOPUP");
  const trial = all.find((p) => p.key === "trial") ?? null;
  const promos = all.filter((p) => p.type === "PROMO" && p.key !== "trial");
  const stripeMode = plans.data?.stripeMode ?? "test";

  return (
    <AdminPage
      title="Pricing"
      description="Plans, credit packs, the free trial and what generations cost in credits"
      actions={
        <Button
          size="sm"
          disabled={!plans.data}
          onClick={() => setDialog({ plan: null, type: "SUBSCRIPTION" })}
        >
          New plan
        </Button>
      }
    >
      {plans.error && !plans.data ? (
        <ErrorState
          title="Couldn't load plans"
          description={plans.error.message}
          onRetry={() => void plans.refetch()}
        />
      ) : plans.isLoading || !plans.data ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {stripeMode === "live" ? (
            <p className="rounded-xl bg-muted px-4 py-3 text-sm">
              This server uses your <span className="font-medium">live</span> Stripe account.
              Saving a price creates a real Stripe price that customers are charged.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              This server uses Stripe <span className="font-medium text-foreground">test mode</span>.
              Plans saved here exist only in that environment&apos;s database and Stripe account.
            </p>
          )}

          <Section
            title="Subscription plans"
            note="Shown on the pricing dialog to free users and subscribers switching plans."
            onAdd={() => setDialog({ plan: null, type: "SUBSCRIPTION" })}
            addLabel="Add plan"
          >
            <PlanList plans={subs} onEdit={(plan) => setDialog({ plan, type: plan.type })} />
          </Section>

          <Section
            title="Credit packs"
            note="One-time top-ups for subscribers. Pack credits never expire."
            onAdd={() => setDialog({ plan: null, type: "TOPUP" })}
            addLabel="Add pack"
          >
            <PlanList plans={packs} onEdit={(plan) => setDialog({ plan, type: plan.type })} />
          </Section>

          <Section title="Free trial" note="Given on a user's first subscription.">
            {trial ? (
              <PlanList plans={[trial]} onEdit={(plan) => setDialog({ plan, type: plan.type })} />
            ) : (
              <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                No <code className="font-mono">trial</code> row exists, so subscriptions start
                without a trial.
              </p>
            )}
          </Section>

          {promos.length ? (
            <Section title="Other grants">
              <PlanList plans={promos} onEdit={(plan) => setDialog({ plan, type: plan.type })} />
            </Section>
          ) : null}

          <Section
            title="Generation pricing"
            note="Video, image and motion-control prices come live from the provider. This turns their cost into credits."
          >
            {pricing.error && !pricing.data ? (
              <ErrorState
                title="Couldn't load generation pricing"
                description={pricing.error.message}
                onRetry={() => void pricing.refetch()}
              />
            ) : !pricing.data ? (
              <Skeleton className="h-40 rounded-xl" />
            ) : (
              <GenerationPricing
                key={`${pricing.data.margin}:${pricing.data.creditUsd}`}
                config={pricing.data}
                plans={[...subs, ...packs].filter((p) => p.isActive && p.credits > 0)}
              />
            )}
          </Section>
        </div>
      )}

      {dialog ? (
        <PlanDialog
          key={dialog.plan?.id ?? `new-${dialog.type}`}
          open
          onOpenChange={(open) => !open && setDialog(null)}
          plan={dialog.plan}
          type={dialog.type}
          stripeMode={stripeMode}
        />
      ) : null}
    </AdminPage>
  );
}

function Section({
  title,
  note,
  onAdd,
  addLabel,
  children,
}: {
  title: string;
  note?: string;
  onAdd?: () => void;
  addLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-medium">{title}</h2>
          {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
        </div>
        {onAdd ? (
          <Button size="sm" variant="outline" onClick={onAdd}>
            {addLabel}
          </Button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function summary(plan: AdminPlan): string {
  const parts: string[] = [];
  if (plan.key === "trial") {
    parts.push(plan.isActive ? `${plan.trialDays ?? 3} days` : "No trial");
    parts.push(`${plan.credits.toLocaleString()} credits`);
    return parts.join(" · ");
  }
  if (plan.type !== "PROMO") {
    const per = intervalLabel(plan.interval);
    parts.push(`${formatUsd(plan.priceCents / 100)}${per ? ` / ${per}` : ""}`);
  }
  parts.push(`${plan.credits.toLocaleString()} credits`);
  if (plan.type === "SUBSCRIPTION") {
    if (plan.socialAccounts != null) parts.push(`${plan.socialAccounts} social accounts`);
    parts.push(`${plan.subscribers ?? 0} active`);
  }
  if (plan.type !== "PROMO" && plan.credits > 0 && plan.priceCents > 0) {
    parts.push(`${formatUsd(plan.priceCents / 100 / plan.credits)}/credit`);
  }
  return parts.join(" · ");
}

function PlanList({ plans, onEdit }: { plans: AdminPlan[]; onEdit: (plan: AdminPlan) => void }) {
  const save = useSavePlan();

  if (!plans.length) {
    return (
      <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">Nothing here yet.</p>
    );
  }

  const toggle = (plan: AdminPlan, on: boolean) =>
    save.mutate(
      { id: plan.id, input: { isActive: on } },
      {
        onSuccess: () => toast.success(`${plan.name} ${on ? "switched on" : "switched off"}`),
        onError: (err) => toast.error(err.message),
      },
    );

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl bg-muted">
      {plans.map((plan) => (
        <li key={plan.id} className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("text-sm font-medium", !plan.isActive && "text-muted-foreground")}>
                {plan.name}
              </span>
              <code className="font-mono text-xs text-muted-foreground">{plan.key}</code>
              {plan.isPopular ? <Badge variant="secondary">Popular</Badge> : null}
              {!plan.isActive ? <Badge variant="outline">Off</Badge> : null}
              {plan.type === "SUBSCRIPTION" && !plan.stripePriceId ? (
                <Badge variant="outline">No Stripe price</Badge>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground tabular-nums">
              {summary(plan)}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => onEdit(plan)}>
            Edit
          </Button>
          <Switch
            checked={plan.isActive}
            disabled={save.isPending}
            aria-label={`${plan.name} available`}
            onCheckedChange={(on) => toggle(plan, on)}
          />
        </li>
      ))}
    </ul>
  );
}

/** Margin actually earned on a plan's credits after card fees. */
function effectiveMargin(plan: AdminPlan, margin: number, creditUsd: number) {
  const price = plan.priceCents / 100;
  const netPerCredit = (price * (1 - STRIPE_PCT) - STRIPE_FIXED) / plan.credits;
  // A credit costs us creditUsd / (1 + margin) of provider spend.
  return (netPerCredit * (1 + margin)) / creditUsd - 1;
}

function GenerationPricing({ config, plans }: { config: PricingConfig; plans: AdminPlan[] }) {
  const save = useSaveGenerationPricing();
  const [marginPct, setMarginPct] = useState(String(+(config.margin * 100).toFixed(2)));
  const [creditUsd, setCreditUsd] = useState(String(config.creditUsd));

  const m = Number(marginPct) / 100;
  const c = Number(creditUsd);
  const valid = Number.isFinite(m) && m >= 0 && m <= 10 && Number.isFinite(c) && c > 0;
  const dirty = valid && (m !== config.margin || c !== config.creditUsd);
  // What a $1.00 provider cost is charged at.
  const perDollar = valid ? Math.max(1, Math.ceil((1 + m) / c - 1e-9)) : null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return toast.error("Enter a margin of 0–1000% and a credit value above $0");
    save.mutate(
      { margin: m, creditUsd: c },
      {
        onSuccess: () => toast.success("Generation pricing saved"),
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="space-y-4 rounded-xl bg-muted p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="gen-margin">Margin</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="gen-margin"
                inputMode="decimal"
                value={marginPct}
                onChange={(e) => setMarginPct(e.target.value)}
              />
              <InputGroupAddon align="inline-end">%</InputGroupAddon>
            </InputGroup>
            <FieldDescription>Added on top of what the provider bills.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="gen-credit-usd">Credit value</FieldLabel>
            <InputGroup>
              <InputGroupAddon>$</InputGroupAddon>
              <InputGroupInput
                id="gen-credit-usd"
                inputMode="decimal"
                value={creditUsd}
                onChange={(e) => setCreditUsd(e.target.value)}
              />
            </InputGroup>
            <FieldDescription>Dollars one credit is costed at.</FieldDescription>
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {perDollar !== null
              ? `A generation that costs us $1.00 is charged ${perDollar} credits.`
              : "Enter both values to preview."}
            {config.source === "env" ? " Currently read from the server's environment." : ""}
          </p>
          <Button type="submit" size="sm" disabled={!dirty || save.isPending}>
            {save.isPending ? <Spinner data-icon="inline-start" /> : null}
            Save
          </Button>
        </div>
      </form>

      {valid && plans.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-xl bg-muted">
          {plans.map((plan) => {
            const eff = effectiveMargin(plan, m, c);
            return (
              <li key={plan.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 truncate">
                  {plan.name}
                  <span className="text-muted-foreground">
                    {" "}
                    · {formatUsd(plan.priceCents / 100 / plan.credits)}/credit
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 tabular-nums",
                    eff < 0 ? "font-medium text-destructive" : "text-muted-foreground",
                  )}
                >
                  {(eff * 100).toFixed(0)}% margin after fees
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Margin after fees assumes every credit is spent on generations and a 2.9% + 30¢ card fee.
        Fixed-price tools (voice, music, avatars, upscaling) keep their own credit prices. Changes
        apply within about 30 seconds.
      </p>
    </div>
  );
}
