/**
 * What every platform can publish, and the four post formats the composer
 * offers. This mirrors the server's platform services,
 * server/src/lib/post-rules.ts and server/src/lib/platform-media.ts; change
 * them together.
 */

export type Provider =
  | "google"
  | "tiktok"
  | "instagram"
  | "facebook"
  | "threads"
  | "bluesky"
  | "pinterest"
  | "linkedin"
  | "x"
  | "google_business";

export type PostFormat = "video" | "photos" | "slideshow" | "text";
export type PostType = "VIDEO" | "IMAGE" | "CAROUSEL" | "TEXT";

export interface FormatRule {
  minImages?: number;
  maxImages?: number;
  minVideoSeconds?: number;
  maxVideoSeconds?: number;
  maxVideoBytes?: number;
  /**
   * Allowed width / height range for each image. The server pads images
   * outside it at publish time, so it's shown as a note, not an error.
   */
  aspect?: { min: number; max: number; label: string };
  /**
   * Multi-image posts, also fixed by the server at publish time:
   * "first-ratio" pads every image to the first one's shape (Instagram),
   * "same-size" makes them the same pixel size (Pinterest).
   */
  carousel?: "first-ratio" | "same-size";
}

export interface PlatformSpec {
  id: Provider;
  name: string;
  /** For tight spots like counters and grid tiles. Defaults to name. */
  shortName?: string;
  /** What a connected account is on this platform. */
  accountNoun: string;
  captionLimit: number;
  /** Bluesky counts graphemes, not UTF-16 units. */
  countGraphemes?: boolean;
  /** Platforms with a separate title field. */
  title?: { limit: number; required: boolean; label: string };
  /** Formats this platform accepts, with its limits for each. */
  formats: Partial<Record<PostFormat, FormatRule>>;
  /** Whether the platform uses an uploaded or picked cover for video. */
  videoCover: boolean;
  connectNote?: string;
}

const MB = 1024 * 1024;

export const PLATFORMS: Record<Provider, PlatformSpec> = {
  instagram: {
    id: "instagram",
    name: "Instagram",
    accountNoun: "professional account",
    captionLimit: 2200,
    videoCover: true,
    formats: {
      video: { minVideoSeconds: 3, maxVideoSeconds: 15 * 60, maxVideoBytes: 300 * MB },
      photos: {
        minImages: 1,
        maxImages: 10,
        aspect: { min: 0.8, max: 1.91, label: "between 4:5 and 1.91:1" },
        carousel: "first-ratio",
      },
      slideshow: {
        minImages: 2,
        maxImages: 10,
        aspect: { min: 0.8, max: 1.91, label: "between 4:5 and 1.91:1" },
        carousel: "first-ratio",
      },
    },
    connectNote: "Needs an Instagram business or creator account.",
  },
  tiktok: {
    id: "tiktok",
    name: "TikTok",
    accountNoun: "account",
    captionLimit: 2200,
    videoCover: false,
    formats: {
      video: { minVideoSeconds: 3, maxVideoSeconds: 10 * 60 },
      photos: { minImages: 1, maxImages: 35 },
      slideshow: { minImages: 1, maxImages: 35 },
    },
  },
  google: {
    id: "google",
    name: "YouTube",
    accountNoun: "channel",
    captionLimit: 5000,
    title: { limit: 100, required: true, label: "Title" },
    videoCover: true,
    formats: {
      video: {},
    },
  },
  facebook: {
    id: "facebook",
    name: "Facebook",
    accountNoun: "Page",
    captionLimit: 63206,
    videoCover: false,
    formats: {
      video: {},
      photos: { minImages: 1, maxImages: 10 },
      slideshow: { minImages: 2, maxImages: 10 },
      text: {},
    },
    connectNote: "Publishes to Facebook Pages you manage, not personal profiles.",
  },
  threads: {
    id: "threads",
    name: "Threads",
    accountNoun: "profile",
    captionLimit: 500,
    videoCover: false,
    formats: {
      video: { maxVideoSeconds: 5 * 60, maxVideoBytes: 1024 * MB },
      photos: { minImages: 1, maxImages: 20 },
      slideshow: { minImages: 2, maxImages: 20 },
      text: {},
    },
  },
  bluesky: {
    id: "bluesky",
    name: "Bluesky",
    accountNoun: "account",
    captionLimit: 300,
    countGraphemes: true,
    videoCover: false,
    formats: {
      video: { maxVideoSeconds: 180, maxVideoBytes: 100 * MB },
      photos: { minImages: 1, maxImages: 4 },
      text: {},
    },
  },
  pinterest: {
    id: "pinterest",
    name: "Pinterest",
    accountNoun: "account",
    captionLimit: 800,
    title: { limit: 100, required: false, label: "Pin title" },
    videoCover: true,
    formats: {
      video: { minVideoSeconds: 4, maxVideoSeconds: 15 * 60, maxVideoBytes: 2048 * MB },
      photos: { minImages: 1, maxImages: 5, carousel: "same-size" },
    },
  },
  linkedin: {
    id: "linkedin",
    name: "LinkedIn",
    accountNoun: "profile",
    captionLimit: 3000,
    videoCover: false,
    formats: {
      video: { minVideoSeconds: 3, maxVideoSeconds: 30 * 60, maxVideoBytes: 500 * MB },
      photos: { minImages: 1, maxImages: 20 },
      text: {},
    },
    connectNote: "Publishes to your personal profile. Company pages aren't supported yet.",
  },
  x: {
    id: "x",
    name: "X",
    accountNoun: "account",
    captionLimit: 280,
    videoCover: false,
    formats: {
      video: { maxVideoSeconds: 140, maxVideoBytes: 512 * MB },
      photos: { minImages: 1, maxImages: 4 },
      text: {},
    },
  },
  google_business: {
    id: "google_business",
    name: "Google Business Profile",
    shortName: "Google Business",
    // One sign-in connects every location the Google account manages.
    accountNoun: "location",
    captionLimit: 1500,
    videoCover: false,
    formats: {
      photos: { minImages: 1, maxImages: 1 },
      text: {},
    },
    connectNote:
      "Connects every Business Profile location you manage. Posts appear on your Google Search and Maps listing.",
  },
};

export const PLATFORM_ORDER: Provider[] = [
  "instagram",
  "tiktok",
  "google",
  "facebook",
  "linkedin",
  "x",
  "pinterest",
  "google_business",
  "bluesky",
  "threads",
];

export interface FormatSpec {
  id: PostFormat;
  label: string;
  description: string;
  href: string;
  mediaKind: "video" | "image" | "none";
}

export const FORMATS: Record<PostFormat, FormatSpec> = {
  video: {
    id: "video",
    label: "Video",
    description: "One video, posted as a Reel, Short, TikTok or feed video.",
    href: "/scheduler/new/video",
    mediaKind: "video",
  },
  photos: {
    id: "photos",
    label: "Photos",
    description: "One image or a carousel for feeds.",
    href: "/scheduler/new/photos",
    mediaKind: "image",
  },
  slideshow: {
    id: "slideshow",
    label: "Slideshow",
    description: "Vertical swipe-through photos, built for TikTok photo mode.",
    href: "/scheduler/new/slideshow",
    mediaKind: "image",
  },
  text: {
    id: "text",
    label: "Text",
    description: "A written post with no media.",
    href: "/scheduler/new/text",
    mediaKind: "none",
  },
};

export const FORMAT_ORDER: PostFormat[] = ["video", "photos", "slideshow", "text"];

export function isProvider(value: string): value is Provider {
  return value in PLATFORMS;
}

export function platformName(provider: string) {
  return isProvider(provider) ? PLATFORMS[provider].name : provider;
}

export function platformShortName(provider: string) {
  return isProvider(provider)
    ? (PLATFORMS[provider].shortName ?? PLATFORMS[provider].name)
    : provider;
}

/** The rule for a platform and format, or undefined when unsupported. */
export function formatRule(provider: string, format: PostFormat) {
  return isProvider(provider) ? PLATFORMS[provider].formats[format] : undefined;
}

export function supportsFormat(provider: string, format: PostFormat) {
  return formatRule(provider, format) !== undefined;
}

/** Why an account can't take a format, phrased for the account picker. */
export function unsupportedReason(provider: string, format: PostFormat) {
  if (!isProvider(provider)) return "This platform isn't supported yet.";
  const spec = PLATFORMS[provider];
  const accepted = (Object.keys(spec.formats) as PostFormat[]).map(
    (f) => FORMATS[f].label.toLowerCase(),
  );
  if (accepted.length === 1) {
    return `${spec.name} only accepts ${accepted[0]} posts.`;
  }
  return `${spec.name} doesn't accept ${FORMATS[format].label.toLowerCase()} posts.`;
}

/** The server post type for a format and image count. */
export function postTypeFor(format: PostFormat, imageCount: number): PostType {
  if (format === "video") return "VIDEO";
  if (format === "text") return "TEXT";
  if (format === "slideshow") return "CAROUSEL";
  return imageCount > 1 ? "CAROUSEL" : "IMAGE";
}

/** Which composer to open for an existing post. */
export function formatForPost(post: {
  type: PostType;
  media?: { type: string }[];
}): PostFormat {
  if (post.type === "VIDEO") return "video";
  if (post.type === "TEXT") return "text";
  return "photos";
}

/** Characters as the platform counts them. */
export function captionLength(provider: string, text: string) {
  if (isProvider(provider) && PLATFORMS[provider].countGraphemes) {
    if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
      const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
      return Array.from(segmenter.segment(text)).length;
    }
  }
  return text.length;
}

/**
 * Link that opens the right composer with a file already attached.
 * Used by Library and every tool's "Schedule" action.
 */
export function scheduleHref(media: {
  url: string;
  mediaType: "video" | "image" | "audio" | string;
}) {
  const format: PostFormat = media.mediaType === "video" ? "video" : "photos";
  const params = new URLSearchParams({ media: media.url });
  return `${FORMATS[format].href}?${params.toString()}`;
}
