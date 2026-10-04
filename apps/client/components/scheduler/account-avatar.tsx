import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlatformIcon } from "@/components/scheduler/platform-icon";
import { platformName } from "@/lib/scheduler/formats";
import type { AccountSummary } from "@/lib/scheduler/types";
import { cn } from "@/lib/utils";

export function accountLabel(account: AccountSummary) {
  return (
    account.accountName ||
    account.accountUsername ||
    `${platformName(account.provider)} account`
  );
}

export function accountHandle(account: AccountSummary) {
  const username = account.accountUsername;
  if (!username) return null;
  // Google Business stores the location's address, not a handle.
  if (account.provider === "google_business") return username;
  // LinkedIn stores an email; YouTube handles already start with "@".
  if (username.includes("@") && !username.startsWith("@")) return username;
  return `@${username.replace(/^@+/, "")}`;
}

const SIZES = {
  xs: { avatar: "size-5", badge: "size-2.5 -right-0.5 -bottom-0.5" },
  sm: { avatar: "size-7", badge: "size-3.5 -right-0.5 -bottom-0.5" },
  md: { avatar: "size-9", badge: "size-4 -right-0.5 -bottom-0.5" },
  lg: { avatar: "size-11", badge: "size-5 -right-1 -bottom-1" },
} as const;

/** Profile picture with the platform badge in the corner. */
export function AccountAvatar({
  account,
  size = "sm",
  className,
  style,
}: {
  account: AccountSummary;
  size?: keyof typeof SIZES;
  className?: string;
  style?: React.CSSProperties;
}) {
  const label = accountLabel(account);
  return (
    <span className={cn("relative inline-flex shrink-0", className)} style={style}>
      <Avatar className={cn(SIZES[size].avatar, "border bg-muted")}>
        {account.profilePicture ? (
          <AvatarImage src={account.profilePicture} alt="" />
        ) : null}
        <AvatarFallback className="text-2xs font-medium uppercase">
          {label.slice(0, 1)}
        </AvatarFallback>
      </Avatar>
      <PlatformIcon
        provider={account.provider}
        className={cn(
          "absolute rounded-full ring-2 ring-background",
          SIZES[size].badge,
        )}
      />
    </span>
  );
}

/** Overlapping avatars for a post's accounts. */
export function AccountStack({
  accounts,
  max = 4,
  size = "sm",
}: {
  accounts: AccountSummary[];
  max?: number;
  size?: keyof typeof SIZES;
}) {
  const shown = accounts.slice(0, max);
  const extra = accounts.length - shown.length;
  return (
    <span className="flex items-center">
      {/* Stacked like cards: each avatar sits above the next, so its
          platform badge in the bottom-right corner stays visible. */}
      <span className="flex -space-x-2">
        {shown.map((account, i) => (
          <AccountAvatar
            key={account.id}
            account={account}
            size={size}
            className="rounded-full ring-2 ring-muted"
            style={{ zIndex: shown.length - i }}
          />
        ))}
      </span>
      {extra > 0 ? (
        <span className="ml-1.5 text-sm font-medium text-muted-foreground tabular-nums">
          +{extra}
        </span>
      ) : null}
    </span>
  );
}
