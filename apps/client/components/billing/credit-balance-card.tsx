"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatLongDate } from "./format";

/**
 * The account's credits, above the subscriptions: they belong to the account,
 * not to either plan. The bar splits monthly credits (spent first, reset each
 * period) from top-ups (never expire).
 */
export function CreditBalanceCard({
  credits,
  monthly,
  subscribedToCredits,
  onTopUp,
  onGetMonthly,
}: {
  credits: number;
  monthly: { remaining: number; expiresAt: string | null } | null;
  subscribedToCredits: boolean;
  onTopUp: () => void;
  onGetMonthly: () => void;
}) {
  const monthlyLeft = Math.min(monthly?.remaining ?? 0, credits);
  const permanent = Math.max(0, credits - monthlyLeft);
  const resetsOn = formatLongDate(monthly?.expiresAt);
  const monthlyShare = credits > 0 ? (monthlyLeft / credits) * 100 : 0;

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 md:flex-row md:items-center md:gap-10">
        <div className="shrink-0">
          <p className="font-mono text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Credit balance
          </p>
          <p className="mt-2 font-display text-4xl font-semibold tracking-[-0.03em] tabular-nums">
            {credits.toLocaleString()}
            <span className="ml-2 font-sans text-base font-normal tracking-normal text-muted-foreground">
              credits
            </span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">For clipping and AI creation.</p>
        </div>

        {credits > 0 ? (
          <div className="min-w-0 flex-1 space-y-3">
            <div
              className="flex h-2 overflow-hidden rounded-full bg-foreground/10"
              role="img"
              aria-label={`${monthlyLeft.toLocaleString()} monthly credits and ${permanent.toLocaleString()} top-up credits`}
            >
              {monthlyLeft > 0 ? (
                <div className="h-full bg-foreground" style={{ width: `${monthlyShare}%` }} />
              ) : null}
              {permanent > 0 ? <div className="h-full flex-1 bg-foreground/35" /> : null}
            </div>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Legend
                swatch="bg-foreground"
                label="Monthly"
                value={monthlyLeft}
                note={
                  monthlyLeft > 0
                    ? resetsOn
                      ? `used first, until ${resetsOn}`
                      : "used first"
                    : subscribedToCredits
                      ? "used up this month"
                      : "no monthly plan"
                }
              />
              <Legend swatch="bg-foreground/35" label="Top-ups" value={permanent} note="never expire" />
            </dl>
          </div>
        ) : (
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            No credits yet. Get them every month, or buy a one-time pack when you need one.
          </p>
        )}

        <div className="flex shrink-0 gap-2">
          {subscribedToCredits ? null : (
            <Button onClick={onGetMonthly}>Get monthly credits</Button>
          )}
          <Button variant="outline" onClick={onTopUp}>
            Top up
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Legend({
  swatch,
  label,
  value,
  note,
}: {
  swatch: string;
  label: string;
  value: number;
  note: string;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span aria-hidden className={`size-2 shrink-0 translate-y-[-1px] rounded-full ${swatch}`} />
      <dt className="sr-only">{label}</dt>
      <dd className="min-w-0">
        <span className="font-medium tabular-nums">{value.toLocaleString()}</span>{" "}
        <span className="text-muted-foreground">
          {label.toLowerCase()}, {note}
        </span>
      </dd>
    </div>
  );
}
