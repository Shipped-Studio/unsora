"use client";

import { Hourglass } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface TrialSectionProps {
  planName: string;
  onActivate: () => void;
  onCancelTrial: () => void;
  isActivating: boolean;
  isCancellingTrial: boolean;
}

/**
 * Shown on the billing page when the user is in a trial period.
 * Offers two paths: convert to paid immediately, or cancel and revert to free.
 */
export function TrialSection({
  planName,
  onActivate,
  onCancelTrial,
  isActivating,
  isCancellingTrial,
}: TrialSectionProps) {
  return (
    <Card className="mb-8 border-warning/30 bg-warning/5 ring-warning/20">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-warning/15">
              <Hourglass weight="fill" className="size-5 text-warning" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold text-warning">
                You&apos;re on a free trial.
              </CardTitle>
              <CardDescription className="text-xs">
                Activate your {planName} plan now to keep access, or cancel the
                trial to return to the free tier.
              </CardDescription>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onCancelTrial}
              disabled={isCancellingTrial || isActivating}
            >
              {isCancellingTrial ? "Cancelling…" : "Cancel Trial"}
            </Button>
            <Button
              size="sm"
              onClick={onActivate}
              disabled={isActivating || isCancellingTrial}
            >
              {isActivating ? "Activating…" : "Activate Plan Now"}
            </Button>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
