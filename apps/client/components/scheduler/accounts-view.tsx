"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowsClockwise,
  DotsThree,
  LinkBreak,
  Plugs,
  Warning,
} from "@phosphor-icons/react";
import { toast } from "sonner";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ErrorState } from "@/components/shared/states";
import { PageSection } from "@/components/layout/page-header";
import {
  AccountAvatar,
  accountHandle,
  accountLabel,
} from "@/components/scheduler/account-avatar";
import { PlatformIcon } from "@/components/scheduler/platform-icon";
import { usePricing } from "@/contexts/pricing-context";
import {
  useConnectAccount,
  useConnectedAccounts,
  useDisconnectAccount,
  useRefreshAccount,
} from "@/hooks/use-connected-accounts";
import { useUserUsage } from "@/hooks/use-user-usage";
import { formatRelative } from "@/lib/scheduler/dates";
import {
  FORMATS,
  FORMAT_ORDER,
  PLATFORMS,
  PLATFORM_ORDER,
  isProvider,
  platformName,
  type Provider,
} from "@/lib/scheduler/formats";
import type { ConnectedAccount } from "@/lib/scheduler/types";

/** Set before leaving for OAuth so we can return to onboarding afterwards. */
export const RETURN_AFTER_CONNECT_KEY = "unsora:return-after-connect";

function HealthNote({ account }: { account: ConnectedAccount }) {
  if (account.status === "ok") {
    return (
      <span className="text-xs text-muted-foreground">
        {account.lastPublishedAt
          ? `Last post ${formatRelative(account.lastPublishedAt)}`
          : "No posts yet"}
      </span>
    );
  }
  return (
    <span
      className={
        account.status === "reconnect"
          ? "flex items-center gap-1 text-xs text-destructive"
          : "flex items-center gap-1 text-xs text-warning"
      }
      title={account.statusReason ?? undefined}
    >
      <Warning weight="fill" className="size-3.5" />
      {account.status === "reconnect" ? "Reconnect needed" : "Expires soon"}
    </span>
  );
}

function AccountRow({
  account,
  onReconnect,
  connecting,
}: {
  account: ConnectedAccount;
  onReconnect: (account: ConnectedAccount) => void;
  connecting: boolean;
}) {
  const refresh = useRefreshAccount();
  const disconnect = useDisconnectAccount();
  const [confirm, setConfirm] = useState(false);
  const needsAttention = account.status !== "ok";

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <AccountAvatar account={account} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{accountLabel(account)}</p>
        <p className="truncate text-xs text-muted-foreground">
          {platformName(account.provider)}
          {accountHandle(account) ? ` · ${accountHandle(account)}` : ""}
        </p>
      </div>
      <div className="hidden sm:block">
        <HealthNote account={account} />
      </div>
      {needsAttention && isProvider(account.provider) ? (
        <Button
          size="sm"
          variant="outline"
          disabled={connecting}
          onClick={() => onReconnect(account)}
        >
          Reconnect
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label="Account actions" />}
        >
          {refresh.isPending ? <Spinner /> : <DotsThree weight="bold" />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => refresh.mutate(account.id)}>
            <ArrowsClockwise />
            Refresh profile
          </DropdownMenuItem>
          {isProvider(account.provider) ? (
            <DropdownMenuItem onClick={() => onReconnect(account)}>
              <Plugs />
              Reconnect
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirm(true)}>
            <LinkBreak />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {accountLabel(account)}?</AlertDialogTitle>
            <AlertDialogDescription>
              Scheduled posts won&apos;t go out to this account, and its post history and
              stats are removed from Unsora. Posts already on {platformName(account.provider)} stay
              up.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => disconnect.mutate(account)}>
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

function BlueskyDialog({
  open,
  onOpenChange,
  onConnect,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (handle: string) => void;
  pending: boolean;
}) {
  const [handle, setHandle] = useState("");
  const clean = handle.trim().replace(/^@/, "");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Bluesky</DialogTitle>
          <DialogDescription>
            Enter your handle and we&apos;ll send you to your Bluesky server to approve access.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (clean) onConnect(clean);
          }}
          className="space-y-4"
        >
          <Field>
            <FieldLabel htmlFor="bsky-handle">Handle</FieldLabel>
            <Input
              id="bsky-handle"
              autoFocus
              placeholder="yourname.bsky.social"
              value={handle}
              onChange={(event) => setHandle(event.target.value)}
            />
            <FieldDescription>Custom domains work too, like yourname.com.</FieldDescription>
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!clean || pending}>
              {pending ? <Spinner /> : null}
              Continue to Bluesky
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Reads the ?status=&provider=&error= that OAuth callbacks send back. */
function useOAuthReturn() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const handled = useRef(false);

  useEffect(() => {
    const status = searchParams.get("status");
    const provider = searchParams.get("provider");
    if (handled.current || !status || !provider) return;
    handled.current = true;

    const name = platformName(provider);
    if (status === "success") toast.success(`${name} connected`);
    else toast.error(searchParams.get("error") || `Couldn't connect ${name}. Try again.`);

    let returnTo: string | null = null;
    try {
      returnTo = sessionStorage.getItem(RETURN_AFTER_CONNECT_KEY);
      sessionStorage.removeItem(RETURN_AFTER_CONNECT_KEY);
    } catch {
      // Storage can be unavailable; stay on this page.
    }
    router.replace(returnTo && returnTo.startsWith("/") ? returnTo : pathname, { scroll: false });
  }, [pathname, router, searchParams]);
}

/** Grid of platforms to connect. Also used by onboarding. */
export function ConnectGrid({
  compact,
  returnTo,
}: {
  compact?: boolean;
  /** Where to come back to after the OAuth round trip. */
  returnTo?: string;
}) {
  const connect = useConnectAccount();
  const { usage } = useUserUsage();
  const { openPricing } = usePricing();
  const [blueskyOpen, setBlueskyOpen] = useState(false);
  const [target, setTarget] = useState<Provider | null>(null);

  const plan = (usage?.user?.plan ?? "free").toLowerCase();
  const isPaid = Boolean(usage?.user?.isActive) && plan !== "free";
  const limit = usage?.limits?.socialAccounts ?? 0;
  const used = usage?.counts?.socialAccounts ?? 0;
  const atLimit = isPaid && limit > 0 && used >= limit;

  const start = (provider: Provider, handle?: string) => {
    if (!isPaid) {
      openPricing();
      return;
    }
    if (provider === "bluesky" && !handle) {
      setBlueskyOpen(true);
      return;
    }
    try {
      if (returnTo) sessionStorage.setItem(RETURN_AFTER_CONNECT_KEY, returnTo);
    } catch {
      // Ignore storage errors.
    }
    setTarget(provider);
    connect.mutate({ provider, handle }, { onError: () => setTarget(null) });
  };

  const platforms = PLATFORM_ORDER.filter((p) => PLATFORMS[p].enabled);

  return (
    <>
      {!isPaid && usage ? (
        <div className="mb-3 flex flex-col gap-3 rounded-xl bg-muted p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Connecting accounts and publishing need a paid plan.
          </p>
          <Button size="sm" onClick={openPricing}>
            See plans
          </Button>
        </div>
      ) : atLimit ? (
        <p className="mb-3 text-sm text-muted-foreground">
          You&apos;ve connected {used} of {limit} accounts on your plan. Disconnect one or upgrade
          to add more.
        </p>
      ) : null}
      <div className={compact ? "grid gap-2 sm:grid-cols-2" : "grid gap-3 sm:grid-cols-2 xl:grid-cols-3"}>
        {platforms.map((provider) => {
          const spec = PLATFORMS[provider];
          const formats = FORMAT_ORDER.filter((f) => spec.formats[f]).map((f) =>
            FORMATS[f].label.toLowerCase(),
          );
          const pending = connect.isPending && target === provider;
          return (
            <div
              key={provider}
              className="flex items-start gap-3 rounded-xl bg-muted p-4"
            >
              <PlatformIcon provider={provider} className="size-8" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium">{spec.name}</p>
                {!compact ? (
                  <p className="text-xs text-muted-foreground">
                    Posts {formats.join(", ")}.{spec.connectNote ? ` ${spec.connectNote}` : ""}
                  </p>
                ) : null}
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={atLimit || (connect.isPending && target !== provider)}
                onClick={() => start(provider)}
              >
                {pending ? <Spinner /> : null}
                Connect
              </Button>
            </div>
          );
        })}
      </div>
      <BlueskyDialog
        open={blueskyOpen}
        onOpenChange={setBlueskyOpen}
        pending={connect.isPending && target === "bluesky"}
        onConnect={(handle) => start("bluesky", handle)}
      />
    </>
  );
}

export function AccountsView() {
  useOAuthReturn();
  const { data: accounts, isLoading, error, refetch } = useConnectedAccounts();
  const { usage } = useUserUsage();
  const connect = useConnectAccount();

  const visible = (accounts ?? []).filter(
    (a) => !isProvider(a.provider) || PLATFORMS[a.provider].enabled,
  );
  const grouped = PLATFORM_ORDER.map((provider) => ({
    provider,
    accounts: visible.filter((a) => a.provider === provider),
  })).filter((g) => g.accounts.length);
  const attention = visible.filter((a) => a.status !== "ok").length;
  const limit = usage?.limits?.socialAccounts ?? 0;

  return (
    <div className="space-y-10">
      <PageSection
        title="Connected accounts"
        description={
          attention
            ? `${attention} ${attention === 1 ? "account needs" : "accounts need"} attention before the next post.`
            : "Posts go out from these accounts."
        }
        actions={
          limit ? (
            <div className="hidden w-48 space-y-1.5 sm:block">
              <p className="text-right text-xs text-muted-foreground tabular-nums">
                {visible.length} of {limit} on your plan
              </p>
              <Progress value={Math.min(100, (visible.length / limit) * 100)} className="h-1" />
            </div>
          ) : null
        }
      >
        {error ? (
          <ErrorState
            title="Couldn't load your accounts"
            description={error.message}
            onRetry={() => void refetch()}
          />
        ) : isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <p className="rounded-xl bg-muted p-6 text-center text-sm text-muted-foreground">
            No accounts yet. Connect one below.
          </p>
        ) : (
          <div className="space-y-4">
            {grouped.map((group) => (
              <div key={group.provider} className="overflow-hidden rounded-xl bg-muted">
                <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2">
                  <PlatformIcon provider={group.provider} />
                  <span className="text-sm font-medium">{PLATFORMS[group.provider].name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {group.accounts.length}
                  </span>
                </div>
                <ul className="divide-y">
                  {group.accounts.map((account) => (
                    <AccountRow
                      key={account.id}
                      account={account}
                      connecting={connect.isPending}
                      onReconnect={(account) =>
                        account.provider === "bluesky"
                          ? toast.info("Use Connect on Bluesky below with the same handle.")
                          : connect.mutate({
                              provider: account.provider,
                              reconnectAccountId: account.id,
                            })
                      }
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </PageSection>

      <PageSection
        title="Connect an account"
        description="You'll approve access on the platform, then come back here."
      >
        <ConnectGrid />
      </PageSection>
    </div>
  );
}
