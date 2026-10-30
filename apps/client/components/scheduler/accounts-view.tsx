"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowsClockwise,
  DotsThree,
  Link as LinkIcon,
  LinkBreak,
  Plugs,
  Plus,
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
import { copyText } from "@/components/api-keys/copy-button";
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
  useEnabledPlatforms,
  useDisconnectAccount,
  useRefreshAccount,
  useShareConnectLink,
} from "@/hooks/use-connected-accounts";
import { useUserUsage } from "@/hooks/use-user-usage";
import { formatRelative } from "@/lib/scheduler/dates";
import {
  PLATFORMS,
  PLATFORM_ORDER,
  isProvider,
  platformName,
  type Provider,
} from "@/lib/scheduler/formats";
import type { ConnectedAccount } from "@/lib/scheduler/types";
import { cn } from "@/lib/utils";

/** Set before leaving for OAuth so we can return to onboarding afterwards. */
export const RETURN_AFTER_CONNECT_KEY = "unsora:return-after-connect";

function HealthNote({ account }: { account: ConnectedAccount }) {
  if (account.status === "ok") {
    return (
      <span className="block truncate text-xs text-muted-foreground">
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
          ? "flex items-center gap-1 text-xs whitespace-nowrap text-destructive"
          : "flex items-center gap-1 text-xs whitespace-nowrap text-warning"
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
          {accountHandle(account) || platformName(account.provider)}
          {account.provider === "instagram" && account.connectedVia === "facebook"
            ? " · via Facebook"
            : null}
        </p>
        <div className="mt-0.5 sm:hidden">
          <HealthNote account={account} />
        </div>
      </div>
      <div className="hidden shrink-0 sm:block">
        <HealthNote account={account} />
      </div>
      {needsAttention && isProvider(account.provider) ? (
        <Button
          size="sm"
          // Broken accounts get the solid button; "expires soon" is a softer nudge.
          variant={account.status === "reconnect" ? "default" : "outline"}
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

/**
 * Connect choice: approve access here, or copy a link for whoever owns the
 * account (a client, a teammate) to connect it from their own device.
 */
/** Connect route for Instagram through Facebook Login (shown as its own card). */
const INSTAGRAM_FACEBOOK = "instagram/facebook";

/** One card in the connect grid. `key` is the path segment under /api/connect. */
interface ConnectOption {
  key: string;
  provider: Provider;
  /** Admin platform switch that decides whether this card is live. */
  platform: string;
  /** Full name, for dialogs and labels. */
  name: string;
  /** Short name shown on the card. */
  label: string;
  note?: string;
}

function connectOptionsFor(provider: Provider): ConnectOption[] {
  const spec = PLATFORMS[provider];
  const options: ConnectOption[] = [
    {
      key: provider,
      provider,
      platform: provider,
      name: spec.name,
      label: spec.shortName ?? spec.name,
      note: spec.connectNote,
    },
  ];
  if (provider === "instagram") {
    options.push({
      key: INSTAGRAM_FACEBOOK,
      provider,
      platform: "instagram_facebook",
      name: "Instagram via Facebook",
      label: "Instagram via Facebook",
      note: "Sign in with Facebook. Your Instagram business or creator account must be linked to a Facebook Page you manage.",
    });
  }
  return options;
}

function ConnectChoiceDialog({
  option,
  onOpenChange,
  onConnectSelf,
  connecting,
}: {
  option: ConnectOption | null;
  onOpenChange: (open: boolean) => void;
  onConnectSelf: (option: ConnectOption) => void;
  connecting: boolean;
}) {
  const share = useShareConnectLink();
  const provider = option?.provider ?? null;
  const name = option?.name ?? "";
  // Bluesky's sign-in starts from the account's handle, so it can't be shared.
  const canShare = provider !== null && provider !== "bluesky";

  useEffect(() => {
    share.reset();
    // Reset when another platform is chosen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [option?.key]);

  const createLink = () => {
    if (!option) return;
    share.mutate(option.key, {
      onSuccess: (url) => void copyText(url, "Invite link copied. It works for 1 hour."),
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <Dialog open={provider !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {provider ? <PlatformIcon provider={provider} className="size-5" /> : null}
            Connect {name}
          </DialogTitle>
          <DialogDescription>
            Connect it here, or copy a link for whoever owns the account. The link works for 1
            hour.
          </DialogDescription>
          {option?.note ? (
            <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              {option.note}
            </p>
          ) : null}
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Button
            className="w-full"
            disabled={connecting}
            onClick={() => option && onConnectSelf(option)}
          >
            {connecting ? <Spinner /> : <Plugs />}
            Connect
          </Button>
          <Button
            variant="outline"
            className="w-full"
            disabled={!canShare || share.isPending}
            title={canShare ? undefined : `${name} sign-in starts from the account's handle, so connect it yourself.`}
            onClick={createLink}
          >
            {share.isPending ? <Spinner /> : <LinkIcon />}
            Copy link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
  const [target, setTarget] = useState<string | null>(null);
  const [choice, setChoice] = useState<ConnectOption | null>(null);

  const plan = (usage?.user?.plan ?? "free").toLowerCase();
  const isPaid = Boolean(usage?.user?.isActive) && plan !== "free";
  // Free accounts get Basic's account allowance so channels can be connected
  // during onboarding, before a trial; publishing still needs a plan.
  const limit = usage?.limits?.socialAccounts ?? 0;
  const used = usage?.counts?.socialAccounts ?? 0;
  const atLimit = limit > 0 && used >= limit;

  const start = (key: string, handle?: string) => {
    if (usage && (limit === 0 || atLimit)) {
      openPricing();
      return;
    }
    if (key === "bluesky" && !handle) {
      setBlueskyOpen(true);
      return;
    }
    try {
      if (returnTo) sessionStorage.setItem(RETURN_AFTER_CONNECT_KEY, returnTo);
    } catch {
      // Ignore storage errors.
    }
    setTarget(key);
    connect.mutate({ provider: key, handle }, { onError: () => setTarget(null) });
  };

  const { isEnabled, isLoading: platformsLoading } = useEnabledPlatforms();
  // Live platforms first; the rest show as "Coming soon" so people can see
  // what's on the way.
  const options = PLATFORM_ORDER.flatMap(connectOptionsFor);
  const platforms = [
    ...options.filter((o) => isEnabled(o.platform)),
    ...options.filter((o) => !isEnabled(o.platform)),
  ];

  return (
    <>
      {atLimit ? (
        <p className="mb-3 text-sm text-muted-foreground">
          You&apos;ve connected {used} of {limit} accounts on your plan. Disconnect one or upgrade
          to add more.
        </p>
      ) : !isPaid && usage && !compact ? (
        <p className="mb-3 text-sm text-muted-foreground">
          Connect up to {limit} accounts now. Publishing starts with a plan or free trial.
        </p>
      ) : null}
      <div
        className={cn(
          "grid grid-cols-1 gap-2 min-[420px]:grid-cols-2",
          compact ? "sm:grid-cols-3" : "sm:grid-cols-3 lg:grid-cols-4",
        )}
      >
        {platforms.map((option) => {
          const { provider } = option;
          const pending = connect.isPending && target === option.key;
          const live = isEnabled(option.platform);
          if (!live) {
            return (
              <div
                key={option.key}
                aria-label={`${option.name}: coming soon`}
                className={cn(
                  "flex min-w-0 items-center gap-3 rounded-xl bg-muted p-3 opacity-60",
                  platformsLoading && "animate-pulse",
                )}
              >
                <PlatformIcon provider={provider} className="size-8 grayscale" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {option.label}
                </span>
                {platformsLoading ? null : (
                  <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-2xs text-muted-foreground">
                    Coming soon
                  </span>
                )}
              </div>
            );
          }
          return (
            <button
              key={option.key}
              type="button"
              disabled={atLimit || (connect.isPending && target !== option.key)}
              onClick={() => (isPaid ? setChoice(option) : openPricing())}
              aria-label={`Connect ${option.name}`}
              className="group flex min-w-0 items-center gap-3 rounded-xl bg-muted p-3 text-left transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PlatformIcon provider={provider} className="size-8" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {option.label}
              </span>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity group-hover:opacity-90">
                {pending ? <Spinner /> : <Plus className="size-3.5" weight="bold" />}
              </span>
            </button>
          );
        })}
      </div>
      <ConnectChoiceDialog
        option={choice}
        onOpenChange={(open) => !open && setChoice(null)}
        connecting={connect.isPending}
        onConnectSelf={(option) => {
          setChoice(null);
          start(option.key);
        }}
      />
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

  const { isEnabled } = useEnabledPlatforms();
  const visible = (accounts ?? []).filter(
    (a) =>
      isEnabled(a.provider) ||
      (a.connectedVia === "facebook" && isEnabled("instagram_facebook")),
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
            <div className="flex items-center gap-2.5">
              <span className="text-xs text-muted-foreground tabular-nums">
                {visible.length} of {limit} on your plan
              </span>
              <Progress
                aria-label="Accounts used on your plan"
                value={Math.min(100, (visible.length / limit) * 100)}
                className="h-1 w-20"
              />
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
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <p className="rounded-xl bg-muted p-6 text-center text-sm text-muted-foreground">
            No accounts yet. Connect one below.
          </p>
        ) : (
          <div className="space-y-3">
            {grouped.map((group) => (
              <section
                key={group.provider}
                aria-label={PLATFORMS[group.provider].name}
                className="overflow-hidden rounded-xl bg-muted"
              >
                <div className="flex items-center gap-2 border-b border-card px-4 py-2">
                  <PlatformIcon provider={group.provider} className="size-4" />
                  <span className="text-sm font-medium">
                    {PLATFORMS[group.provider].name}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {group.accounts.length}
                  </span>
                </div>
                <ul className="divide-y divide-card">
                  {group.accounts.map((account) => (
                    <AccountRow
                      key={account.id}
                      account={account}
                      connecting={connect.isPending}
                      onReconnect={(account) =>
                        account.provider === "bluesky"
                          ? toast.info("Use Connect on Bluesky below with the same handle.")
                          : connect.mutate({
                              provider:
                                account.provider === "instagram" && account.connectedVia === "facebook"
                                  ? INSTAGRAM_FACEBOOK
                                  : account.provider,
                              reconnectAccountId: account.id,
                            })
                      }
                    />
                  ))}
                </ul>
              </section>
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
