"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Tag, Warning } from "@phosphor-icons/react";
import { promotionHeadline } from "@/components/promotion/promo-banner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useSavePromotion, type AdminPlan, type AdminPromotion } from "@/hooks/admin/use-admin-plans";
import { discountLabel, durationLabel } from "@/hooks/use-promotion";

/**
 * The featured promotion: a Stripe promotion code to advertise in the app's
 * banner and on the landing page, shown as crossed-out prices on the plans
 * it covers and applied at checkout by itself. The discount and which plans
 * it covers are set on the coupon in Stripe; this only picks the code.
 */
export function PromotionForm({ data, plans }: { data: AdminPromotion; plans: AdminPlan[] }) {
  const save = useSavePromotion();
  const [code, setCode] = useState(data.setting?.code ?? "");
  const [bannerText, setBannerText] = useState(data.setting?.bannerText ?? "");
  const [enabled, setEnabled] = useState(data.setting?.enabled ?? true);

  const promo = data.promotion;
  const planNames = promo
    ? plans.filter((p) => promo.planKeys.includes(p.key)).map((p) => p.name)
    : [];
  const dirty =
    code.trim().toUpperCase() !== (data.setting?.code ?? "") ||
    bannerText.trim() !== (data.setting?.bannerText ?? "") ||
    enabled !== (data.setting?.enabled ?? true);

  const submit = (value: { code: string; enabled: boolean; bannerText: string }) =>
    save.mutate(value, {
      onSuccess: (next) => {
        setCode(next.setting?.code ?? "");
        toast.success(next.setting ? "Promotion saved" : "Promotion removed");
      },
      onError: (err) => toast.error("Couldn't save the promotion", { description: err.message }),
    });

  return (
    <div className="space-y-4 rounded-xl p-4 ring-1 ring-border">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
        <Field>
          <FieldLabel htmlFor="promo-code">Promotion code</FieldLabel>
          <Input
            id="promo-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="GTA6"
            className="font-mono tracking-wider"
            autoComplete="off"
          />
          <FieldDescription>As created in Stripe under the coupon.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="promo-banner">Banner text (optional)</FieldLabel>
          <Input
            id="promo-banner"
            value={bannerText}
            maxLength={140}
            onChange={(e) => setBannerText(e.target.value)}
            placeholder={promo ? promotionHeadline({ ...promo, bannerText: null }) : "Written from the discount"}
          />
          <FieldDescription>Left empty, it&apos;s written from the discount.</FieldDescription>
        </Field>
      </div>

      <label className="flex items-center gap-3 text-sm">
        <Switch checked={enabled} onCheckedChange={setEnabled} />
        Show it to customers (banner, prices and checkout)
      </label>

      {data.setting && data.problem ? (
        <p className="flex items-start gap-2 rounded-lg bg-destructive-subtle px-3 py-2 text-sm text-destructive">
          <Warning className="mt-0.5 size-4 shrink-0" weight="fill" />
          {data.problem} Nothing is shown to customers until it&apos;s fixed.
        </p>
      ) : null}

      {promo ? (
        <div className="rounded-lg bg-muted px-3 py-2.5 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <Tag className="size-4" weight="fill" />
            {discountLabel(promo)} {durationLabel(promo)}
            {data.setting?.enabled ? null : <span className="font-normal text-muted-foreground">· switched off</span>}
          </p>
          <p className="mt-1 text-muted-foreground">
            On {planNames.length ? planNames.join(", ") : promo.planKeys.join(", ")}
            {" · "}
            {promo.remaining !== null ? `${promo.remaining.toLocaleString()} uses left` : "No use limit"}
            {" · "}
            {promo.expiresAt ? `ends ${new Date(promo.expiresAt).toLocaleDateString()}` : "No end date"}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={save.isPending || !code.trim() || !dirty}
          onClick={() => submit({ code: code.trim(), enabled, bannerText: bannerText.trim() })}
        >
          {save.isPending ? <Spinner data-icon="inline-start" /> : null}
          Save
        </Button>
        {data.setting ? (
          <Button
            size="sm"
            variant="outline"
            disabled={save.isPending}
            onClick={() => submit({ code: "", enabled: false, bannerText: "" })}
          >
            Remove promotion
          </Button>
        ) : null}
      </div>
    </div>
  );
}
