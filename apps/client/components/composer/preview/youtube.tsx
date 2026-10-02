"use client";

import {
  ChatText,
  DotsThreeVertical,
  DownloadSimple,
  House,
  MagnifyingGlass,
  Play,
  PlusCircle,
  ShareFat,
  Television,
  ThumbsDown,
  ThumbsUp,
} from "@phosphor-icons/react";
import {
  BottomNav,
  Caption,
  MediaFill,
  Phone,
  ProfilePic,
  Screen,
  isVertical,
  mediaOf,
  names,
  type PreviewProps,
} from "./shared";

function Nav({ account, dark }: Pick<PreviewProps, "account"> & { dark?: boolean }) {
  return (
    <BottomNav
      dark={dark}
      items={[
        { icon: House, label: "Home", active: !dark },
        { icon: ShortsGlyph(dark), label: "Shorts", active: dark },
        { icon: <PlusCircle className="size-7" weight="thin" /> },
        { icon: Television, label: "Subscriptions" },
        { icon: <ProfilePic account={account} className="size-5" />, label: "You" },
      ]}
    />
  );
}

function ShortsGlyph(active?: boolean) {
  return (
    <span
      className={
        active
          ? "flex h-5 w-4 items-center justify-center rounded-md bg-media-foreground text-[8px] text-media"
          : "flex h-5 w-4 items-center justify-center rounded-md border-[1.5px] border-current text-[8px]"
      }
    >
      <Play weight="fill" className="size-2" />
    </span>
  );
}

function titleOf({ account, state }: PreviewProps) {
  return state.titles[account.id]?.trim() || "";
}

function Short(props: PreviewProps) {
  const { account, state } = props;
  const { video, poster } = mediaOf(state);
  const { handle } = names(account);
  const title = titleOf(props);

  return (
    <Phone dark statusOverlay>
      <div className="relative min-h-0 flex-1">
        <MediaFill item={video} poster={poster} />
        <div className="absolute inset-x-0 top-7 z-10 flex justify-end gap-4 px-4 text-media-foreground">
          <MagnifyingGlass weight="bold" className="size-5" />
          <DotsThreeVertical weight="bold" className="size-5" />
        </div>

        <div className="absolute right-2 bottom-4 z-10 flex flex-col items-center gap-3.5 text-[10px] text-media-foreground">
          {[
            { icon: ThumbsUp, label: "Like" },
            { icon: ThumbsDown, label: "Dislike" },
            { icon: ChatText, label: "Comment" },
            { icon: ShareFat, label: "Share" },
          ].map(({ icon: Icon, label }) => (
            <span key={label} className="flex flex-col items-center gap-0.5">
              <span className="flex size-9 items-center justify-center rounded-full bg-media-foreground/15">
                <Icon weight="fill" className="size-5" />
              </span>
              {label}
            </span>
          ))}
          <ProfilePic account={account} className="size-7 rounded-md [&_*]:rounded-md" />
        </div>

        <div className="absolute inset-x-0 bottom-0 space-y-2 bg-linear-to-t from-scrim/70 to-transparent px-3 pt-16 pr-14 pb-4 text-[12px] text-media-foreground">
          <div className="flex items-center gap-2">
            <ProfilePic account={account} className="size-6" />
            <span className="truncate font-medium">{handle}</span>
            <span className="rounded-full bg-media-foreground px-2.5 py-1 text-[11px] font-semibold text-media">
              Subscribe
            </span>
          </div>
          <p className="line-clamp-2 leading-snug">
            {title || <span className="opacity-60">Add a title in the YouTube options</span>}
          </p>
        </div>
      </div>
      <Nav account={account} dark />
    </Phone>
  );
}

function WatchPage(props: PreviewProps) {
  const { account, state, caption } = props;
  const { video, poster } = mediaOf(state);
  const { name } = names(account);
  const title = titleOf(props);
  const privacy = state.youtube[account.id]?.privacyStatus ?? "public";
  const duration = video?.duration
    ? `${Math.floor(video.duration / 60)}:${String(Math.round(video.duration % 60)).padStart(2, "0")}`
    : null;

  return (
    <Phone>
      <div className="relative aspect-video shrink-0 bg-media">
        <MediaFill item={video} poster={poster} fit="contain" />
        {duration ? (
          <span className="absolute right-1.5 bottom-1.5 rounded bg-scrim/80 px-1 text-[10px] font-medium text-media-foreground tabular-nums">
            {duration}
          </span>
        ) : null}
      </div>
      <Screen className="space-y-3 px-3 pt-3 pb-4">
        <div>
          <p className="line-clamp-2 text-[15px] leading-snug font-semibold">
            {title || <span className="text-muted-foreground">Add a title in the YouTube options</span>}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            No views · Just now{privacy !== "public" ? ` · ${privacy === "private" ? "Private" : "Unlisted"}` : ""}{" "}
            <span className="font-semibold text-foreground">...more</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <ProfilePic account={account} />
          <p className="min-w-0 flex-1 truncate text-[13px] font-semibold">{name}</p>
          <span className="rounded-full bg-foreground px-3 py-1.5 text-[12px] font-semibold text-background">
            Subscribe
          </span>
        </div>

        <div className="-mx-3 flex gap-2 overflow-hidden px-3 text-[12px] font-medium">
          <span className="flex shrink-0 items-center gap-2 rounded-full bg-secondary px-3 py-1.5">
            <ThumbsUp className="size-4" />
            <span className="h-4 w-px bg-border" />
            <ThumbsDown className="size-4" />
          </span>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5">
            <ShareFat className="size-4" /> Share
          </span>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5">
            <DownloadSimple className="size-4" /> Download
          </span>
        </div>

        <div className="rounded-xl bg-secondary p-3 text-[12px] leading-snug">
          <p className="mb-1 font-semibold">No views · Just now</p>
          <Caption
            text={caption}
            chars={150}
            lines={3}
            ellipsis="... "
            moreClassName="font-semibold"
            linkClassName="text-link-social"
            placeholder="Your description appears here"
          />
        </div>
      </Screen>
      <Nav account={account} />
    </Phone>
  );
}

/** Vertical videos are published as Shorts; anything else gets a watch page. */
export function YouTubePreview(props: PreviewProps) {
  const { video } = mediaOf(props.state);
  const short = isVertical(video) && (!video?.duration || video.duration <= 180);
  return short ? <Short {...props} /> : <WatchPage {...props} />;
}
