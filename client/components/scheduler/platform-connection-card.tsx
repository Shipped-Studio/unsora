"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowsClockwise, Plus, Trash } from "@phosphor-icons/react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { formatHandle } from "@/lib/platform-utils";

interface ConnectedAccount {
  id: string;
  provider: string;
  providerAccountId: string;
  accountName: string | null;
  accountUsername: string | null;
  profilePicture: string | null;
  expiresAt: string | null;
}

interface PlatformConnectionCardProps {
  platform: {
    name: string;
    icon: React.ReactNode;
    description: string;
    iconBg?: string;
    comingSoon?: boolean;
  };
  connectedAccounts: ConnectedAccount[];
  isConnecting: boolean;
  isRefreshing?: boolean;
  onConnect: () => void;
  onRefresh?: () => void;
  onDisconnect: (accountId: string, platformName: string) => void;
}

export function PlatformConnectionCard({
  platform,
  connectedAccounts,
  isConnecting,
  isRefreshing,
  onConnect,
  onRefresh,
  onDisconnect,
}: PlatformConnectionCardProps) {
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [accountToDisconnect, setAccountToDisconnect] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const isConnected = connectedAccounts.length > 0;

  const handleDisconnectClick = (accountId: string, accountName: string) => {
    setAccountToDisconnect({ id: accountId, name: accountName });
    setDisconnectDialogOpen(true);
  };

  const handleConfirmDisconnect = () => {
    if (accountToDisconnect) {
      onDisconnect(accountToDisconnect.id, platform.name);
      setDisconnectDialogOpen(false);
      setAccountToDisconnect(null);
    }
  };

  return (
    <>
      <div
        className={cn(
          "group/card relative flex flex-col rounded-xl border bg-card transition-colors",
          isConnected && "border-foreground/15",
          platform.comingSoon && "opacity-60",
        )}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-4 sm:p-5">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border",
              platform.iconBg ?? "bg-muted/60",
            )}
          >
            <span className="[&>svg]:h-7 [&>svg]:w-7">{platform.icon}</span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-semibold leading-tight">
                {platform.name}
              </h3>
              {platform.comingSoon && (
                <Badge variant="secondary" className="text-[10px]">
                  Coming Soon
                </Badge>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className={cn(
                  "inline-block h-1.5 w-1.5 rounded-full",
                  isConnected ? "bg-emerald-500" : "bg-muted-foreground/40",
                )}
              />
              {platform.comingSoon
                ? "Not available yet"
                : isConnected
                  ? `${connectedAccounts.length} account${connectedAccounts.length !== 1 ? "s" : ""} connected`
                  : "Not connected"}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {isConnected && onRefresh && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={onRefresh}
                disabled={isRefreshing}
                title="Refresh accounts"
                aria-label={`Refresh ${platform.name} accounts`}
              >
                <ArrowsClockwise
                  className={cn("h-4 w-4", isRefreshing && "animate-spin")}
                />
              </Button>
            )}
            {!platform.comingSoon && (
              <Button
                onClick={onConnect}
                disabled={isConnecting}
                size="sm"
                variant={isConnected ? "outline" : "default"}
                className="gap-1.5"
              >
                {isConnecting ? (
                  <>
                    <Spinner className="h-3.5 w-3.5" />
                    Connecting
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    {isConnected ? "Add" : "Connect"}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Accounts */}
        <div className="flex-1 px-4 pb-4 sm:px-5 sm:pb-5">
          {isConnected ? (
            <ul className="space-y-1.5">
              {connectedAccounts.map((account) => {
                const displayName =
                  account.accountName ||
                  account.accountUsername ||
                  `${platform.name} •••${account.providerAccountId.slice(-4)}`;

                return (
                  <li
                    key={account.id}
                    className="group/account flex items-center gap-2.5 rounded-lg border bg-muted/40 px-2.5 py-2"
                  >
                    {account.profilePicture ? (
                      <img
                        src={account.profilePicture}
                        alt={displayName}
                        className="h-7 w-7 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted [&>svg]:h-4 [&>svg]:w-4">
                        {platform.icon}
                      </span>
                    )}
                    <div className="min-w-0 flex-1 leading-tight">
                      <p className="truncate text-sm font-medium">
                        {displayName}
                      </p>
                      {account.accountUsername &&
                        account.accountUsername !== displayName && (
                          <p className="truncate text-xs text-muted-foreground">
                            {formatHandle(account.accountUsername)}
                          </p>
                        )}
                    </div>
                    <button
                      onClick={() =>
                        handleDisconnectClick(account.id, displayName)
                      }
                      className="shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover/account:opacity-100"
                      title="Disconnect"
                      aria-label={`Disconnect ${displayName}`}
                    >
                      <Trash className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <button
              onClick={platform.comingSoon ? undefined : onConnect}
              disabled={platform.comingSoon || isConnecting}
              className={cn(
                "flex w-full items-center justify-center rounded-lg border border-dashed px-3 py-4 text-xs text-muted-foreground transition-colors",
                !platform.comingSoon &&
                  "hover:border-foreground/25 hover:text-foreground",
              )}
            >
              {platform.comingSoon
                ? `${platform.name} integration is coming soon`
                : platform.description}
            </button>
          )}
        </div>
      </div>

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog
        open={disconnectDialogOpen}
        onOpenChange={setDisconnectDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Disconnect {platform.name} Account?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect{" "}
              <strong>{accountToDisconnect?.name}</strong>? You will need to
              reconnect it to schedule posts to this account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDisconnect}
              variant="destructive"
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
