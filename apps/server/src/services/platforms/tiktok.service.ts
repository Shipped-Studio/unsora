import { SocialAccount } from "@prisma/client";
import { ensureTikTokPhotoUrl } from "../../lib/jpeg-image";
import type { PostMediaWithAsset } from "../post.service";
import axios, { AxiosResponse } from "axios";

/**
 * TikTok API Service
 * References:
 * - https://developers.tiktok.com/doc/content-posting-api-get-started/
 * - https://developers.tiktok.com/doc/content-posting-api-reference-photo-post
 */

const BASE_URL = "https://open.tiktokapis.com/v2";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Rewrite a storage URL to a verified CDN domain. TikTok only accepts media
 * URLs on a verified domain, so when MEDIA_STORAGE_BASE (the storage public
 * URL prefix) and MEDIA_CDN_BASE (e.g. https://files.tryunsora.com) are set,
 * we swap the host. Otherwise the URL is returned unchanged.
 */
export const getCdnUrl = (url: string) => {
  const from = process.env.MEDIA_STORAGE_BASE;
  const to = process.env.MEDIA_CDN_BASE;
  if (from && to) return url.replace(from, to);
  return url;
};

type PostType = "VIDEO" | "IMAGE" | "TEXT" | "CAROUSEL";

type PublishResult = { postId: string; postUrl: string };

type TikTokStoredSettings = {
  post_mode?: "DIRECT_POST" | "MEDIA_UPLOAD";
  privacy_level?: string;
  disable_comment?: boolean;
  disable_duet?: boolean;
  disable_stitch?: boolean;
  brand_content_toggle?: boolean;
  brand_organic_toggle?: boolean;
  is_aigc?: boolean;
  auto_add_music?: boolean;
  photo_cover_index?: number;
  video_cover_timestamp_ms?: number;
};

/**
 * Per-account TikTok settings are stored as loose JSON that may use snake_case
 * or camelCase keys; normalize them into a typed shape.
 */
function readStoredTikTokSettings(
  raw: Record<string, unknown> | null | undefined,
): TikTokStoredSettings {
  if (!raw) return {};
  const pickBool = (snake: string, camel: string) => {
    const v = raw[snake] ?? raw[camel];
    return typeof v === "boolean" ? v : undefined;
  };
  const pickNum = (snake: string, camel: string) => {
    const v = raw[snake] ?? raw[camel];
    return typeof v === "number" && Number.isFinite(v) ? v : undefined;
  };
  const postMode = raw.post_mode ?? raw.postMode;
  return {
    post_mode:
      postMode === "DIRECT_POST" || postMode === "MEDIA_UPLOAD"
        ? postMode
        : undefined,
    privacy_level:
      typeof (raw.privacy_level ?? raw.privacyLevel) === "string"
        ? String(raw.privacy_level ?? raw.privacyLevel).trim()
        : undefined,
    disable_comment: pickBool("disable_comment", "disableComment"),
    disable_duet: pickBool("disable_duet", "disableDuet"),
    disable_stitch: pickBool("disable_stitch", "disableStitch"),
    brand_content_toggle: pickBool(
      "brand_content_toggle",
      "brandContentToggle",
    ),
    brand_organic_toggle: pickBool(
      "brand_organic_toggle",
      "brandOrganicToggle",
    ),
    is_aigc: pickBool("is_aigc", "isAigc"),
    auto_add_music: pickBool("auto_add_music", "autoAddMusic"),
    photo_cover_index: pickNum("photo_cover_index", "photoCoverIndex"),
    video_cover_timestamp_ms: pickNum(
      "video_cover_timestamp_ms",
      "videoCoverTimestampMs",
    ),
  };
}

/** Copy only the defined optional toggles onto a post_info payload. */
function applyOptionalToggles(
  post_info: Record<string, unknown>,
  settings: TikTokStoredSettings,
  keys: (keyof TikTokStoredSettings)[],
): void {
  for (const key of keys) {
    if (settings[key] !== undefined) post_info[key] = settings[key];
  }
}

function buildVideoPostInfo(
  caption: string,
  settings: TikTokStoredSettings,
): Record<string, unknown> {
  const post_info: Record<string, unknown> = {
    title: caption,
    privacy_level: settings.privacy_level ?? "PUBLIC_TO_EVERYONE",
    disable_duet: settings.disable_duet ?? false,
    disable_comment: settings.disable_comment ?? false,
    disable_stitch: settings.disable_stitch ?? false,
    video_cover_timestamp_ms: settings.video_cover_timestamp_ms ?? 1000,
  };
  applyOptionalToggles(post_info, settings, [
    "brand_content_toggle",
    "brand_organic_toggle",
    "is_aigc",
  ]);
  return post_info;
}

function buildPhotoPostInfo(
  caption: string,
  settings: TikTokStoredSettings,
): Record<string, unknown> {
  const post_info: Record<string, unknown> = {
    title: caption.slice(0, 90),
    description: caption,
    privacy_level: settings.privacy_level ?? "PUBLIC_TO_EVERYONE",
    disable_comment: settings.disable_comment ?? false,
  };
  applyOptionalToggles(post_info, settings, [
    "auto_add_music",
    "brand_content_toggle",
    "brand_organic_toggle",
    "is_aigc",
  ]);
  return post_info;
}

/**
 * TikTok returns post ids as bare 64-bit JSON numbers. JSON.parse rounds
 * anything above 2^53, silently corrupting the id (and with it the share
 * URL), so quote the ids before parsing.
 */
function parseStatusResponsePreservingIds(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  const quoted = raw.replace(
    /("publica?l?ly_available_post_id"\s*:\s*\[)([^\]]*)(\])/g,
    (_match, prefix, ids, suffix) =>
      prefix + ids.replace(/"?(\d+)"?/g, '"$1"') + suffix,
  );
  try {
    return JSON.parse(quoted);
  } catch {
    return raw;
  }
}

export class TikTokService {
  /**
   * Publish post to TikTok (video reel or photo slideshow).
   */
  async publishPost(
    postType: PostType,
    media: PostMediaWithAsset[],
    account: SocialAccount,
    caption: string,
    accountSettings?: Record<string, unknown> | null,
  ): Promise<PublishResult> {
    const settings = readStoredTikTokSettings(accountSettings ?? undefined);

    // TikTok photo mode takes 1 to 35 images, so a single photo is published
    // the same way as a carousel.
    if (postType === "CAROUSEL" || postType === "IMAGE") {
      return this.publishPhotoPost(media, account, caption, settings);
    }

    if (postType !== "VIDEO") {
      throw new Error("TikTok supports video reels and image slideshows only");
    }

    return this.publishVideoPost(media, account, caption, settings);
  }

  // ─── Video posts ───

  private async publishVideoPost(
    media: PostMediaWithAsset[],
    account: SocialAccount,
    caption: string,
    settings: TikTokStoredSettings,
  ): Promise<PublishResult> {
    const videoMedia = media.find((m) => m.type === "VIDEO");
    if (!videoMedia) {
      throw new Error("No video found for TikTok post");
    }

    try {
      // PULL_FROM_URL: TikTok downloads the video itself from our verified
      // CDN domain, so no bytes pass through this server.
      const initResponse = await this.apiPost(
        "/post/publish/video/init/",
        account.accessToken,
        {
          post_info: buildVideoPostInfo(caption, settings),
          source_info: {
            source: "PULL_FROM_URL",
            video_url: getCdnUrl(videoMedia.asset.url),
          },
        },
      );

      const publishId = initResponse.data.data.publish_id;
      return await this.finalizePublish(publishId, account, "video");
    } catch (error: any) {
      throw this.wrapTikTokError(error, "TikTok video upload failed");
    }
  }

  // ─── Photo posts ───

  private async publishPhotoPost(
    media: PostMediaWithAsset[],
    account: SocialAccount,
    caption: string,
    settings: TikTokStoredSettings,
  ): Promise<PublishResult> {
    const imageMedia = media
      .filter((m) => m.type === "IMAGE")
      .sort((a, b) => a.order - b.order);

    if (!imageMedia.length) {
      throw new Error("No images found for TikTok slideshow post");
    }

    // TikTok only accepts JPEG/WebP photos (PNG → file_format_check_failed)
    // up to 1080x1920 (larger → picture_size_check_failed); normalize
    // incompatible images before handing TikTok the URLs.
    const images = await Promise.all(
      imageMedia.map(async (m) =>
        getCdnUrl(await ensureTikTokPhotoUrl(m.asset.url)),
      ),
    );

    const coverIndex = Math.min(
      Math.max(0, settings.photo_cover_index ?? 0),
      images.length - 1,
    );

    try {
      const initResponse = await this.apiPost(
        "/post/publish/content/init/",
        account.accessToken,
        {
          post_info: buildPhotoPostInfo(caption, settings),
          source_info: {
            source: "PULL_FROM_URL",
            photo_images: images,
            photo_cover_index: coverIndex,
          },
          post_mode: settings.post_mode ?? "DIRECT_POST",
          media_type: "PHOTO",
        },
      );

      const publishId = initResponse.data.data.publish_id;
      return await this.finalizePublish(publishId, account, "photo");
    } catch (error: any) {
      throw this.wrapTikTokError(error, "TikTok photo post failed");
    }
  }

  // ─── Shared publish tail: poll processing, then resolve the post URL ───

  /**
   * Wait for TikTok to finish processing, then resolve the public post id and
   * share URL. Private (SELF_ONLY) posts — which unaudited/sandbox clients are
   * forced to use — publish successfully but return no public post id; fall
   * back to the publish id / profile URL in that case.
   */
  private async finalizePublish(
    publishId: string,
    account: SocialAccount,
    kind: "video" | "photo",
  ): Promise<PublishResult> {
    const result = await this.pollUploadStatus(publishId, account.accessToken);

    if (!result.success) {
      throw new Error(`TikTok ${kind} upload timed out`);
    }

    const postId = result.postId;
    const shareUrl = postId
      ? await this.queryShareUrl(postId, account.accessToken)
      : null;

    return {
      postId: postId ?? publishId,
      postUrl: shareUrl ?? this.buildFallbackUrl(account, kind, postId),
    };
  }

  /** Best-effort URL when the Display API can't resolve a share_url. */
  buildFallbackUrl(
    account: SocialAccount,
    kind: "video" | "photo",
    postId: string | undefined,
  ): string {
    if (!account.accountUsername) return "https://www.tiktok.com";
    const profileUrl = `https://www.tiktok.com/@${account.accountUsername}`;
    return postId ? `${profileUrl}/${kind}/${postId}` : profileUrl;
  }

  // ─── HTTP helpers ───

  private apiPost(
    path: string,
    accessToken: string,
    body: unknown,
    extraConfig: Record<string, unknown> = {},
  ): Promise<AxiosResponse> {
    return axios.post(`${BASE_URL}${path}`, body, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      ...extraConfig,
    });
  }

  private wrapTikTokError(error: any, prefix: string): Error {
    console.error("TikTok publish error:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });

    if (
      error.response?.status === 401 ||
      error.response?.data?.error === "invalid_token" ||
      error.response?.data?.error?.code === "access_token_invalid"
    ) {
      return new Error(
        "TikTok access token is invalid or expired. Please reconnect your account.",
      );
    }

    if (error.response?.data?.error?.code === "spam_risk_too_many_posts") {
      return new Error(
        "You have reached the daily posting limit on TikTok. Please try again later.",
      );
    }

    return new Error(
      `${prefix}: ${error.response?.data?.error?.message || error.message}`,
    );
  }

  // ─── Status polling and URL resolution ───

  /**
   * Poll the publish status until PUBLISH_COMPLETE, FAILED, or timeout.
   * On success, returns the publicly available post id when TikTok provides
   * one (public posts only).
   */
  private async pollUploadStatus(
    publishId: string,
    accessToken: string,
    maxAttempts: number = 60,
    intervalMs: number = 5000,
  ): Promise<{ success: boolean; postId?: string }> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const statusResponse = await this.apiPost(
          "/post/publish/status/fetch/",
          accessToken,
          { publish_id: publishId },
          { transformResponse: parseStatusResponsePreservingIds },
        );

        const data = statusResponse.data.data;
        // The docs' JSON sample has a typo (`publicaly_…`); accept both spellings.
        const postIds: string[] = (
          data.publicly_available_post_id ||
          data.publicaly_available_post_id ||
          []
        ).map((id: unknown) => String(id));

        if (data.status === "PUBLISH_COMPLETE") {
          return { success: true, postId: postIds[0] };
        }

        if (data.status === "FAILED") {
          throw new Error(
            `TikTok upload failed: ${data.fail_reason || "Unknown error"}`,
          );
        }

        if (attempt < maxAttempts) {
          await sleep(intervalMs);
        }
      } catch (error: any) {
        console.error("Error polling TikTok upload status:", {
          message: error.message,
          response: error.response?.data,
        });

        if (error.response?.status !== 429) {
          throw error;
        }

        // Rate limited; back off and retry.
        await sleep(intervalMs * 2);
      }
    }

    return { success: false };
  }

  /**
   * Query share_url for a published post via the Display / Video Query API.
   * Newly published posts can take a while to become queryable, so retry.
   * Returns null when the URL can't be resolved (e.g. missing video.list
   * scope) — callers fall back to a constructed URL.
   *
   * Public so the TikTok webhook handler can resolve URLs when the
   * post.publish.publicly_available event delivers the post id.
   */
  async queryShareUrl(
    videoId: string,
    accessToken: string,
    maxAttempts: number = 30,
    intervalMs: number = 3000,
  ): Promise<string | null> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await this.apiPost(
          "/video/query/?fields=id,share_url,title",
          accessToken,
          { filters: { video_ids: [videoId] } },
        );

        const shareUrl = response.data?.data?.videos?.[0]?.share_url;
        if (shareUrl) {
          return shareUrl;
        }

        if (attempt < maxAttempts) {
          await sleep(intervalMs);
        }
      } catch (error: any) {
        console.error("Error querying TikTok video share URL:", {
          videoId,
          attempt,
          message: error.message,
          response: error.response?.data,
        });

        if (attempt < maxAttempts && error.response?.status === 429) {
          await sleep(intervalMs * 2);
          continue;
        }

        return null;
      }
    }

    return null;
  }
}

export const tiktokService = new TikTokService();
