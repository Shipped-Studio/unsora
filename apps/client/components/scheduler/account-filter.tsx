"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UsersThree } from "@phosphor-icons/react";
import {
  AccountAvatar,
  accountHandle,
  accountLabel,
} from "@/components/scheduler/account-avatar";
import { PlatformIcon } from "@/components/scheduler/platform-icon";
import { PLATFORM_ORDER, platformName } from "@/lib/scheduler/formats";
import type { AccountSummary } from "@/lib/scheduler/types";
import { cn } from "@/lib/utils";

/**
 * Account picker for list filters. Names alone are hard to tell apart once
 * there are a few accounts, so each option shows the avatar with its
 * platform badge and the handle, grouped by platform.
 */
export function AccountFilter({
  accounts,
  value,
  onChange,
  className,
  size,
}: {
  accounts: AccountSummary[] | undefined;
  /** Account id, or null for all accounts. */
  value: string | null;
  onChange: (accountId: string | null) => void;
  className?: string;
  size?: "sm" | "default";
}) {
  const list = accounts ?? [];
  const groups = [...new Set(list.map((a) => a.provider))]
    .sort((a, b) => {
      const ia = PLATFORM_ORDER.indexOf(a as (typeof PLATFORM_ORDER)[number]);
      const ib = PLATFORM_ORDER.indexOf(b as (typeof PLATFORM_ORDER)[number]);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    })
    .map((provider) => ({
      provider,
      accounts: list.filter((a) => a.provider === provider),
    }));

  return (
    <Select
      value={value || "all"}
      onValueChange={(next) => onChange(next === "all" ? null : (next as string))}
    >
      <SelectTrigger aria-label="Account" size={size} className={cn("min-w-0", className)}>
        <SelectValue>
          {(selected: string) => {
            const account = list.find((a) => a.id === selected);
            if (!account) {
              return (
                <span className="flex min-w-0 items-center gap-2">
                  <UsersThree className="size-4 text-muted-foreground" />
                  <span className="truncate">All accounts</span>
                </span>
              );
            }
            return (
              <span className="flex min-w-0 items-center gap-2">
                <AccountAvatar account={account} size="xs" />
                <span className="truncate">{accountLabel(account)}</span>
              </span>
            );
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="min-w-64">
        <SelectItem value="all">
          <span className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-full bg-accent text-muted-foreground">
              <UsersThree className="size-4" />
            </span>
            <span className="flex flex-col">
              <span>All accounts</span>
              <span className="text-xs text-muted-foreground">
                {list.length} connected
              </span>
            </span>
          </span>
        </SelectItem>
        {groups.map((group) => (
          <SelectGroup key={group.provider}>
            <SelectSeparator />
            <SelectLabel className="flex items-center gap-1.5">
              <PlatformIcon provider={group.provider} className="size-3.5" />
              {platformName(group.provider)}
            </SelectLabel>
            {group.accounts.map((account) => {
              const handle = accountHandle(account);
              const label = accountLabel(account);
              return (
                <SelectItem key={account.id} value={account.id}>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <AccountAvatar account={account} size="sm" />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{label}</span>
                      {handle && handle !== label && handle !== `@${label}` ? (
                        <span className="truncate text-xs text-muted-foreground">{handle}</span>
                      ) : null}
                    </span>
                  </span>
                </SelectItem>
              );
            })}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
