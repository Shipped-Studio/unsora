"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatUsd } from "@/components/billing/format";
import {
  useSavePlan,
  type AdminPlan,
  type PlanInput,
  type PlanInterval,
  type PlanType,
} from "@/hooks/admin/use-admin-plans";

export const PLAN_TYPE_LABEL: Record<PlanType, string> = {
  SUBSCRIPTION: "Subscription plan",
  TOPUP: "Credit pack",
  PROMO: "Promo grant",
};

const TYPE_ITEMS = (Object.keys(PLAN_TYPE_LABEL) as PlanType[]).map((value) => ({
  value,
  label: PLAN_TYPE_LABEL[value],
}));

const INTERVAL_ITEMS: { value: PlanInterval; label: string }[] = [
  { value: "MONTH", label: "Monthly" },
  { value: "YEAR", label: "Yearly" },
];

function slugify(name: string, type: PlanType) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return type === "TOPUP" && slug && !slug.startsWith("topup_") ? `topup_${slug}` : slug;
}

interface FormState {
  type: PlanType;
  name: string;
  key: string;
  keyTouched: boolean;
  description: string;
  price: string;
  interval: PlanInterval;
  credits: string;
  socialAccounts: string;
  features: string;
  trialDays: string;
  sortOrder: string;
  isPopular: boolean;
  isActive: boolean;
  stripePriceId: string;
}

function initialState(plan: AdminPlan | null, type: PlanType): FormState {
  return {
    type: plan?.type ?? type,
    name: plan?.name ?? "",
    key: plan?.key ?? "",
    keyTouched: !!plan,
    description: plan?.description ?? "",
    price: plan ? String(plan.priceCents / 100) : "",
    interval: plan?.interval ?? "MONTH",
    credits: plan ? String(plan.credits) : "",
    socialAccounts: plan?.socialAccounts != null ? String(plan.socialAccounts) : "",
    features: plan?.features.join("\n") ?? "",
    trialDays: plan?.trialDays != null ? String(plan.trialDays) : "3",
    sortOrder: plan ? String(plan.sortOrder) : "",
    isPopular: plan?.isPopular ?? false,
    isActive: plan?.isActive ?? true,
    stripePriceId: plan?.stripePriceId ?? "",
  };
}

/**
 * Create or edit one row of the `plans` table. Open it with `plan` to edit,
 * or `plan={null}` and a `type` to create. The parent remounts it per plan
 * (via `key`) so the form starts from that plan's values.
 */
export function PlanDialog({
  open,
  onOpenChange,
  plan,
  type = "SUBSCRIPTION",
  stripeMode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: AdminPlan | null;
  type?: PlanType;
  stripeMode: "live" | "test";
}) {
  const save = useSavePlan();
  const [form, setForm] = useState(() => initialState(plan, type));
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const isTrial = plan?.key === "trial";
  const isSub = form.type === "SUBSCRIPTION";
  const sellable = form.type !== "PROMO";
  const priceCents = Math.round(Number(form.price || 0) * 100);
  const priceChanged =
    !!plan &&
    sellable &&
    (plan.priceCents !== priceCents || (isSub && plan.interval !== form.interval));
  const manualPrice = form.stripePriceId.trim() !== (plan?.stripePriceId ?? "");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const credits = Number(form.credits);
    if (!form.name.trim()) return toast.error("Give the plan a name");
    if (!plan && !form.key.trim()) return toast.error("Give the plan a key");
    if (!Number.isInteger(credits) || credits < 0) {
      return toast.error("Credits must be a whole number");
    }
    if (sellable && !(priceCents > 0)) return toast.error("Set a price above $0");

    const input: PlanInput = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      credits,
      isActive: form.isActive,
      isPopular: form.isPopular,
      ...(form.sortOrder.trim() ? { sortOrder: Number(form.sortOrder) } : {}),
    };
    if (!plan) {
      input.type = form.type;
      input.key = form.key.trim();
    }
    if (sellable) input.priceCents = priceCents;
    if (isSub) {
      input.interval = form.interval;
      input.socialAccounts = form.socialAccounts.trim() ? Number(form.socialAccounts) : null;
      input.features = form.features.split("\n").map((l) => l.trim()).filter(Boolean);
    }
    if (isTrial) input.trialDays = Number(form.trialDays || 0);
    if (sellable && manualPrice) input.stripePriceId = form.stripePriceId.trim() || null;

    try {
      await save.mutateAsync({ id: plan?.id, input });
      toast.success(plan ? `${input.name} saved` : `${input.name} created`);
      onOpenChange(false);
    } catch (err) {
      toast.error("Couldn't save the plan", { description: (err as Error).message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b p-6 pr-12">
          <DialogTitle>
            {plan ? `Edit ${plan.name}` : `New ${PLAN_TYPE_LABEL[form.type].toLowerCase()}`}
          </DialogTitle>
          <DialogDescription>
            {isTrial
              ? "New subscribers get this trial on their first subscription, with these credits instead of the plan's."
              : form.type === "SUBSCRIPTION"
                ? "A recurring plan. Its credits are granted every billing period and expire at the end of it."
                : form.type === "TOPUP"
                  ? "A one-time credit pack subscribers can buy. Its credits never expire."
                  : "Credits granted outside checkout."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="overflow-y-auto overscroll-contain p-6">
            <FieldGroup className="gap-4">
              {!plan ? (
                <Field>
                  <FieldLabel htmlFor="plan-type">Type</FieldLabel>
                  <Select
                    value={form.type}
                    items={TYPE_ITEMS}
                    onValueChange={(v) => {
                      const t = (v as PlanType | null) ?? "SUBSCRIPTION";
                      setForm((f) => ({
                        ...f,
                        type: t,
                        key: f.keyTouched ? f.key : slugify(f.name, t),
                      }));
                    }}
                  >
                    <SelectTrigger id="plan-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPE_ITEMS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="plan-name">Name</FieldLabel>
                  <Input
                    id="plan-name"
                    value={form.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setForm((f) => ({
                        ...f,
                        name,
                        key: f.keyTouched ? f.key : slugify(name, f.type),
                      }));
                    }}
                    placeholder={isSub ? "Creator" : "Mega pack"}
                    autoFocus={!plan}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="plan-key">Key</FieldLabel>
                  <Input
                    id="plan-key"
                    value={form.key}
                    disabled={!!plan}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        key: e.target.value.toLowerCase(),
                        keyTouched: true,
                      }))
                    }
                    className="font-mono"
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="plan-description">Description</FieldLabel>
                <Input
                  id="plan-description"
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Optional, shown on the pricing card"
                />
              </Field>

              {sellable ? (
                <div className={isSub ? "grid gap-4 sm:grid-cols-2" : undefined}>
                  <Field>
                    <FieldLabel htmlFor="plan-price">Price</FieldLabel>
                    <InputGroup>
                      <InputGroupAddon>$</InputGroupAddon>
                      <InputGroupInput
                        id="plan-price"
                        inputMode="decimal"
                        value={form.price}
                        onChange={(e) => set("price", e.target.value)}
                        placeholder="19"
                      />
                    </InputGroup>
                  </Field>
                  {isSub ? (
                    <Field>
                      <FieldLabel htmlFor="plan-interval">Billed</FieldLabel>
                      <Select
                        value={form.interval}
                        items={INTERVAL_ITEMS}
                        onValueChange={(v) =>
                          set("interval", (v as PlanInterval | null) ?? "MONTH")
                        }
                      >
                        <SelectTrigger id="plan-interval" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {INTERVAL_ITEMS.map((i) => (
                            <SelectItem key={i.value} value={i.value}>
                              {i.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  ) : null}
                </div>
              ) : null}

              {priceChanged && plan && (plan.subscribers ?? 0) > 0 ? (
                <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                  {plan.subscribers} current subscriber{plan.subscribers === 1 ? "" : "s"} keep
                  paying {formatUsd(plan.priceCents / 100)}. New checkouts and plan switches use
                  the new price.
                </p>
              ) : null}

              <div className={isSub ? "grid gap-4 sm:grid-cols-2" : undefined}>
                <Field>
                  <FieldLabel htmlFor="plan-credits">
                    {isSub
                      ? `Credits per ${form.interval === "YEAR" ? "year" : "month"}`
                      : isTrial
                        ? "Trial credits"
                        : "Credits"}
                  </FieldLabel>
                  <Input
                    id="plan-credits"
                    inputMode="numeric"
                    value={form.credits}
                    onChange={(e) => set("credits", e.target.value)}
                    placeholder="500"
                  />
                </Field>
                {isSub ? (
                  <Field>
                    <FieldLabel htmlFor="plan-accounts">Social accounts</FieldLabel>
                    <Input
                      id="plan-accounts"
                      inputMode="numeric"
                      value={form.socialAccounts}
                      onChange={(e) => set("socialAccounts", e.target.value)}
                      placeholder="10"
                    />
                  </Field>
                ) : null}
              </div>

              {isTrial ? (
                <Field>
                  <FieldLabel htmlFor="plan-trial-days">Trial length (days)</FieldLabel>
                  <Input
                    id="plan-trial-days"
                    inputMode="numeric"
                    value={form.trialDays}
                    onChange={(e) => set("trialDays", e.target.value)}
                  />
                  <FieldDescription>
                    Applies to every plan. 0 starts subscriptions without a trial.
                  </FieldDescription>
                </Field>
              ) : null}

              {isSub ? (
                <Field>
                  <FieldLabel htmlFor="plan-features">Features</FieldLabel>
                  <Textarea
                    id="plan-features"
                    rows={5}
                    value={form.features}
                    onChange={(e) => set("features", e.target.value)}
                    placeholder={"10 social accounts\nScheduling, calendar and analytics"}
                  />
                  <FieldDescription>One per line, shown on the pricing card.</FieldDescription>
                </Field>
              ) : null}

              {!isTrial ? (
                <>
                  <Field>
                    <FieldLabel htmlFor="plan-sort">Position</FieldLabel>
                    <Input
                      id="plan-sort"
                      inputMode="numeric"
                      value={form.sortOrder}
                      onChange={(e) => set("sortOrder", e.target.value)}
                      placeholder="10"
                    />
                    <FieldDescription>Lower numbers are listed first.</FieldDescription>
                  </Field>
                  {sellable ? (
                    <Field orientation="horizontal">
                      <FieldLabel htmlFor="plan-popular" className="font-normal">
                        Highlight as most popular
                      </FieldLabel>
                      <Switch
                        id="plan-popular"
                        checked={form.isPopular}
                        onCheckedChange={(v) => set("isPopular", v)}
                      />
                    </Field>
                  ) : null}
                </>
              ) : null}
              <Field orientation="horizontal">
                <FieldLabel htmlFor="plan-active" className="font-normal">
                  {isTrial ? "Offer a free trial" : "Available to buy"}
                </FieldLabel>
                <Switch
                  id="plan-active"
                  checked={form.isActive}
                  onCheckedChange={(v) => set("isActive", v)}
                />
              </Field>

              {sellable ? (
                <Field>
                  <FieldLabel htmlFor="plan-stripe-price">Stripe price ID</FieldLabel>
                  <Input
                    id="plan-stripe-price"
                    value={form.stripePriceId}
                    onChange={(e) => set("stripePriceId", e.target.value)}
                    placeholder="Created automatically"
                    className="font-mono"
                  />
                  <FieldDescription>
                    Leave as is and saving creates or updates the product and price in your{" "}
                    {stripeMode} Stripe account. Paste an existing price ID to use that one
                    instead.
                  </FieldDescription>
                </Field>
              ) : null}
            </FieldGroup>
          </div>

          <DialogFooter className="border-t p-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <Spinner data-icon="inline-start" /> : null}
              {plan ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
