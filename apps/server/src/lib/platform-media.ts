import type { PostType } from "@prisma/client";
import { probeDurationSeconds } from "../api/v1/helpers/media-duration";
import { PostRuleError } from "./post-rules";
import { unavailablePlatforms } from "./platforms";

/**
 * What each platform accepts for media and captions, as its publishing API
 * enforces it (researched 2026-10-06 from the platforms' developer docs).
 *
 * Rules split in two:
 *  - Fixable: image format, size, ratio and carousel consistency.
 *    lib/platform-media-fix.ts rewrites those images at publish time, so they
 *    never block scheduling.
 *  - Not fixable: video length or file size, image counts, caption length.
 *    checkPostForPlatforms() reports them before a post can be scheduled.
 *
 * Keep the client's lib/scheduler/formats.ts in step with this table.
 */

const MB = 1024 * 1024;

export interface ImageRules {
  /** sharp format names the platform takes as-is; others become JPEG. */
  formats: string[];
  maxBytes?: number;
  maxWidth?: number;
  maxHeight?: number;
  /** Width × height cap. */
  maxPixels?: number;
  /** Allowed width / height range; images outside it are padded into it. */
  aspect?: { min: number; max: number; label: string };
  maxImages: number;
  /**
   * Multi-image posts: "first-ratio" pads every image to the first one's
   * ratio (Instagram crops them to it otherwise); "same-size" makes every
   * image the same pixel size (Pinterest rejects mixed sizes).
   */
  carousel?: "first-ratio" | "same-size";
}

export interface VideoRules {
  minSeconds?: number;
  maxSeconds?: number;
  maxBytes?: number;
}

export interface PlatformMediaRules {
  name: string;
  captionLimit: number;
  /** Bluesky counts graphemes, not UTF-16 units. */
  countGraphemes?: boolean;
  image?: ImageRules;
  video?: VideoRules;
}

export const PLATFORM_MEDIA_RULES: Record<string, PlatformMediaRules> = {
  instagram: {
    name: "Instagram",
    captionLimit: 2200,
    image: {
      formats: ["jpeg"],
      maxBytes: 8 * MB,
      maxWidth: 1440,
      aspect: { min: 0.8, max: 1.91, label: "between 4:5 and 1.91:1" },
      maxImages: 10,
      carousel: "first-ratio",
    },
    video: { minSeconds: 3, maxSeconds: 15 * 60, maxBytes: 300 * MB },
  },
  facebook: {
    name: "Facebook",
    captionLimit: 63206,
    image: {
      formats: ["jpeg", "png", "gif"],
      maxBytes: 10 * MB,
      maxImages: 10,
    },
  },
  tiktok: {
    name: "TikTok",
    captionLimit: 2200,
    // Photos are converted by lib/jpeg-image.ts (ensureTikTokPhotoUrl).
    image: { formats: ["jpeg", "webp"], maxImages: 35 },
    video: { minSeconds: 3, maxSeconds: 10 * 60 },
  },
  google: {
    name: "YouTube",
    captionLimit: 5000,
  },
  pinterest: {
    name: "Pinterest",
    captionLimit: 800,
    image: {
      formats: ["jpeg", "png"],
      maxBytes: 20 * MB,
      maxImages: 5,
      carousel: "same-size",
    },
    video: { minSeconds: 4, maxSeconds: 15 * 60, maxBytes: 2048 * MB },
  },
  linkedin: {
    name: "LinkedIn",
    captionLimit: 3000,
    image: {
      formats: ["jpeg", "png", "gif"],
      maxPixels: 36_000_000,
      maxImages: 20,
    },
    video: { minSeconds: 3, maxSeconds: 30 * 60, maxBytes: 500 * MB },
  },
  x: {
    name: "X",
    captionLimit: 280,
    image: {
      formats: ["jpeg", "png", "gif", "webp"],
      maxBytes: 5 * MB,
      maxImages: 4,
    },
    video: { maxSeconds: 140, maxBytes: 512 * MB },
  },
  threads: {
    name: "Threads",
    captionLimit: 500,
    image: {
      formats: ["jpeg", "png"],
      maxBytes: 8 * MB,
      maxWidth: 1440,
      aspect: { min: 0.1, max: 10, label: "between 1:10 and 10:1" },
      maxImages: 20,
    },
    video: { maxSeconds: 5 * 60, maxBytes: 1024 * MB },
  },
  bluesky: {
    name: "Bluesky",
    captionLimit: 300,
    countGraphemes: true,
    image: {
      formats: ["jpeg", "png", "webp"],
      // The blob limit is ~1 MB; stay safely under it.
      maxBytes: 950_000,
      maxImages: 4,
    },
    video: { maxSeconds: 180, maxBytes: 100 * MB },
  },
  google_business: {
    name: "Google Business Profile",
    captionLimit: 1500,
    image: {
      formats: ["jpeg", "png"],
      maxBytes: 5 * MB,
      maxImages: 1,
    },
  },
};

// ─── Checking a post ───────────────────────────────────────────────────────

export interface PlatformMediaItem {
  type: string;
  url: string;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  fileSize?: number | bigint | null;
}

export interface PlatformLeg {
  provider: string;
  caption: string;
}

export interface PlatformIssue {
  provider: string;
  /** "error" blocks scheduling; "fix" is changed automatically at publish. */
  level: "error" | "fix";
  code: string;
  message: string;
}

function captionLength(rules: PlatformMediaRules, text: string): number {
  if (rules.countGraphemes && typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(text)).length;
  }
  return text.length;
}

function formatSeconds(total: number): string {
  const seconds = Math.round(total);
  if (seconds < 60) return `${seconds} seconds`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m} min ${s} s` : `${m} min`;
}

/**
 * Every platform rule this post breaks, per account. Pure: it trusts the
 * media metadata it's given (see withVideoMetadata to fill gaps first).
 */
export function checkPostForPlatforms(
  postType: PostType,
  media: PlatformMediaItem[],
  legs: PlatformLeg[],
): PlatformIssue[] {
  const issues: PlatformIssue[] = [];
  const items = media.filter((m) => m.type !== "THUMBNAIL");
  const images = items.filter((m) => m.type === "IMAGE");
  const video = items.find((m) => m.type === "VIDEO");

  for (const { provider, caption } of legs) {
    const rules = PLATFORM_MEDIA_RULES[provider];
    if (!rules) continue;
    const name = rules.name;
    const push = (level: PlatformIssue["level"], code: string, message: string) =>
      issues.push({ provider, level, code, message });

    const length = captionLength(rules, caption ?? "");
    if (length > rules.captionLimit) {
      push(
        "error",
        "CAPTION_TOO_LONG",
        `${name} allows ${rules.captionLimit.toLocaleString()} characters. This caption has ${length.toLocaleString()}.`,
      );
    }

    if (images.length && rules.image) {
      const img = rules.image;
      if (images.length > img.maxImages) {
        push(
          "error",
          "TOO_MANY_IMAGES",
          `${name} takes ${img.maxImages === 1 ? "one image" : `up to ${img.maxImages} images`}. This post has ${images.length}.`,
        );
      }
      if (img.aspect) {
        const off = images.filter((m) => {
          if (!m.width || !m.height) return false;
          const ratio = m.width / m.height;
          return ratio < img.aspect!.min - 0.01 || ratio > img.aspect!.max + 0.01;
        });
        if (off.length) {
          push(
            "fix",
            "ASPECT_PADDED",
            `${name} needs images ${img.aspect.label}. ${off.length === 1 ? "One image" : `${off.length} images`} will be padded to fit.`,
          );
        }
      }
      if (images.length > 1 && img.carousel) {
        const sized = images.filter((m) => m.width && m.height);
        const ratios = new Set(sized.map((m) => (m.width! / m.height!).toFixed(2)));
        const sizes = new Set(sized.map((m) => `${m.width}x${m.height}`));
        if (img.carousel === "first-ratio" && ratios.size > 1) {
          push(
            "fix",
            "CAROUSEL_RATIO",
            `${name} shows every carousel image at the first image's shape. The others will be padded to match.`,
          );
        }
        if (img.carousel === "same-size" && sizes.size > 1) {
          push(
            "fix",
            "CAROUSEL_SIZE",
            `${name} needs carousel images of the same size. They'll be resized to match the first image.`,
          );
        }
      }
    }

    if (video && rules.video) {
      const v = rules.video;
      if (video.duration) {
        if (v.maxSeconds && video.duration > v.maxSeconds + 0.5) {
          push(
            "error",
            "VIDEO_TOO_LONG",
            `${name} allows videos up to ${formatSeconds(v.maxSeconds)}. This one is ${formatSeconds(video.duration)}.`,
          );
        }
        if (v.minSeconds && video.duration < v.minSeconds) {
          push(
            "error",
            "VIDEO_TOO_SHORT",
            `${name} needs videos of at least ${formatSeconds(v.minSeconds)}. This one is ${formatSeconds(video.duration)}.`,
          );
        }
      }
      const bytes = video.fileSize ? Number(video.fileSize) : 0;
      if (v.maxBytes && bytes > v.maxBytes) {
        push(
          "error",
          "VIDEO_TOO_LARGE",
          `${name} allows videos up to ${Math.round(v.maxBytes / MB).toLocaleString()} MB. This one is ${Math.round(bytes / MB).toLocaleString()} MB.`,
        );
      }
    }
  }

  return issues;
}

/**
 * Fill in a video's missing duration and size from the file itself, so the
 * rules above can run on posts created from URLs (API, MCP, generations).
 * Reads only the container header and a HEAD request; never throws.
 */
export async function withVideoMetadata(
  media: PlatformMediaItem[],
): Promise<PlatformMediaItem[]> {
  return Promise.all(
    media.map(async (m) => {
      if (m.type !== "VIDEO") return m;
      const next = { ...m };
      if (!next.duration) {
        next.duration = await Promise.race([
          probeDurationSeconds(m.url),
          new Promise<null>((r) => setTimeout(() => r(null), 15_000)),
        ]).catch(() => null);
      }
      if (!next.fileSize) {
        try {
          const head = await fetch(m.url, {
            method: "HEAD",
            signal: AbortSignal.timeout(10_000),
          });
          const length = Number(head.headers.get("content-length"));
          if (length > 0) next.fileSize = length;
        } catch {
          // Unknown size: the platform stays the judge.
        }
      }
      return next;
    }),
  );
}

/**
 * Throw a PostRuleError listing every blocking problem, so a post that would
 * fail at publish time can't be scheduled. Fixable issues pass.
 */
export async function assertPlatformRules(
  postType: PostType,
  media: PlatformMediaItem[],
  legs: PlatformLeg[],
): Promise<void> {
  const unavailable = await unavailablePlatforms(legs.map((l) => l.provider));
  if (unavailable.length) {
    throw new PostRuleError(
      `${unavailable.join(", ")} ${unavailable.length === 1 ? "isn't" : "aren't"} available right now. Remove ${unavailable.length === 1 ? "that account" : "those accounts"} to schedule this post.`,
      "PLATFORM_UNAVAILABLE",
    );
  }

  const issues = checkPostForPlatforms(
    postType,
    await withVideoMetadata(media),
    legs,
  );
  const errors = issues.filter((i) => i.level === "error");
  if (!errors.length) return;

  const message =
    errors.length === 1
      ? errors[0].message
      : `${errors.length} things to fix: ${errors.map((e) => e.message).join(" ")}`;
  throw new PostRuleError(message, "PLATFORM_RULES", 400, errors);
}
