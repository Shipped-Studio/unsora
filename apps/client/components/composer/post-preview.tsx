"use client";

import { useState } from "react";
import { PlatformIcon } from "@/components/scheduler/platform-icon";
import { accountLabel } from "@/components/scheduler/account-avatar";
import { captionFor, type ComposerState } from "@/lib/scheduler/composer-state";
import { platformName } from "@/lib/scheduler/formats";
import type { ConnectedAccount } from "@/lib/scheduler/types";
import { cn } from "@/lib/utils";
import { BlueskyPreview, FacebookPreview, LinkedInPreview, ThreadsPreview } from "./preview/feeds";
import { InstagramPreview } from "./preview/instagram";
import { PinterestPreview } from "./preview/pinterest";
import type { PreviewProps } from "./preview/shared";
import { TikTokPreview } from "./preview/tiktok";
import { YouTubePreview } from "./preview/youtube";

const PREVIEWS: Record<string, (props: PreviewProps) => React.ReactNode> = {
  instagram: InstagramPreview,
  tiktok: TikTokPreview,
  google: YouTubePreview,
  facebook: FacebookPreview,
  linkedin: LinkedInPreview,
  threads: ThreadsPreview,
  bluesky: BlueskyPreview,
  pinterest: PinterestPreview,
};

/** A phone-sized preview of the post on each selected account's app. */
export function PreviewPanel({
  state,
  selectedAccounts,
}: {
  state: ComposerState;
  selectedAccounts: ConnectedAccount[];
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active =
    selectedAccounts.find((a) => a.id === activeId) ?? selectedAccounts[0] ?? null;
  const Preview = active ? PREVIEWS[active.provider] : undefined;

  return (
    <div className="overflow-hidden rounded-xl bg-muted">
      <div className="flex items-center justify-between gap-2 px-4 pt-3">
        <span className="text-sm font-medium">Preview</span>
        {active ? (
          <span className="truncate text-xs text-muted-foreground">
            {platformName(active.provider)} · {accountLabel(active)}
          </span>
        ) : null}
      </div>
      {selectedAccounts.length > 1 ? (
        <div className="flex gap-1 overflow-x-auto px-3 pt-2 no-scrollbar">
          {selectedAccounts.map((account) => (
            <button
              key={account.id}
              type="button"
              aria-pressed={active?.id === account.id}
              aria-label={`Preview on ${platformName(account.provider)}, ${accountLabel(account)}`}
              title={`${platformName(account.provider)} · ${accountLabel(account)}`}
              onClick={() => setActiveId(account.id)}
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-md transition-colors",
                active?.id === account.id ? "bg-card" : "opacity-60 hover:bg-secondary hover:opacity-100",
              )}
            >
              <PlatformIcon provider={account.provider} className="size-5" />
            </button>
          ))}
        </div>
      ) : null}
      <div className="p-4">
        {active && Preview ? (
          <Preview
            key={`${active.id}:${state.format}`}
            account={active}
            state={state}
            caption={captionFor(state, active.id)}
          />
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Pick an account to see how the post will look.
          </p>
        )}
      </div>
    </div>
  );
}
