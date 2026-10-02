"use client";

import Link from "next/link";
import { Check, Warning } from "@phosphor-icons/react";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AccountAvatar,
  accountLabel,
} from "@/components/scheduler/account-avatar";
import {
  PLATFORMS,
  PLATFORM_ORDER,
  isProvider,
  supportsFormat,
  unsupportedReason,
  type PostFormat,
} from "@/lib/scheduler/formats";
import type { ConnectedAccount } from "@/lib/scheduler/types";
import { cn } from "@/lib/utils";

function sortAccounts(accounts: ConnectedAccount[]) {
  const rank = (provider: string) => {
    const index = PLATFORM_ORDER.indexOf(provider as never);
    return index === -1 ? 99 : index;
  };
  return [...accounts].sort(
    (a, b) => rank(a.provider) - rank(b.provider) || accountLabel(a).localeCompare(accountLabel(b)),
  );
}

export function AccountPicker({
  accounts,
  loading,
  format,
  selected,
  locked = [],
  onToggle,
  onSelectMany,
}: {
  accounts: ConnectedAccount[];
  loading: boolean;
  format: PostFormat;
  selected: string[];
  /** Accounts that already published and can't be removed. */
  locked?: string[];
  onToggle: (accountId: string) => void;
  onSelectMany: (accountIds: string[]) => void;
}) {
  if (loading) {
    return (
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-40 rounded-lg" />
        ))}
      </div>
    );
  }

  const visible = sortAccounts(
    accounts.filter((a) => !isProvider(a.provider) || PLATFORMS[a.provider].enabled),
  );

  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl bg-muted p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Connect a social account to choose where this goes.
        </p>
        <Link
          href="/scheduler/accounts"
          className={buttonVariants({ size: "sm" })}
        >
          Connect an account
        </Link>
      </div>
    );
  }

  const eligible = visible.filter((a) => supportsFormat(a.provider, format));
  const allEligibleSelected =
    eligible.length > 0 && eligible.every((a) => selected.includes(a.id));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {visible.map((account) => {
          const supported = supportsFormat(account.provider, format);
          const isSelected = selected.includes(account.id);
          const isLocked = locked.includes(account.id);
          const needsReconnect = account.status === "reconnect";
          const disabled = (!supported && !isSelected) || isLocked;

          const chip = (
            <button
              type="button"
              aria-pressed={isSelected}
              disabled={disabled}
              onClick={() => onToggle(account.id)}
              className={cn(
                "group/chip flex h-10 max-w-60 items-center gap-2 rounded-xl bg-muted pr-3 pl-1.5 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                isSelected
                  ? "border-foreground/40 bg-accent"
                  : "hover:bg-secondary",
                disabled && "cursor-not-allowed opacity-45 hover:bg-card",
                isSelected && !supported && "border-destructive/50",
              )}
            >
              <AccountAvatar account={account} size="sm" />
              <span className="min-w-0 truncate">{accountLabel(account)}</span>
              {needsReconnect ? (
                <Warning weight="fill" className="size-3.5 shrink-0 text-warning" />
              ) : null}
              <span
                className={cn(
                  "ml-auto flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input",
                )}
              >
                {isSelected ? <Check weight="bold" className="size-2.5" /> : null}
              </span>
            </button>
          );

          const reason = isLocked
            ? "Already published to this account."
            : !supported
              ? unsupportedReason(account.provider, format)
              : needsReconnect
                ? account.statusReason ?? "Reconnect this account to publish."
                : null;

          if (!reason) return <span key={account.id}>{chip}</span>;
          return (
            <Tooltip key={account.id}>
              <TooltipTrigger render={<span className="inline-flex" />}>{chip}</TooltipTrigger>
              <TooltipContent>{reason}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      {eligible.length > 1 ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0 text-muted-foreground"
          onClick={() =>
            onSelectMany(
              allEligibleSelected
                ? selected.filter((id) => locked.includes(id))
                : Array.from(new Set([...selected, ...eligible.map((a) => a.id)])),
            )
          }
        >
          {allEligibleSelected ? "Clear selection" : `Select all ${eligible.length} that support this format`}
        </Button>
      ) : null}
    </div>
  );
}
