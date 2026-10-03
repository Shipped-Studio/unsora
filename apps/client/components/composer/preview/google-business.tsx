"use client";

import { Bell, BookmarkSimple, House, MagnifyingGlass } from "@phosphor-icons/react";
import { GOOGLE_BUSINESS_CTA_LABELS } from "@/lib/scheduler/composer-state";
import { cn } from "@/lib/utils";
import {
  BottomNav,
  Caption,
  MediaFill,
  Phone,
  ProfilePic,
  Screen,
  mediaOf,
  names,
  type PreviewProps,
} from "./shared";

const TABS = ["Overview", "Updates", "Reviews", "Photos"];

/** The post as it shows in the Updates tab of the listing on Google Search. */
export function GoogleBusinessPreview({ account, state, caption }: PreviewProps) {
  const { name } = names(account);
  const { images } = mediaOf(state);
  const ctaType = state.googleBusiness[account.id]?.ctaType;
  // accountUsername holds the location's address line.
  const address = account.accountUsername;

  return (
    <Phone>
      <div className="flex h-12 shrink-0 items-center px-3">
        <span className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full bg-secondary px-3 text-[13px]">
          <MagnifyingGlass className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{name}</span>
        </span>
      </div>
      <Screen>
        <div className="space-y-0.5 px-4 pt-2">
          <p className="truncate text-[18px] leading-tight">{name}</p>
          {address ? (
            <p className="truncate text-[12px] text-muted-foreground">{address}</p>
          ) : null}
        </div>
        <div className="mt-2 flex gap-4 overflow-hidden border-b border-border/60 px-4 text-[12px] font-medium">
          {TABS.map((tab) => (
            <span
              key={tab}
              className={cn(
                "relative shrink-0 py-2",
                tab === "Updates" ? "text-link-google-business" : "text-muted-foreground",
              )}
            >
              {tab}
              {tab === "Updates" ? (
                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-link-google-business" />
              ) : null}
            </span>
          ))}
        </div>

        <div className="m-3 overflow-hidden rounded-xl border border-border">
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <ProfilePic account={account} className="size-8" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[13px] font-medium">{name}</p>
              <p className="text-[11px] text-muted-foreground">Just now</p>
            </div>
          </div>
          {images[0] ? (
            <div className="aspect-4/3 overflow-hidden bg-muted">
              <MediaFill item={images[0]} />
            </div>
          ) : null}
          <div className="space-y-3 px-3 py-2.5">
            <Caption
              text={caption}
              chars={250}
              lines={6}
              ellipsis="... "
              more="More"
              moreClassName="font-medium text-link-google-business"
              className="text-[13px] leading-snug"
            />
            {ctaType ? (
              <span className="inline-flex rounded-full border border-border px-4 py-1.5 text-[13px] font-medium text-link-google-business">
                {GOOGLE_BUSINESS_CTA_LABELS[ctaType]}
              </span>
            ) : null}
          </div>
        </div>
      </Screen>
      <BottomNav
        items={[
          { icon: House, active: true },
          { icon: MagnifyingGlass },
          { icon: BookmarkSimple },
          { icon: Bell },
        ]}
      />
    </Phone>
  );
}
