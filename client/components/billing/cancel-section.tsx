"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

interface CancelSectionProps {
  /**
   * `true` when the subscription is still active but has been scheduled to
   * cancel at period end. Switches the card from "Cancel Plan" to
   * "Subscription Ending" with a Resume CTA instead.
   */
  isCancelled: boolean;
  /** ISO date string for when the active period ends. Used for the "Ends on …" copy. */
  periodEnd: string | null;
  /** True while the resume mutation is in flight. */
  isResuming?: boolean;
  onCancelClick: () => void;
  onResumeClick: () => void;
}

function formatPeriodEnd(periodEnd: string | null): string | null {
  if (!periodEnd) return null;
  const date = new Date(periodEnd);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Bottom strip on the billing page. Renders one of two states:
 *   - Active subscription   → destructive "Cancel Plan" CTA.
 *   - Cancellation pending  → neutral "Subscription Ending" card with a
 *                             Resume button so the user can undo the cancel
 *                             without going through Stripe's billing portal.
 *
 * The actual cancellation flow still lives in `CancelSubscriptionDialog`.
 */
export function CancelSection({
  isCancelled,
  periodEnd,
  isResuming = false,
  onCancelClick,
  onResumeClick,
}: CancelSectionProps) {
  if (isCancelled) {
    const endsOn = formatPeriodEnd(periodEnd);
    return (
      <Card className="ring-warning/20">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-warning">
            Subscription Ending
          </CardTitle>
          <CardDescription className="text-xs">
            {endsOn
              ? `Your plan is scheduled to cancel on ${endsOn}. You'll keep full access until then.`
              : "Your plan is scheduled to cancel at the end of the current billing period. You'll keep full access until then."}
          </CardDescription>
          <CardAction>
            <Button
              variant="default"
              size="sm"
              disabled={isResuming}
              onClick={onResumeClick}
            >
              {isResuming ? <Spinner /> : "Resume Subscription"}
            </Button>
          </CardAction>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="ring-destructive/20">
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-destructive">
          Cancel Plan
        </CardTitle>
        <CardDescription className="text-xs">
          Cancel your subscription. You&apos;ll keep access until the end of
          your current billing period.
        </CardDescription>
        <CardAction>
          <Button variant="destructive" size="sm" onClick={onCancelClick}>
            Cancel Plan
          </Button>
        </CardAction>
      </CardHeader>
    </Card>
  );
}
