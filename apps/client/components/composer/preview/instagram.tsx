"use client";

import {
  BookmarkSimple,
  CaretLeft,
  ChatCircle,
  DotsThree,
  FilmSlate,
  Heart,
  House,
  MagnifyingGlass,
  MusicNotesSimple,
  PaperPlaneTilt,
  PlusSquare,
} from "@phosphor-icons/react";
import {
  BottomNav,
  Caption,
  MediaFill,
  Phone,
  ProfilePic,
  Screen,
  TapZones,
  Dots,
  mediaOf,
  names,
  ratioOf,
  useCarousel,
  type PreviewProps,
} from "./shared";

function Nav({ account, reels }: Pick<PreviewProps, "account"> & { reels?: boolean }) {
  return (
    <BottomNav
      dark={reels}
      items={[
        { icon: House, active: !reels },
        { icon: MagnifyingGlass },
        { icon: PlusSquare },
        { icon: FilmSlate, active: reels },
        { icon: <ProfilePic account={account} className="size-5" /> },
      ]}
    />
  );
}

/** A feed post opened from the profile grid: single photo or carousel. */
function FeedPost({ account, state, caption }: PreviewProps) {
  const { images } = mediaOf(state);
  const { username } = names(account);
  const carousel = useCarousel(images.length);
  // Instagram crops feed media between 4:5 and 1.91:1, set by the first image.
  const ratio = ratioOf(images[0], 0.8, 1.91);

  return (
    <Phone>
      <div className="flex h-11 shrink-0 items-center gap-3 px-3">
        <CaretLeft className="size-5" />
        <div className="flex-1 text-center leading-tight">
          <p className="text-[10px] text-muted-foreground uppercase">{username}</p>
          <p className="text-sm font-semibold">Posts</p>
        </div>
        <span className="size-5" />
      </div>
      <Screen>
        <div className="flex items-center gap-2.5 px-3 py-2">
          <ProfilePic account={account} />
          <p className="flex-1 truncate text-[13px] font-semibold">{username}</p>
          <DotsThree weight="bold" className="size-5" />
        </div>

        <div className="relative bg-muted" style={{ aspectRatio: ratio }}>
          <MediaFill item={images[carousel.index]} />
          {images.length > 1 ? (
            <>
              <span className="absolute top-3 right-3 rounded-full bg-scrim/60 px-2 py-0.5 text-[11px] font-medium text-media-foreground tabular-nums">
                {carousel.index + 1}/{images.length}
              </span>
              <TapZones onPrev={carousel.prev} onNext={carousel.next} />
            </>
          ) : null}
        </div>

        <div className="relative flex items-center gap-3.5 px-3 pt-2.5 pb-1.5">
          <Heart className="size-6" />
          <ChatCircle className="size-6 -scale-x-100" />
          <PaperPlaneTilt className="size-6" />
          <Dots
            count={images.length}
            index={carousel.index}
            className="absolute inset-x-0 top-4 mx-auto w-fit"
            activeClassName="bg-link-social"
          />
          <BookmarkSimple className="ml-auto size-6" />
        </div>

        <div className="space-y-1 px-3 pb-4 text-[13px] leading-snug">
          <Caption
            text={caption}
            chars={125}
            lines={2}
            lead={<span className="mr-1 font-semibold">{username}</span>}
            linkClassName="text-link-instagram"
          />
          <p className="text-[11px] text-muted-foreground">Just now</p>
        </div>
      </Screen>
      <Nav account={account} />
    </Phone>
  );
}

/** Every Instagram video is published as a Reel. */
function Reel({ account, state, caption }: PreviewProps) {
  const { video, poster } = mediaOf(state);
  const { username } = names(account);

  return (
    <Phone dark statusOverlay>
      <div className="relative min-h-0 flex-1">
        <MediaFill item={video} poster={poster} />
        <div className="absolute inset-x-0 top-7 z-10 flex items-center justify-between px-4 text-media-foreground">
          <span className="text-lg font-bold">Reels</span>
        </div>

        <div className="absolute right-2.5 bottom-4 z-10 flex flex-col items-center gap-4 text-media-foreground">
          <Heart className="size-6" />
          <ChatCircle className="size-6 -scale-x-100" />
          <PaperPlaneTilt className="size-6" />
          <DotsThree weight="bold" className="size-5" />
          <ProfilePic account={account} className="size-6 rounded-md ring-2 ring-media-foreground [&_*]:rounded-md" />
        </div>

        <div className="absolute inset-x-0 bottom-0 space-y-2 bg-linear-to-t from-scrim/70 to-transparent px-3 pt-16 pr-12 pb-4 text-[12px] text-media-foreground">
          <div className="flex items-center gap-2">
            <ProfilePic account={account} className="size-6" />
            <span className="truncate font-semibold">{username}</span>
            <span className="rounded-md border border-media-foreground/60 px-2 py-0.5 text-[11px] font-semibold">
              Follow
            </span>
          </div>
          <Caption text={caption} chars={60} lines={1} moreClassName="text-media-foreground/70" />
          <p className="flex items-center gap-1.5 text-[11px]">
            <MusicNotesSimple weight="fill" className="size-3" />
            <span className="truncate">{username} · Original audio</span>
          </p>
        </div>
      </div>
      <Nav account={account} reels />
    </Phone>
  );
}

export function InstagramPreview(props: PreviewProps) {
  return mediaOf(props.state).video ? <Reel {...props} /> : <FeedPost {...props} />;
}
