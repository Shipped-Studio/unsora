"use client";

import {
  BookmarkSimple,
  ChatTeardropText,
  ChatText,
  Heart,
  House,
  MagnifyingGlass,
  MusicNotesSimple,
  Plus,
  ShareFat,
  User,
  Users,
} from "@phosphor-icons/react";
import {
  BottomNav,
  Caption,
  Dots,
  MediaFill,
  Phone,
  ProfilePic,
  TapZones,
  mediaOf,
  names,
  useCarousel,
  type PreviewProps,
} from "./shared";

function RailButton({ icon: Icon }: { icon: typeof Heart }) {
  return <Icon weight="fill" className="size-7 drop-shadow" />;
}

/** For You feed: a video, or a photo post you swipe through. */
export function TikTokPreview({ account, state, caption }: PreviewProps) {
  const { video, images, poster } = mediaOf(state);
  const { username, name } = names(account);
  const carousel = useCarousel(images.length);
  const photoMode = !video && images.length > 0;
  const autoMusic = state.tiktok[account.id]?.autoAddMusic ?? true;

  return (
    <Phone dark statusOverlay>
      <div className="relative min-h-0 flex-1">
        {photoMode ? (
          <>
            <MediaFill item={images[carousel.index]} fit="contain" />
            <TapZones onPrev={carousel.prev} onNext={carousel.next} />
          </>
        ) : (
          <MediaFill item={video} poster={poster} />
        )}

        <div className="absolute inset-x-0 top-7 z-20 flex items-center justify-center gap-4 px-4 text-[13px] font-semibold text-media-foreground">
          <span className="text-media-foreground/65">Following</span>
          <span className="relative">
            For You
            <span className="absolute inset-x-2 -bottom-1 h-0.5 rounded-full bg-media-foreground" />
          </span>
          <MagnifyingGlass weight="bold" className="absolute right-4 size-4.5" />
        </div>

        <div className="absolute right-2 bottom-5 z-20 flex flex-col items-center gap-4 text-media-foreground">
          <span className="relative mb-2">
            <ProfilePic account={account} className="size-10 ring-1 ring-media-foreground" />
            <span className="absolute -bottom-2 left-1/2 flex size-4.5 -translate-x-1/2 items-center justify-center rounded-full bg-platform-tiktok text-platform-foreground">
              <Plus weight="bold" className="size-2.5" />
            </span>
          </span>
          <RailButton icon={Heart} />
          <RailButton icon={ChatTeardropText} />
          <RailButton icon={BookmarkSimple} />
          <RailButton icon={ShareFat} />
          <span className="flex size-8 items-center justify-center rounded-full bg-scrim ring-[5px] ring-media-foreground/15">
            <ProfilePic account={account} className="size-4" />
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 space-y-1.5 bg-linear-to-t from-scrim/60 to-transparent px-3 pt-16 pr-14 pb-3 text-[12px] leading-snug text-media-foreground">
          {photoMode ? (
            <Dots
              count={images.length}
              index={carousel.index}
              className="mb-2 justify-start"
              activeClassName="bg-media-foreground"
              idleClassName="bg-media-foreground/40"
            />
          ) : null}
          <p className="font-semibold">{username}</p>
          <Caption
            text={caption}
            chars={80}
            lines={2}
            ellipsis="... "
            moreClassName="font-semibold"
            linkClassName="font-semibold"
          />
          <p className="flex items-center gap-1.5">
            <MusicNotesSimple weight="fill" className="size-3 shrink-0" />
            <span className="truncate">
              {photoMode && autoMusic ? "Recommended sound" : `original sound - ${name}`}
            </span>
          </p>
        </div>
      </div>
      <BottomNav
        dark
        items={[
          { icon: House, label: "Home", active: true },
          { icon: Users, label: "Friends" },
          {
            icon: (
              <span className="flex h-6 w-9 items-center justify-center rounded-md bg-media-foreground text-media">
                <Plus weight="bold" className="size-3.5" />
              </span>
            ),
          },
          { icon: ChatText, label: "Inbox" },
          { icon: User, label: "Profile" },
        ]}
      />
    </Phone>
  );
}
