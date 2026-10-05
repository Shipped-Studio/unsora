/**
 * Pure state, validation and serialization for the post composer. The React
 * hook in hooks/use-composer.ts wraps this; keeping the rules here makes them
 * easy to read and to reuse on the server-facing edges.
 */
import {
  PLATFORMS,
  captionLength,
  formatRule,
  isProvider,
  platformName,
  postTypeFor,
  unsupportedReason,
  type PostFormat,
} from "./formats";
import type { ConnectedAccount, Post } from "./types";
import type { PostPayload } from "@/hooks/use-posts";
import {
  defaultTikTokOptionsState,
  fromTikTokPostSettings,
  isTikTokOptionsValid,
  toTikTokPostSettings,
  type TikTokOptionsState,
} from "@/lib/tiktok-post-settings";

export interface MediaItem {
  key: string;
  kind: "video" | "image";
  /** Remote URL once uploaded. */
  url: string | null;
  /** What we render: an object URL while uploading, then the remote URL. */
  previewUrl: string;
  status: "uploading" | "ready" | "error";
  progress: number;
  error?: string;
  width?: number;
  height?: number;
  duration?: number;
  size?: number;
  mimeType?: string;
  name?: string;
}

export interface CoverState {
  url: string | null;
  previewUrl: string;
  status: "uploading" | "ready" | "error";
  /** Frame time when the cover was captured from the video. */
  timestampMs?: number;
}

export interface YouTubeOptions {
  privacyStatus: "public" | "unlisted" | "private";
  madeForKids: boolean;
  categoryId: string;
  tags: string[];
}

export interface PinterestOptions {
  boardId?: string;
  title: string;
  link: string;
}

/** The call-to-action button under a Google Business post. */
export type GoogleBusinessCta =
  | "LEARN_MORE"
  | "BOOK"
  | "ORDER"
  | "SHOP"
  | "SIGN_UP"
  | "CALL";

export interface GoogleBusinessOptions {
  /** Missing means no button. */
  ctaType?: GoogleBusinessCta;
  /** Where the button goes. Unused for CALL, which dials the business. */
  ctaUrl: string;
}

export interface TikTokOptions extends TikTokOptionsState {
  autoAddMusic: boolean;
}

export interface ComposerState {
  format: PostFormat;
  accountIds: string[];
  caption: string;
  /** Per-account caption. Missing means "use the main caption". */
  overrides: Record<string, string>;
  /** YouTube title per account. */
  titles: Record<string, string>;
  youtube: Record<string, YouTubeOptions>;
  tiktok: Record<string, TikTokOptions>;
  pinterest: Record<string, PinterestOptions>;
  googleBusiness: Record<string, GoogleBusinessOptions>;
  media: MediaItem[];
  cover: CoverState | null;
  /** Slideshow cover, as an index into media. */
  coverIndex: number;
  scheduledAt: Date | null;
  timezone: string;
}

export const DEFAULT_YOUTUBE: YouTubeOptions = {
  privacyStatus: "public",
  madeForKids: false,
  categoryId: "22",
  tags: [],
};

export const DEFAULT_PINTEREST: PinterestOptions = { title: "", link: "" };

export const DEFAULT_GOOGLE_BUSINESS: GoogleBusinessOptions = { ctaUrl: "" };

export const GOOGLE_BUSINESS_CTA_LABELS: Record<GoogleBusinessCta, string> = {
  LEARN_MORE: "Learn more",
  BOOK: "Book",
  ORDER: "Order online",
  SHOP: "Buy",
  SIGN_UP: "Sign up",
  CALL: "Call now",
};

export function defaultTikTok(): TikTokOptions {
  return { ...defaultTikTokOptionsState(), autoAddMusic: true };
}

export function emptyState(format: PostFormat, timezone: string): ComposerState {
  return {
    format,
    accountIds: [],
    caption: "",
    overrides: {},
    titles: {},
    youtube: {},
    tiktok: {},
    pinterest: {},
    googleBusiness: {},
    media: [],
    cover: null,
    coverIndex: 0,
    scheduledAt: null,
    timezone,
  };
}

let keyCounter = 0;
export const mediaKey = () => `m${Date.now().toString(36)}${(keyCounter++).toString(36)}`;

/** Rebuild composer state from a saved post. */
export function stateFromPost(
  post: Post,
  format: PostFormat,
  fallbackTimezone: string,
): ComposerState {
  const state = emptyState(format, post.scheduledTimezone || fallbackTimezone);
  state.caption = post.mainCaption;
  state.scheduledAt = post.scheduledFor ? new Date(post.scheduledFor) : null;

  for (const leg of post.postAccounts) {
    const id = leg.accountId;
    state.accountIds.push(id);
    if (leg.customCaption) state.overrides[id] = leg.customCaption;
    const settings = (leg.settings ?? {}) as Record<string, unknown>;
    switch (leg.account.provider) {
      case "google":
        state.titles[id] = leg.title ?? "";
        state.youtube[id] = {
          privacyStatus:
            (settings.privacyStatus as YouTubeOptions["privacyStatus"]) ?? "public",
          madeForKids: Boolean(settings.madeForKids),
          categoryId: String(settings.categoryId ?? "22"),
          tags: Array.isArray(settings.tags) ? (settings.tags as string[]) : [],
        };
        break;
      case "tiktok":
        state.tiktok[id] = {
          ...fromTikTokPostSettings(settings),
          autoAddMusic: settings.auto_add_music !== false,
        };
        if (typeof settings.photo_cover_index === "number") {
          state.coverIndex = settings.photo_cover_index;
        }
        break;
      case "pinterest":
        state.pinterest[id] = {
          boardId: (settings.boardId as string) || undefined,
          title: (settings.title as string) ?? "",
          link: (settings.link as string) ?? "",
        };
        break;
      case "google_business":
        state.googleBusiness[id] = {
          ctaType:
            typeof settings.ctaType === "string" && settings.ctaType in GOOGLE_BUSINESS_CTA_LABELS
              ? (settings.ctaType as GoogleBusinessCta)
              : undefined,
          ctaUrl: (settings.ctaUrl as string) ?? "",
        };
        break;
    }
  }

  const ordered = [...post.media].sort((a, b) => a.order - b.order);
  for (const m of ordered) {
    if (m.type === "THUMBNAIL") {
      state.cover = { url: m.asset.url, previewUrl: m.asset.url, status: "ready" };
      continue;
    }
    state.media.push({
      key: mediaKey(),
      kind: m.type === "VIDEO" ? "video" : "image",
      url: m.asset.url,
      previewUrl: m.asset.url,
      status: "ready",
      progress: 100,
      width: m.asset.width ?? undefined,
      height: m.asset.height ?? undefined,
      duration: m.asset.duration ?? undefined,
      mimeType: m.asset.mimeType,
      name: m.asset.name,
    });
  }
  return state;
}

/** Makes sure every selected account has its option object. */
export function withAccountDefaults(
  state: ComposerState,
  accounts: ConnectedAccount[],
): ComposerState {
  const next = { ...state };
  for (const id of state.accountIds) {
    const account = accounts.find((a) => a.id === id);
    if (!account) continue;
    if (account.provider === "google" && !next.youtube[id]) {
      next.youtube = { ...next.youtube, [id]: { ...DEFAULT_YOUTUBE } };
    }
    if (account.provider === "tiktok" && !next.tiktok[id]) {
      next.tiktok = { ...next.tiktok, [id]: defaultTikTok() };
    }
    if (account.provider === "pinterest" && !next.pinterest[id]) {
      next.pinterest = { ...next.pinterest, [id]: { ...DEFAULT_PINTEREST } };
    }
    if (account.provider === "google_business" && !next.googleBusiness[id]) {
      next.googleBusiness = {
        ...next.googleBusiness,
        [id]: { ...DEFAULT_GOOGLE_BUSINESS },
      };
    }
  }
  return next;
}

export interface Issue {
  level: "error" | "warning";
  message: string;
  accountId?: string;
  /** Section the issue belongs to, for scrolling to it. */
  field: "accounts" | "media" | "caption" | "options" | "schedule";
}

export interface TikTokLimits {
  maxVideoSeconds?: number;
  canPost?: boolean;
  canPostReason?: string;
}

export function captionFor(state: ComposerState, accountId: string) {
  return state.overrides[accountId] ?? state.caption;
}

/**
 * Everything that would stop this post from publishing. Drafts only need an
 * account and no uploads in flight; the rest is checked when scheduling.
 */
export function validate(
  state: ComposerState,
  accounts: ConnectedAccount[],
  options: {
    intent: "draft" | "publish";
    tiktokLimits?: Record<string, TikTokLimits>;
    lockedAccountIds?: string[];
  },
): Issue[] {
  const issues: Issue[] = [];
  const selected = state.accountIds
    .map((id) => accounts.find((a) => a.id === id))
    .filter((a): a is ConnectedAccount => Boolean(a));

  if (selected.length === 0) {
    issues.push({ level: "error", field: "accounts", message: "Pick at least one account." });
  }

  const uploading = state.media.some((m) => m.status === "uploading") ||
    state.cover?.status === "uploading";
  if (uploading) {
    issues.push({ level: "error", field: "media", message: "Wait for uploads to finish." });
  }
  const failed = state.media.filter((m) => m.status === "error");
  if (failed.length) {
    issues.push({
      level: "error",
      field: "media",
      message: `${failed.length === 1 ? "A file" : `${failed.length} files`} failed to upload. Remove ${failed.length === 1 ? "it" : "them"} or try again.`,
    });
  }

  if (options.intent === "draft") return issues;

  const videos = state.media.filter((m) => m.kind === "video");
  const images = state.media.filter((m) => m.kind === "image");

  if (state.format === "video" && videos.length === 0) {
    issues.push({ level: "error", field: "media", message: "Add a video." });
  }
  if ((state.format === "photos" || state.format === "slideshow") && images.length === 0) {
    issues.push({ level: "error", field: "media", message: "Add at least one image." });
  }
  if (state.format === "text" && !state.caption.trim()) {
    issues.push({ level: "error", field: "caption", message: "Write your post." });
  }

  for (const account of selected) {
    if (options.lockedAccountIds?.includes(account.id)) continue;
    const name = platformName(account.provider);
    const rule = formatRule(account.provider, state.format);

    if (!rule) {
      issues.push({
        level: "error",
        field: "accounts",
        accountId: account.id,
        message: unsupportedReason(account.provider, state.format),
      });
      continue;
    }

    if (account.status === "reconnect") {
      issues.push({
        level: "error",
        field: "accounts",
        accountId: account.id,
        message: `Reconnect ${name} (${account.accountName ?? account.accountUsername ?? "account"}) before scheduling.`,
      });
    }

    const spec = isProvider(account.provider) ? PLATFORMS[account.provider] : null;
    const caption = captionFor(state, account.id);
    if (spec && captionLength(account.provider, caption) > spec.captionLimit) {
      issues.push({
        level: "error",
        field: "caption",
        accountId: account.id,
        message: `${name} allows ${spec.captionLimit.toLocaleString()} characters. This caption has ${captionLength(account.provider, caption).toLocaleString()}.`,
      });
    }

    if (images.length) {
      if (rule.maxImages && images.length > rule.maxImages) {
        issues.push({
          level: "error",
          field: "media",
          accountId: account.id,
          message: `${name} takes ${rule.maxImages === 1 ? "one image" : `up to ${rule.maxImages} images`}. You have ${images.length}.`,
        });
      }
      if (rule.minImages && images.length < rule.minImages) {
        issues.push({
          level: "error",
          field: "media",
          accountId: account.id,
          message: `${name} needs at least ${rule.minImages} images for this format.`,
        });
      }
      // Ratio and carousel shape are fixed by the server at publish time
      // (server/src/lib/platform-media-fix.ts), so they're notes, not errors.
      if (rule.aspect) {
        const off = images.filter((img) => {
          if (!img.width || !img.height) return false;
          const ratio = img.width / img.height;
          return ratio < rule.aspect!.min - 0.01 || ratio > rule.aspect!.max + 0.01;
        });
        if (off.length) {
          issues.push({
            level: "warning",
            field: "media",
            accountId: account.id,
            message: `${name} needs images ${rule.aspect.label}. ${off.length === 1 ? "One image" : `${off.length} images`} will be padded to fit, so nothing is cropped.`,
          });
        }
      }
      const sized = images.filter((img) => img.width && img.height);
      if (images.length > 1 && rule.carousel === "first-ratio") {
        const ratios = new Set(sized.map((img) => (img.width! / img.height!).toFixed(2)));
        if (ratios.size > 1) {
          issues.push({
            level: "warning",
            field: "media",
            accountId: account.id,
            message: `${name} shows every image at the first image's shape. The others will be padded to match.`,
          });
        }
      }
      if (images.length > 1 && rule.carousel === "same-size") {
        const sizes = new Set(sized.map((img) => `${img.width}x${img.height}`));
        if (sizes.size > 1) {
          issues.push({
            level: "warning",
            field: "media",
            accountId: account.id,
            message: `${name} needs every image at the same size. They'll be resized to match the first image.`,
          });
        }
      }
    }

    const video = videos[0];
    if (video?.duration) {
      const tiktokMax = options.tiktokLimits?.[account.id]?.maxVideoSeconds;
      const max = account.provider === "tiktok" ? tiktokMax : rule.maxVideoSeconds;
      if (max && video.duration > max + 0.5) {
        issues.push({
          level: "error",
          field: "media",
          accountId: account.id,
          message: `${name} allows videos up to ${formatSeconds(max)}. Yours is ${formatSeconds(video.duration)}.`,
        });
      }
      if (rule.minVideoSeconds && video.duration < rule.minVideoSeconds) {
        issues.push({
          level: "error",
          field: "media",
          accountId: account.id,
          message: `${name} needs videos of at least ${rule.minVideoSeconds} seconds.`,
        });
      }
    }
    if (video?.size && rule.maxVideoBytes && video.size > rule.maxVideoBytes) {
      issues.push({
        level: "error",
        field: "media",
        accountId: account.id,
        message: `${name} allows videos up to ${Math.round(rule.maxVideoBytes / 1024 / 1024)} MB.`,
      });
    }

    if (account.provider === "google" && !(state.titles[account.id] ?? "").trim()) {
      issues.push({
        level: "error",
        field: "options",
        accountId: account.id,
        message: "Add a YouTube title.",
      });
    }
    if (account.provider === "google" && (state.titles[account.id] ?? "").length > 100) {
      issues.push({
        level: "error",
        field: "options",
        accountId: account.id,
        message: "YouTube titles can be up to 100 characters.",
      });
    }

    if (account.provider === "tiktok") {
      const tiktok = state.tiktok[account.id] ?? defaultTikTok();
      const limits = options.tiktokLimits?.[account.id];
      if (limits?.canPost === false) {
        issues.push({
          level: "error",
          field: "options",
          accountId: account.id,
          message:
            limits.canPostReason ||
            "TikTok isn't accepting posts from this account right now. Try again later.",
        });
      }
      if (!tiktok.privacyLevel) {
        issues.push({
          level: "error",
          field: "options",
          accountId: account.id,
          message: "Choose who can see the TikTok post.",
        });
      } else if (!isTikTokOptionsValid(tiktok)) {
        issues.push({
          level: "error",
          field: "options",
          accountId: account.id,
          message: tiktok.brandedContent && tiktok.privacyLevel === "SELF_ONLY"
            ? "Branded content on TikTok can't be private. Change who can see it."
            : "Say whether the TikTok post promotes your brand or someone else's.",
        });
      }
    }

    if (account.provider === "pinterest") {
      const pin = state.pinterest[account.id];
      if (pin?.title && pin.title.length > 100) {
        issues.push({
          level: "error",
          field: "options",
          accountId: account.id,
          message: "Pinterest titles can be up to 100 characters.",
        });
      }
      if (pin?.link && !/^https?:\/\//i.test(pin.link)) {
        issues.push({
          level: "error",
          field: "options",
          accountId: account.id,
          message: "The Pinterest link needs to start with https://",
        });
      }
    }

    if (account.provider === "google_business") {
      const gbp = state.googleBusiness[account.id];
      if (gbp?.ctaType && gbp.ctaType !== "CALL" && !/^https?:\/\/\S+$/i.test(gbp.ctaUrl.trim())) {
        issues.push({
          level: "error",
          field: "options",
          accountId: account.id,
          message: `Add a link for the "${GOOGLE_BUSINESS_CTA_LABELS[gbp.ctaType]}" button, starting with https://`,
        });
      }
    }
  }

  return issues;
}

function formatSeconds(total: number) {
  const seconds = Math.round(total);
  if (seconds < 60) return `${seconds} seconds`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m} min ${s} s` : `${m} min`;
}

/** Turns composer state into the API payload. */
export function toPayload(
  state: ComposerState,
  accounts: ConnectedAccount[],
): Omit<PostPayload, "scheduledFor" | "timezone"> {
  const images = state.media.filter((m) => m.kind === "image" && m.url);
  const type = postTypeFor(state.format, images.length);

  const media: NonNullable<PostPayload["media"]> = [];
  if (type !== "TEXT") {
    state.media
      .filter((m) => m.url && (type === "VIDEO" ? m.kind === "video" : m.kind === "image"))
      .forEach((m, index) => {
        media.push({
          type: m.kind === "video" ? "VIDEO" : "IMAGE",
          url: m.url!,
          order: index,
          width: m.width,
          height: m.height,
          duration: m.duration,
          fileSize: m.size,
          mimeType: m.mimeType,
        });
      });
    if (type === "VIDEO" && state.cover?.url) {
      media.push({ type: "THUMBNAIL", url: state.cover.url, order: media.length });
    }
  }

  const legs = state.accountIds.map((accountId) => {
    const account = accounts.find((a) => a.id === accountId);
    const provider = account?.provider;
    let settings: Record<string, unknown> | null = null;
    let title: string | null = null;

    if (provider === "google") {
      const yt = state.youtube[accountId] ?? DEFAULT_YOUTUBE;
      title = (state.titles[accountId] ?? "").trim() || null;
      settings = {
        privacyStatus: yt.privacyStatus,
        madeForKids: yt.madeForKids,
        categoryId: yt.categoryId,
        ...(yt.tags.length ? { tags: yt.tags } : {}),
      };
    } else if (provider === "tiktok") {
      const tiktok = state.tiktok[accountId] ?? defaultTikTok();
      settings = {
        ...toTikTokPostSettings(tiktok),
        ...(type === "VIDEO"
          ? state.cover?.timestampMs !== undefined
            ? { video_cover_timestamp_ms: state.cover.timestampMs }
            : {}
          : {
              auto_add_music: tiktok.autoAddMusic,
              photo_cover_index: Math.min(state.coverIndex, Math.max(images.length - 1, 0)),
            }),
      };
    } else if (provider === "pinterest") {
      const pin = state.pinterest[accountId] ?? DEFAULT_PINTEREST;
      settings = {
        ...(pin.boardId ? { boardId: pin.boardId } : {}),
        ...(pin.title.trim() ? { title: pin.title.trim() } : {}),
        ...(pin.link.trim() ? { link: pin.link.trim() } : {}),
      };
    } else if (provider === "google_business") {
      const gbp = state.googleBusiness[accountId] ?? DEFAULT_GOOGLE_BUSINESS;
      // CALL uses the business phone number, so it never sends a link.
      settings = gbp.ctaType
        ? {
            ctaType: gbp.ctaType,
            ...(gbp.ctaType !== "CALL" ? { ctaUrl: gbp.ctaUrl.trim() } : {}),
          }
        : {};
    }

    const override = state.overrides[accountId];
    return {
      accountId,
      customCaption: override !== undefined && override !== state.caption ? override : null,
      title,
      settings,
    };
  });

  return { type, mainCaption: state.caption, media, accounts: legs };
}
