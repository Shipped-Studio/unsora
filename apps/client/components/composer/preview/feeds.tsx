"use client";

import {
  ArrowsClockwise,
  Bell,
  Briefcase,
  CaretLeft,
  ChatCircle,
  ChatTeardrop,
  DotsThree,
  GlobeHemisphereWest,
  Hash,
  Heart,
  House,
  MagnifyingGlass,
  PaperPlaneTilt,
  PlusSquare,
  Repeat,
  ShareFat,
  ThumbsUp,
  User,
  Users,
  X,
} from "@phosphor-icons/react";
import { PlatformIcon } from "@/components/scheduler/platform-icon";
import {
  BottomNav,
  Caption,
  MediaFill,
  Phone,
  PhotoGrid,
  ProfilePic,
  Screen,
  mediaOf,
  names,
  ratioOf,
  type PreviewProps,
} from "./shared";

/** Media for a feed post: the video at its own shape, or the photo layout. */
function FeedMedia({
  state,
  rounded,
  gap,
}: {
  state: PreviewProps["state"];
  rounded?: string;
  gap?: string;
}) {
  const { video, images, poster } = mediaOf(state);
  if (video) {
    return (
      <div className={`overflow-hidden bg-media ${rounded ?? ""}`} style={{ aspectRatio: ratioOf(video, 0.8, 1.91, 0.8) }}>
        <MediaFill item={video} poster={poster} />
      </div>
    );
  }
  return <PhotoGrid items={images} rounded={rounded} gap={gap} />;
}

export function FacebookPreview({ account, state, caption }: PreviewProps) {
  const { name } = names(account);
  const { hasMedia } = mediaOf(state);

  return (
    <Phone>
      <div className="flex h-11 shrink-0 items-center gap-3 border-b border-border/60 px-3">
        <CaretLeft className="size-5" />
        <p className="flex-1 truncate text-[14px] font-semibold">{name}&apos;s post</p>
        <MagnifyingGlass className="size-5" />
      </div>
      <Screen>
        <div className="flex items-center gap-2.5 px-3 pt-3">
          <ProfilePic account={account} className="size-9" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[13px] font-semibold">{name}</p>
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              Just now · <GlobeHemisphereWest weight="fill" className="size-3" />
            </p>
          </div>
          <DotsThree weight="bold" className="size-5 text-muted-foreground" />
          <X className="size-5 text-muted-foreground" />
        </div>
        <Caption
          text={caption}
          chars={hasMedia ? 160 : 400}
          lines={hasMedia ? 3 : 8}
          ellipsis="... "
          more="See more"
          moreClassName="font-semibold text-muted-foreground"
          linkClassName="text-link-facebook"
          className="px-3 py-2.5 text-[13px] leading-snug"
        />
        <FeedMedia state={state} gap="gap-0.5" />
        <div className="mx-3 mt-2 flex justify-around border-t border-border/60 py-2 text-[12px] font-semibold text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <ThumbsUp className="size-4.5" /> Like
          </span>
          <span className="flex items-center gap-1.5">
            <ChatCircle className="size-4.5" /> Comment
          </span>
          <span className="flex items-center gap-1.5">
            <ShareFat className="size-4.5" /> Share
          </span>
        </div>
      </Screen>
      <BottomNav
        items={[
          { icon: House, active: true },
          { icon: Users },
          { icon: PlusSquare },
          { icon: Bell },
          { icon: <ProfilePic account={account} className="size-5" /> },
        ]}
        className="[&>span:first-child]:text-platform-facebook"
      />
    </Phone>
  );
}

export function LinkedInPreview({ account, state, caption }: PreviewProps) {
  const { name } = names(account);

  return (
    <Phone>
      <div className="flex h-11 shrink-0 items-center gap-2.5 border-b border-border/60 px-3">
        <ProfilePic account={account} className="size-6" />
        <span className="flex h-7 flex-1 items-center gap-1.5 rounded-md bg-secondary px-2 text-[12px] text-muted-foreground">
          <MagnifyingGlass className="size-3.5" /> Search
        </span>
        <ChatCircle className="size-5" />
      </div>
      <Screen>
        <div className="flex items-start gap-2 px-3 pt-3">
          <ProfilePic account={account} className="size-10" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[13px] font-semibold">{name}</p>
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              Now · <GlobeHemisphereWest weight="fill" className="size-3" />
            </p>
          </div>
          <span className="text-[13px] font-semibold text-link-linkedin">+ Follow</span>
        </div>
        <Caption
          text={caption}
          chars={210}
          lines={3}
          ellipsis="…"
          more="more"
          moreClassName="text-muted-foreground"
          linkClassName="font-semibold text-link-linkedin"
          className="px-3 py-2.5 text-[13px] leading-snug"
        />
        <FeedMedia state={state} gap="gap-1" />
        <div className="mx-3 mt-2 flex justify-between border-t border-border/60 py-2 text-[11px] font-semibold text-muted-foreground">
          {[
            { icon: ThumbsUp, label: "Like" },
            { icon: ChatTeardrop, label: "Comment" },
            { icon: Repeat, label: "Repost" },
            { icon: PaperPlaneTilt, label: "Send" },
          ].map(({ icon: Icon, label }) => (
            <span key={label} className="flex flex-col items-center gap-0.5">
              <Icon className="size-4.5" />
              {label}
            </span>
          ))}
        </div>
      </Screen>
      <BottomNav
        items={[
          { icon: House, label: "Home", active: true },
          { icon: Users, label: "Network" },
          { icon: PlusSquare, label: "Post" },
          { icon: Bell, label: "Alerts" },
          { icon: Briefcase, label: "Jobs" },
        ]}
      />
    </Phone>
  );
}

export function ThreadsPreview({ account, state, caption }: PreviewProps) {
  const { username } = names(account);
  const { video, images, poster } = mediaOf(state);

  return (
    <Phone>
      <div className="flex h-11 shrink-0 items-center justify-center">
        <PlatformIcon provider="threads" className="size-7" />
      </div>
      <Screen>
        <div className="flex gap-2.5 border-b border-border/60 px-3 pt-2 pb-3">
          <ProfilePic account={account} className="size-9" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-1.5 text-[13px]">
              <span className="truncate font-semibold">{username}</span>
              <span className="text-muted-foreground">now</span>
              <DotsThree weight="bold" className="ml-auto size-5" />
            </div>
            <Caption
              text={caption}
              chars={500}
              linkClassName="text-link-social"
              className="-mt-1.5 text-[13px] leading-snug"
            />
            {video ? (
              <div className="w-3/4 overflow-hidden rounded-lg bg-media" style={{ aspectRatio: ratioOf(video, 0.56, 1.91, 0.8) }}>
                <MediaFill item={video} poster={poster} />
              </div>
            ) : images.length === 1 ? (
              <div className="w-full overflow-hidden rounded-lg" style={{ aspectRatio: ratioOf(images[0], 0.75, 1.91) }}>
                <MediaFill item={images[0]} />
              </div>
            ) : images.length > 1 ? (
              <div className="-mr-3 flex gap-1.5 overflow-x-auto pr-3 no-scrollbar">
                {images.map((item) => (
                  <div key={item.key} className="aspect-[3/4] w-[62%] shrink-0 overflow-hidden rounded-lg">
                    <MediaFill item={item} />
                  </div>
                ))}
              </div>
            ) : null}
            <div className="flex gap-4 pt-0.5">
              <Heart className="size-5" />
              <ChatCircle className="size-5 -scale-x-100" />
              <Repeat className="size-5" />
              <PaperPlaneTilt className="size-5" />
            </div>
          </div>
        </div>
      </Screen>
      <BottomNav
        items={[
          { icon: House, active: true },
          { icon: MagnifyingGlass },
          { icon: PlusSquare },
          { icon: Heart },
          { icon: User },
        ]}
      />
    </Phone>
  );
}

export function BlueskyPreview({ account, state, caption }: PreviewProps) {
  const { name, handle } = names(account);
  const { video, images, poster } = mediaOf(state);

  return (
    <Phone>
      <div className="flex h-11 shrink-0 items-center justify-center border-b border-border/60">
        <PlatformIcon provider="bluesky" className="size-7" />
      </div>
      <Screen>
        <div className="flex gap-2.5 border-b border-border/60 px-3 py-3">
          <ProfilePic account={account} className="size-10" />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="flex min-w-0 items-baseline gap-1 text-[13px] leading-tight">
              <span className="truncate font-semibold">{name}</span>
              <span className="truncate text-muted-foreground">{handle} · now</span>
            </p>
            <Caption
              text={caption}
              chars={300}
              linkClassName="text-link-social"
              className="-mt-1 text-[13px] leading-snug"
            />
            {video ? (
              <div className="overflow-hidden rounded-lg bg-media" style={{ aspectRatio: ratioOf(video, 0.75, 1.91, 0.8) }}>
                <MediaFill item={video} poster={poster} />
              </div>
            ) : (
              <PhotoGrid items={images.slice(0, 4)} rounded="rounded-lg" gap="gap-1" single={{ min: 0.75, max: 1.91 }} />
            )}
            <div className="flex justify-between pt-0.5 pr-6 text-muted-foreground">
              <ChatCircle className="size-4.5" />
              <ArrowsClockwise className="size-4.5" />
              <Heart className="size-4.5" />
              <DotsThree weight="bold" className="size-4.5" />
            </div>
          </div>
        </div>
      </Screen>
      <BottomNav
        items={[
          { icon: House, active: true },
          { icon: MagnifyingGlass },
          { icon: ChatCircle },
          { icon: Bell },
          { icon: Hash },
        ]}
      />
    </Phone>
  );
}
