import type { Asset, PostMedia, PostType, SocialAccount } from "@prisma/client";
import type { PlatformKey } from "../../lib/platforms";
import { blueskyService } from "./bluesky.service";
import { facebookService } from "./facebook.service";
import { googleBusinessService } from "./google-business.service";
import { instagramService } from "./instagram.service";
import { linkedInService } from "./linkedin.service";
import { pinterestService } from "./pinterest.service";
import { threadsService } from "./threads.service";
import { tiktokService } from "./tiktok.service";
import { xService } from "./x.service";
import { youtubeService } from "./youtube.service";

export type PostMediaWithAsset = PostMedia & { asset: Asset };

/** Everything a platform needs to publish one leg of a post. */
export interface PublishInput {
  postType: PostType;
  media: PostMediaWithAsset[];
  account: SocialAccount;
  caption: string;
  /** Per-account title (YouTube); null when the user didn't set one. */
  title: string | null;
  /** Per-account platform settings (Pinterest board, TikTok privacy, ...). */
  settings: Record<string, unknown> | null;
}

export interface PlatformPublishResult {
  postId?: string;
  postUrl?: string;
}

export interface PlatformPublisher {
  publish(input: PublishInput): Promise<PlatformPublishResult>;
}

/**
 * Keys a SocialAccount.provider can hold. `instagram_facebook` is only a
 * connect method; those accounts are stored with provider "instagram".
 */
export type PublishProvider = Exclude<PlatformKey, "instagram_facebook">;

/**
 * One publisher per provider. Typed over every platform key, so adding a key
 * in lib/platforms.ts without a publisher here fails to compile. Adding a
 * platform means a new service plus one entry here; PostService is untouched.
 */
const publishers: Record<PublishProvider, PlatformPublisher> = {
  google: {
    // YouTube requires a title; fall back to the start of the caption.
    publish: ({ postType, media, account, caption, title, settings }) =>
      youtubeService.publishPost(
        postType,
        media,
        account,
        caption,
        title || caption.substring(0, 100),
        settings,
      ),
  },
  facebook: {
    publish: ({ postType, media, account, caption }) =>
      facebookService.publishPost(postType, media, account, caption),
  },
  instagram: {
    publish: ({ postType, media, account, caption }) =>
      instagramService.publishPost(postType, media, account, caption),
  },
  bluesky: {
    publish: ({ postType, media, account, caption }) =>
      blueskyService.publishPost(postType, media, account, caption),
  },
  threads: {
    publish: ({ postType, media, account, caption }) =>
      threadsService.publishPost(postType, media, account, caption),
  },
  pinterest: {
    publish: ({ postType, media, account, caption, settings }) =>
      pinterestService.publishPost(postType, media, account, caption, settings),
  },
  linkedin: {
    publish: ({ postType, media, account, caption }) =>
      linkedInService.publishPost(postType, media, account, caption),
  },
  tiktok: {
    publish: ({ postType, media, account, caption, settings }) =>
      tiktokService.publishPost(postType, media, account, caption, settings),
  },
  x: {
    publish: ({ postType, media, account, caption }) =>
      xService.publishPost(postType, media, account, caption),
  },
  google_business: {
    publish: ({ postType, media, account, caption, settings }) =>
      googleBusinessService.publishPost(postType, media, account, caption, settings),
  },
};

/** The publisher for a SocialAccount.provider value (case-insensitive). */
export function getPublisher(provider: string): PlatformPublisher {
  const key = provider.toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(publishers, key)) {
    throw new Error(`Unsupported platform: ${provider}`);
  }
  return publishers[key as PublishProvider];
}
