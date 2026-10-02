"use client";

import {
  CaretLeft,
  ChatCircle,
  DotsThree,
  Export,
  Heart,
  House,
  MagnifyingGlass,
  Plus,
  ChatText,
} from "@phosphor-icons/react";
import {
  BottomNav,
  Caption,
  Dots,
  MediaFill,
  Phone,
  ProfilePic,
  Screen,
  TapZones,
  mediaOf,
  names,
  ratioOf,
  useCarousel,
  type PreviewProps,
} from "./shared";

function domainOf(link: string) {
  try {
    return new URL(link.startsWith("http") ? link : `https://${link}`).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** The pin close-up a viewer lands on after tapping the pin. */
export function PinterestPreview({ account, state, caption }: PreviewProps) {
  const { video, images, poster } = mediaOf(state);
  const { name } = names(account);
  const pin = state.pinterest[account.id];
  const carousel = useCarousel(images.length);
  const item = video ?? images[carousel.index];
  const domain = pin?.link ? domainOf(pin.link) : null;

  return (
    <Phone>
      <Screen>
        <div className="relative m-2 overflow-hidden rounded-3xl bg-muted" style={{ aspectRatio: ratioOf(video ?? images[0], 0.56, 1.5, 0.67) }}>
          <MediaFill item={item} poster={poster} />
          {!video && images.length > 1 ? <TapZones onPrev={carousel.prev} onNext={carousel.next} /> : null}
          <span className="absolute top-2.5 left-2.5 z-20 flex size-8 items-center justify-center rounded-full bg-card text-foreground">
            <CaretLeft weight="bold" className="size-4" />
          </span>
        </div>
        {!video ? <Dots count={images.length} index={carousel.index} className="-mt-0.5 mb-1" activeClassName="bg-foreground" /> : null}

        <div className="flex items-center gap-4 px-4 py-1.5">
          <Heart className="size-6" />
          <ChatCircle className="size-6" />
          <Export className="size-6" />
          <DotsThree weight="bold" className="size-6" />
          <span className="ml-auto rounded-full bg-platform-pinterest px-4 py-2.5 text-[13px] font-semibold text-platform-foreground">
            Save
          </span>
        </div>

        <div className="space-y-2 px-4 pt-1 pb-4">
          {domain ? <p className="text-[11px] font-semibold underline underline-offset-2">{domain}</p> : null}
          {pin?.title ? <p className="text-[17px] leading-tight font-semibold">{pin.title}</p> : null}
          <Caption text={caption} chars={120} lines={3} ellipsis="... " more="more" moreClassName="font-semibold" className="text-[12px] leading-snug" />
          <div className="flex items-center gap-2 pt-1">
            <ProfilePic account={account} />
            <p className="min-w-0 flex-1 truncate text-[12px] font-semibold">{name}</p>
            <span className="rounded-full bg-secondary px-3 py-1.5 text-[12px] font-semibold">Follow</span>
          </div>
        </div>
      </Screen>
      <BottomNav
        items={[
          { icon: House, active: true },
          { icon: MagnifyingGlass },
          { icon: Plus },
          { icon: ChatText },
          { icon: <ProfilePic account={account} className="size-5" /> },
        ]}
      />
    </Phone>
  );
}
