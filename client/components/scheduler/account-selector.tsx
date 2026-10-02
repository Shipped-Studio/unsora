"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowSquareOut as ExternalLink, Check } from "@phosphor-icons/react";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useConnectedAccounts } from "@/hooks/use-connected-accounts";
import Link from "next/link";
import {
  getPlatformIcon,
  getPlatformColor,
  getPlatformName,
  getPlatformBgColor,
  formatHandle,
} from "@/lib/platform-utils";
import { cn } from "@/lib/utils";

interface AccountSelectorProps {
  selectedAccounts: string[];
  onAccountsChange: (accountIds: string[]) => void;
}

export function AccountSelector({
  selectedAccounts,
  onAccountsChange,
}: AccountSelectorProps) {
  const { data: accounts, isLoading } = useConnectedAccounts();

  const handleAccountToggle = (accountId: string) => {
    if (selectedAccounts.includes(accountId)) {
      onAccountsChange(selectedAccounts.filter((id) => id !== accountId));
    } else {
      onAccountsChange([...selectedAccounts, accountId]);
    }
  };

  const handleSelectAll = () => {
    if (accounts && selectedAccounts.length === accounts.length) {
      onAccountsChange([]);
    } else if (accounts) {
      onAccountsChange(accounts.map((acc) => acc.id));
    }
  };

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-center py-8">
          <Spinner className="size-6 text-muted-foreground" />
        </div>
      </Card>
    );
  }

  if (!accounts || accounts.length === 0) {
    return (
      <Card className="p-6 bg-muted/50 border-dashed">
        <div className="text-center space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-1">
              No accounts connected
            </h3>
            <p className="text-xs text-muted-foreground">
              Connect your social media accounts to start posting
            </p>
          </div>
          <Button render={<Link href="/scheduler/connections" />} size="sm" variant="outline" className="gap-2">
            <ExternalLink className="h-3.5 w-3.5" />
            Connect Accounts
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Post to</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select accounts to post to
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSelectAll}
            className="text-xs h-7"
          >
            {selectedAccounts.length === accounts.length
              ? "Deselect All"
              : "Select All"}
          </Button>
        </div>

        {/* Accounts Chips */}
        <TooltipProvider>
          <div className="flex flex-wrap gap-4">
            {accounts.map((account) => {
              const isSelected = selectedAccounts.includes(account.id);
              const platformName = getPlatformName(account.provider);
              const displayName =
                account.accountName ||
                account.accountUsername ||
                `${platformName} Account`;

              return (
                <Tooltip key={account.id}>
                  <TooltipTrigger
                    render={<button
                      onClick={() => handleAccountToggle(account.id)}
                      className={`relative group transition-all ${
                        isSelected ? "scale-105" : "hover:scale-105"
                      }`}
                    />}
                  >
                      <div
                        className={`relative rounded-full p-1 transition-all ${
                          isSelected
                            ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                            : "ring-1 ring-border hover:ring-2 hover:ring-primary/50"
                        }`}
                      >
                        <Avatar className="h-12 w-12">
                          <AvatarImage
                            src={account.profilePicture || undefined}
                            alt={displayName}
                          />
                          <AvatarFallback>
                            <div className={getPlatformColor(account.provider)}>
                              {getPlatformIcon(account.provider, {
                                className: "h-4 w-4",
                              })}
                            </div>
                          </AvatarFallback>
                        </Avatar>

                        {/* Platform Icon Badge */}
                        <div
                          className={cn(
                            "absolute -bottom-0.5 -right-0.5 rounded-full shadow-md border border-background",
                            getPlatformBgColor(account.provider)
                          )}
                        >
                          <div className="w-5 h-5 flex items-center justify-center">
                            {getPlatformIcon(account.provider, {
                              className: "h-4 w-4",
                            })}
                          </div>
                        </div>

                        {/* Selected Checkmark */}
                        {isSelected && (
                          <div className="absolute -top-1 -right-1 rounded-full bg-primary p-1 shadow-md border-2 border-background">
                            <Check className="h-2 w-2 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-center">
                      <p className="font-medium">{displayName}</p>
                      {account.accountUsername && (
                        <p className="text-xs text-muted-foreground">
                          {formatHandle(account.accountUsername)}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {platformName}
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>

        {/* Selected Count */}
        {selectedAccounts.length > 0 && (
          <div className="pt-2">
            <p className="text-xs text-muted-foreground text-center">
              {selectedAccounts.length} account
              {selectedAccounts.length !== 1 ? "s" : ""} selected
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
