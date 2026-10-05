import type { PostType } from "@prisma/client";

/**
 * Which post types each provider can publish. Mirrors the platform services
 * in src/services/platforms/*. Keep the client's lib/scheduler/formats.ts in
 * sync with this table.
 */
export const PROVIDER_POST_TYPES: Record<string, readonly PostType[]> = {
  google: ["VIDEO"],
  tiktok: ["VIDEO", "IMAGE", "CAROUSEL"],
  instagram: ["VIDEO", "IMAGE", "CAROUSEL"],
  facebook: ["VIDEO", "IMAGE", "CAROUSEL", "TEXT"],
  threads: ["VIDEO", "IMAGE", "CAROUSEL", "TEXT"],
  bluesky: ["VIDEO", "IMAGE", "CAROUSEL", "TEXT"],
  pinterest: ["VIDEO", "IMAGE", "CAROUSEL"],
  linkedin: ["VIDEO", "IMAGE", "CAROUSEL", "TEXT"],
  x: ["VIDEO", "IMAGE", "CAROUSEL", "TEXT"],
  google_business: ["IMAGE", "TEXT"],
};

const PROVIDER_NAMES: Record<string, string> = {
  google: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
  threads: "Threads",
  bluesky: "Bluesky",
  pinterest: "Pinterest",
  linkedin: "LinkedIn",
  x: "X",
  google_business: "Google Business Profile",
};

export const POST_TYPES: readonly PostType[] = [
  "VIDEO",
  "IMAGE",
  "CAROUSEL",
  "TEXT",
];

export function isPostType(value: unknown): value is PostType {
  return typeof value === "string" && POST_TYPES.includes(value as PostType);
}

export class PostRuleError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 400,
    /** Per-account problems (PLATFORM_RULES), for clients to list them. */
    public issues?: { provider: string; code: string; message: string }[],
  ) {
    super(message);
  }
}

interface MediaInput {
  type?: string;
}

/**
 * Checks that the media matches the post type. Drafts may be incomplete, so
 * `requireMedia` is only set when the post is being scheduled or published.
 */
export function assertMediaMatchesType(
  type: PostType,
  media: MediaInput[] | undefined,
  requireMedia: boolean,
) {
  const items = (media ?? []).filter((m) => m.type !== "THUMBNAIL");
  const videos = items.filter((m) => m.type === "VIDEO").length;
  const images = items.filter((m) => m.type === "IMAGE").length;

  if (type === "TEXT") {
    if (items.length > 0) {
      throw new PostRuleError(
        "Text posts can't include media. Use a photo or video post instead.",
        "MEDIA_NOT_ALLOWED",
      );
    }
    return;
  }

  if (videos > 0 && images > 0) {
    throw new PostRuleError(
      "A post can't mix video and images.",
      "MIXED_MEDIA",
    );
  }

  if (!requireMedia) return;

  if (type === "VIDEO" && videos !== 1) {
    throw new PostRuleError("Add one video before scheduling.", "MEDIA_REQUIRED");
  }
  if (type === "IMAGE" && images !== 1) {
    throw new PostRuleError("Add one image before scheduling.", "MEDIA_REQUIRED");
  }
  if (type === "CAROUSEL" && images < 1) {
    throw new PostRuleError(
      "Add at least one image before scheduling.",
      "MEDIA_REQUIRED",
    );
  }
}

/** Text posts are only their caption, so it can't be empty. */
export function assertCaptionForType(type: PostType, caption: string | null) {
  if (type === "TEXT" && !caption?.trim()) {
    throw new PostRuleError(
      "Write something before scheduling a text post.",
      "CAPTION_REQUIRED",
    );
  }
}

/** Rejects accounts whose platform can't publish this post type. */
export function assertProvidersSupportType(
  type: PostType,
  providers: string[],
) {
  const unsupported = [...new Set(providers)].filter(
    (provider) => !(PROVIDER_POST_TYPES[provider] ?? []).includes(type),
  );
  if (unsupported.length === 0) return;

  const names = unsupported.map((p) => PROVIDER_NAMES[p] ?? p).join(", ");
  const label =
    type === "VIDEO"
      ? "video"
      : type === "TEXT"
        ? "text-only"
        : "photo";
  throw new PostRuleError(
    `${names} can't publish ${label} posts. Remove ${unsupported.length === 1 ? "that account" : "those accounts"} or change the post type.`,
    "UNSUPPORTED_FORMAT",
  );
}

/**
 * Parses a schedule time and rejects anything in the past. A 30 second
 * allowance covers clock drift between the browser and the server.
 */
export function parseFutureDate(value: unknown): Date {
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) {
    throw new PostRuleError("That schedule time isn't a valid date.", "INVALID_DATE");
  }
  if (date.getTime() < Date.now() - 30_000) {
    throw new PostRuleError(
      "That time has already passed. Pick a time in the future.",
      "SCHEDULE_IN_PAST",
    );
  }
  return date;
}
