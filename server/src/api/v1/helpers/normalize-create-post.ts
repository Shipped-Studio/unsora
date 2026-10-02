import { PostType } from "@prisma/client";
import {
  PostAccountInput,
  PostMediaInput,
  parseMedia,
  parsePostType,
  parseScheduledFor,
} from "./post-validation";
import {
  appendCoverMedia,
  coverUrlFromSettings,
  coverUrlFromVideoMedia,
} from "./reel-cover";
import {
  parsePlatformSettings,
  type PlatformSettings,
} from "./post-platform-settings";

export type NormalizedCreatePost = {
  caption: string;
  postType: PostType;
  accounts: PostAccountInput[];
  media?: PostMediaInput[];
  coverUrl?: string;
  platformSettings?: PlatformSettings;
  scheduledAt: Date | null;
  timezone: string | null;
};

type Result =
  | { ok: true; value: NormalizedCreatePost }
  | { ok: false; error: string };

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function readCaption(body: Record<string, unknown>): string | null {
  if (isNonEmptyString(body.caption)) return body.caption.trim();
  if (isNonEmptyString(body.mainCaption)) return body.mainCaption.trim();
  return null;
}

function readSchedule(body: Record<string, unknown>) {
  const raw =
    body.scheduled_at !== undefined ? body.scheduled_at : body.scheduledFor;
  return parseScheduledFor(raw);
}

function readDuration(media: Record<string, unknown>): number | undefined {
  const candidates = [
    media.duration_sec,
    media.duration_seconds,
    media.duration,
    media.durationSec,
    media.video_duration_sec,
  ];
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  const meta = media.metadata;
  if (meta && typeof meta === "object") {
    return readDuration(meta as Record<string, unknown>);
  }
  return undefined;
}

function readBytes(media: Record<string, unknown>): number | undefined {
  if (typeof media.bytes === "number") return media.bytes;
  if (typeof media.size === "number") return media.size;
  const meta = media.metadata;
  if (meta && typeof meta === "object") {
    const m = meta as Record<string, unknown>;
    if (typeof m.bytes === "number") return m.bytes;
    if (typeof m.size === "number") return m.size;
  }
  return undefined;
}

function readMime(media: Record<string, unknown>): string | undefined {
  if (typeof media.mime_type === "string") return media.mime_type;
  if (typeof media.mime === "string") return media.mime;
  if (typeof media.mimeType === "string") return media.mimeType;
  const meta = media.metadata;
  if (meta && typeof meta === "object") {
    const m = meta as Record<string, unknown>;
    if (typeof m.mime_type === "string") return m.mime_type;
    if (typeof m.mime === "string") return m.mime;
  }
  return undefined;
}

type MediaParseResult =
  | { ok: false; error: string }
  | {
      ok: true;
      partial: Pick<NormalizedCreatePost, "postType" | "media" | "coverUrl">;
    };

function parseSimpleMedia(media: unknown): MediaParseResult {
  if (media === undefined || media === null) {
    return {
      ok: true,
      partial: { postType: "TEXT", media: undefined },
    };
  }

  if (Array.isArray(media)) {
    const parsed = parseMedia(media);
    if (!parsed.ok) return parsed;
    const items = parsed.value ?? [];
    const postType: PostType =
      items.length > 1 ? "CAROUSEL" : items[0]?.type === "VIDEO" ? "VIDEO" : "IMAGE";
    const thumb = items.find((m) => m.type === "THUMBNAIL");
    return {
      ok: true,
      partial: {
        postType,
        media: items.length ? items : undefined,
        coverUrl: thumb?.url,
      },
    };
  }

  if (typeof media !== "object") {
    return { ok: false, error: "media must be an object, array, or null" };
  }

  const row = media as Record<string, unknown>;
  const kind = typeof row.type === "string" ? row.type.toLowerCase() : "";

  if (kind === "video") {
    if (!isNonEmptyString(row.url)) {
      return { ok: false, error: "media.url is required for video posts" };
    }
    const videoItems: PostMediaInput[] = [
      {
        type: "VIDEO",
        url: row.url.trim(),
        width: typeof row.width === "number" ? row.width : undefined,
        height: typeof row.height === "number" ? row.height : undefined,
        duration: readDuration(row),
        fileSize: readBytes(row),
        mimeType: readMime(row),
      },
    ];
    const coverUrl = coverUrlFromVideoMedia(row);
    return {
      ok: true,
      partial: {
        postType: "VIDEO",
        media: appendCoverMedia(videoItems, coverUrl),
        coverUrl,
      },
    };
  }

  if (kind === "slideshow") {
    const urls = row.urls;
    if (!Array.isArray(urls) || urls.length === 0) {
      return {
        ok: false,
        error: "media.urls must be a non-empty array for slideshow posts",
      };
    }
    if (urls.length > 35) {
      return { ok: false, error: "Slideshow supports at most 35 images" };
    }
    const mediaItems: PostMediaInput[] = [];
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      if (!isNonEmptyString(url)) {
        return { ok: false, error: `media.urls[${i}] must be a non-empty string` };
      }
      mediaItems.push({ type: "IMAGE", url: url.trim(), order: i });
    }
    return {
      ok: true,
      partial: { postType: "CAROUSEL", media: mediaItems },
    };
  }

  return {
    ok: false,
    error: 'media.type must be "video" or "slideshow" (or omit media for text-only)',
  };
}

type AccountsParseResult =
  | { ok: false; error: string }
  | { ok: true; accounts: PostAccountInput[] };

function parseSimpleAccounts(accounts: unknown): AccountsParseResult {
  if (!Array.isArray(accounts) || accounts.length === 0) {
    return { ok: false, error: "At least one account is required" };
  }
  if (accounts.length > 10) {
    return { ok: false, error: "At most 10 accounts per post" };
  }

  const parsed: PostAccountInput[] = [];
  for (const item of accounts) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "Each account must be an object with an id" };
    }
    const row = item as Record<string, unknown>;
    const id =
      (isNonEmptyString(row.id) && row.id.trim()) ||
      (isNonEmptyString(row.accountId) && row.accountId.trim()) ||
      null;
    if (!id) {
      return { ok: false, error: 'Each account must include "id" (account UUID)' };
    }
    parsed.push({
      accountId: id,
      customCaption:
        typeof row.customCaption === "string" ? row.customCaption : null,
      title: typeof row.title === "string" ? row.title : null,
    });
  }

  return { ok: true, accounts: parsed };
}

/** Normalize partner-style or legacy create-post bodies. */
export function normalizeCreatePostBody(body: unknown): Result {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object" };
  }

  const raw = body as Record<string, unknown>;
  const caption = readCaption(raw);
  if (!caption) {
    return { ok: false, error: "caption is required" };
  }

  const accountsResult = parseSimpleAccounts(raw.accounts);
  if (!accountsResult.ok) return accountsResult;

  const mediaResult = parseSimpleMedia(raw.media);
  if (!mediaResult.ok) return mediaResult;

  const scheduleResult = readSchedule(raw);
  if (!scheduleResult.ok) return scheduleResult;

  const platformSettingsResult = parsePlatformSettings(raw);
  if (!platformSettingsResult.ok) return platformSettingsResult;

  let scheduledAt = scheduleResult.value ?? null;
  
  if (scheduledAt) {
    const minLeadMs = 2 * 60 * 1000;
    if (scheduledAt.getTime() < Date.now() + minLeadMs) {
      return {
        ok: false,
        error: "scheduled_at must be at least 2 minutes in the future",
      };
    }
  }

  let postType = mediaResult.partial?.postType ?? "TEXT";
  if (raw.type !== undefined) {
    const typeResult = parsePostType(raw.type, { defaultType: postType });
    if (!typeResult.ok) return typeResult;
    postType = typeResult.value;
  }

  const coverUrl =
    mediaResult.partial?.coverUrl ??
    coverUrlFromSettings(platformSettingsResult.value ?? raw.settings);

  let mediaItems = mediaResult.partial?.media;
  if (postType === "VIDEO" && mediaItems?.length) {
    mediaItems = appendCoverMedia(mediaItems, coverUrl);
  }

  return {
    ok: true,
    value: {
      caption,
      postType,
      accounts: accountsResult.accounts!,
      media: mediaItems,
      coverUrl,
      platformSettings: platformSettingsResult.value,
      scheduledAt,
      timezone:
        typeof raw.timezone === "string" && raw.timezone.trim()
          ? raw.timezone.trim()
          : null,
    },
  };
}
