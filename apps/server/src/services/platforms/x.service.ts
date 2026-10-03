import { SocialAccount } from "@prisma/client";
import type { PostMediaWithAsset } from "../post.service";
import axios from "axios";

/**
 * X API v2 posting.
 * References: https://docs.x.com/x-api/posts/create-post
 *             https://docs.x.com/x-api/media/quickstart/media-upload-chunked
 *
 * Every media file goes through the chunked v2 upload (initialize → append
 * each ≤5 MB segment → finalize), then the post references the media ids.
 * Videos (and sometimes images) are processed asynchronously: finalize
 * returns processing_info, and the status endpoint is polled until
 * `succeeded` before posting.
 */

const BASE_URL = "https://api.x.com/2";

/** A post can carry up to 4 photos or 1 video. */
const MAX_IMAGES = 4;

/** Append segments must be ≤5 MB; stay under it. */
const CHUNK_BYTES = 4 * 1024 * 1024;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type PostType = "VIDEO" | "IMAGE" | "TEXT" | "CAROUSEL";

type MediaCategory = "tweet_image" | "tweet_gif" | "tweet_video";

interface ProcessingInfo {
  state?: "pending" | "in_progress" | "succeeded" | "failed";
  check_after_secs?: number;
  error?: { message?: string };
}

export class XService {
  async publishPost(
    postType: PostType,
    media: PostMediaWithAsset[],
    account: SocialAccount,
    caption: string,
  ): Promise<{ postId: string; postUrl: string }> {
    try {
      let mediaIds: string[] = [];

      if (postType === "VIDEO") {
        const video = media.find((m) => m.type === "VIDEO");
        if (!video) throw new Error("No video found for X post");
        mediaIds = [
          await this.uploadMedia(account.accessToken, video, "tweet_video"),
        ];
      } else if (postType === "IMAGE" || postType === "CAROUSEL") {
        const images = media
          .filter((m) => m.type === "IMAGE")
          .sort((a, b) => a.order - b.order);

        if (images.length === 0) {
          throw new Error("No images found for X post");
        }
        if (images.length > MAX_IMAGES) {
          throw new Error(
            `X posts support up to ${MAX_IMAGES} images (received ${images.length}).`,
          );
        }

        for (const image of images) {
          const category: MediaCategory =
            image.asset.mimeType === "image/gif" ? "tweet_gif" : "tweet_image";
          mediaIds.push(
            await this.uploadMedia(account.accessToken, image, category),
          );
        }
      }
      // TEXT → text-only post.

      const response = await axios.post(
        `${BASE_URL}/tweets`,
        {
          text: caption,
          ...(mediaIds.length ? { media: { media_ids: mediaIds } } : {}),
        },
        { headers: this.headers(account.accessToken) },
      );

      const postId = response.data?.data?.id as string | undefined;
      if (!postId) {
        throw new Error("X did not return a post id");
      }

      const handle = account.accountUsername;
      return {
        postId,
        postUrl: handle
          ? `https://x.com/${handle}/status/${postId}`
          : `https://x.com/i/web/status/${postId}`,
      };
    } catch (error: any) {
      this.handleXError(error, `X ${postType.toLowerCase()} post`);
    }
  }

  // ─── Media ───

  /** Upload one file through the chunked flow and return its media id. */
  private async uploadMedia(
    accessToken: string,
    media: PostMediaWithAsset,
    category: MediaCategory,
  ): Promise<string> {
    const download = await axios.get<ArrayBuffer>(media.asset.url, {
      responseType: "arraybuffer",
      timeout: 10 * 60 * 1000,
    });
    const buffer = Buffer.from(download.data);
    const mimeType =
      media.asset.mimeType ||
      (category === "tweet_video" ? "video/mp4" : "image/jpeg");

    // 1. Initialize.
    const init = await axios.post(
      `${BASE_URL}/media/upload/initialize`,
      {
        media_type: mimeType,
        total_bytes: buffer.length,
        media_category: category,
      },
      { headers: this.headers(accessToken) },
    );
    const mediaId = init.data?.data?.id as string | undefined;
    if (!mediaId) {
      throw new Error("X media upload did not return a media id");
    }

    // 2. Append each segment.
    for (let offset = 0, index = 0; offset < buffer.length; index++) {
      const chunk = buffer.subarray(offset, offset + CHUNK_BYTES);
      const form = new FormData();
      form.append("segment_index", String(index));
      form.append("media", new Blob([chunk]), "chunk");

      await axios.post(`${BASE_URL}/media/upload/${mediaId}/append`, form, {
        headers: { Authorization: `Bearer ${accessToken}` },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 10 * 60 * 1000,
      });
      offset += chunk.length;
    }

    // 3. Finalize, then wait out any async processing.
    const finalize = await axios.post(
      `${BASE_URL}/media/upload/${mediaId}/finalize`,
      undefined,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    await this.waitForProcessing(
      accessToken,
      mediaId,
      finalize.data?.data?.processing_info,
    );

    return mediaId;
  }

  private async waitForProcessing(
    accessToken: string,
    mediaId: string,
    initial: ProcessingInfo | undefined,
    maxAttempts: number = 60,
  ): Promise<void> {
    let info = initial;

    for (let attempt = 1; info && attempt <= maxAttempts; attempt++) {
      if (info.state === "succeeded") return;
      if (info.state === "failed") {
        throw new Error(
          `X media processing failed${info.error?.message ? `: ${info.error.message}` : ""}`,
        );
      }

      await sleep(Math.min(Math.max(info.check_after_secs ?? 5, 1), 30) * 1000);

      const status = await axios.get(`${BASE_URL}/media/upload`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { command: "STATUS", media_id: mediaId },
      });
      info = status.data?.data?.processing_info;
    }

    // No processing_info means the media is ready to use.
    if (info && info.state !== "succeeded") {
      throw new Error("X media processing timed out");
    }
  }

  // ─── Helpers ───

  private headers(accessToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
  }

  /** Normalize X API errors into a thrown Error. Never returns. */
  private handleXError(error: any, context: string): never {
    const apiError = error.response?.data;

    console.error(`${context} error:`, {
      message: error.message,
      response: apiError,
      status: error.response?.status,
    });

    if (error.response?.status === 401) {
      throw new Error(
        "X access token is invalid or expired. Please reconnect your account.",
      );
    }

    if (error.response?.status === 429) {
      throw new Error(
        "X rate limit reached for this account or app. Try again later.",
      );
    }

    if (!error.response && error instanceof Error) {
      throw error;
    }

    // v2 errors are Problem objects ({ title, detail }) or { errors: [...] }.
    const detail =
      apiError?.detail ||
      apiError?.errors?.[0]?.message ||
      apiError?.title ||
      error.message;
    throw new Error(`${context} failed: ${detail}`);
  }
}

export const xService = new XService();
