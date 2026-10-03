"use client";

import { useState } from "react";
import { PlatformIcon } from "@/components/scheduler/platform-icon";
import { accountLabel } from "@/components/scheduler/account-avatar";
import { captionFor, type ComposerState } from "@/lib/scheduler/composer-state";
import { platformName } from "@/lib/scheduler/formats";
import type { ConnectedAccount } from "@/lib/scheduler/types";
import { cn } from "@/lib/utils";
import {
  BlueskyPreview,
  FacebookPreview,
  LinkedInPreview,
  ThreadsPreview,
  XPreview,
} from "./preview/feeds";
import { GoogleBusinessPreview } from "./preview/google-business";
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
  x: XPreview,
  google_business: GoogleBusinessPreview,
};

/** Placeholder shaped like the post, shown until an account is picked. */
function PreviewSkeleton({ format }: { format: ComposerState["format"] }) {
  const tall = format === "video" || format === "slideshow";
  return (
    <div className="space-y-3">
      <div
        aria-hidden
        className={cn(
          "mx-auto overflow-hidden rounded-xl border border-border bg-card shadow-xs",
          tall ? "w-44" : "w-full max-w-64",
        )}
      >
        <div className="flex items-center gap-2 p-2.5">
          <span className="size-6 shrink-0 rounded-full bg-muted" />
          <span className="h-2 w-20 rounded-full bg-muted" />
        </div>
        {format === "text" ? null : (
          // Capped below lg, where the preview sits under the form and a full
          // phone-height placeholder would just be empty space.
          <div
            className={cn("bg-muted max-lg:max-h-32", tall ? "aspect-9/16" : "aspect-square")}
          />
        )}
        <div className="space-y-1.5 p-2.5">
          <span className="block h-2 w-full rounded-full bg-muted" />
          <span className="block h-2 w-2/3 rounded-full bg-muted" />
        </div>
      </div>
      <p className="text-center text-sm text-muted-foreground">
        Pick an account to see how the post will look.
      </p>
    </div>
  );
}

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
        <span className="text-sm font-semibold">Preview</span>
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
                "flex size-9 shrink-0 items-center justify-center rounded-lg outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                active?.id === account.id
                  ? "bg-card"
                  : "opacity-60 hover:bg-secondary hover:opacity-100",
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
          <PreviewSkeleton format={state.format} />
        )}
      </div>
    </div>
  );
}
