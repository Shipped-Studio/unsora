import { SocialAccount } from "@prisma/client";
import type { PostMediaWithAsset } from "../post.service";
import axios from "axios";

/**
 * YouTube API Service
 * Reference: https://developers.google.com/youtube/v3/docs/videos/insert
 *
 * Uploads use the resumable protocol: initialize with metadata to get an
 * upload session URL, then stream the video bytes to it.
 */

/** Per-account publish settings (PostAccount.settings for google accounts). */
export interface YouTubePostSettings {
  privacyStatus?: "public" | "private" | "unlisted";
  tags?: string[];
  categoryId?: string;
  madeForKids?: boolean;
}

type PostType = "VIDEO" | "IMAGE" | "TEXT" | "CAROUSEL";

/** YouTube limits: title 100 chars, description 5000 characters. */
const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 5000;

export class YouTubeService {
  private baseUrl = "https://www.googleapis.com/youtube/v3";
  private uploadUrl = "https://www.googleapis.com/upload/youtube/v3";

  /**
   * Publish post to YouTube (main method)
   */
  async publishPost(
    postType: PostType,
    media: PostMediaWithAsset[],
    account: SocialAccount,
    caption: string,
    title?: string,
    settings?: Record<string, unknown> | null,
  ): Promise<{ postId: string; postUrl: string }> {
    if (postType !== "VIDEO") {
      throw new Error(
        "YouTube supports video posts only (images and text posts cannot be published)",
      );
    }

    const videoMedia = media.find((m) => m.type === "VIDEO");
    if (!videoMedia) {
      throw new Error("No video found for YouTube post");
    }

    const thumbnailMedia = media.find((m) => m.type === "THUMBNAIL");
    const options = (settings ?? {}) as YouTubePostSettings;

    try {
      // Step 1: Download the video from URL
      const videoResponse = await axios.get(videoMedia.asset.url, {
        responseType: "stream",
        timeout: 10 * 60 * 1000, // 10 minutes for big videos
      });

      const videoSize = videoResponse.headers["content-length"];
      const videoContentType =
        videoResponse.headers["content-type"] || "video/*";

      // Step 2: Initialize resumable upload
      const metadata = {
        snippet: {
          title: this.truncate(
            title || caption.substring(0, MAX_TITLE_LENGTH) || "Untitled",
            MAX_TITLE_LENGTH,
          ),
          description: this.truncate(caption, MAX_DESCRIPTION_LENGTH),
          categoryId: options.categoryId || "22", // People & Blogs
          ...(options.tags?.length ? { tags: options.tags } : {}),
        },
        status: {
          privacyStatus: options.privacyStatus || "public",
          selfDeclaredMadeForKids: options.madeForKids ?? false,
        },
      };

      const initResponse = await axios.post(
        `${this.uploadUrl}/videos?uploadType=resumable&part=snippet,status`,
        metadata,
        {
          headers: {
            Authorization: `Bearer ${account.accessToken}`,
            "Content-Type": "application/json",
            "X-Upload-Content-Length": videoSize,
            "X-Upload-Content-Type": videoContentType,
          },
        }
      );

      const uploadUrl = initResponse.headers["location"];

      if (!uploadUrl) {
        throw new Error("Failed to get upload URL from YouTube");
      }

      // Step 3: Upload the video content
      const uploadResponse = await axios.put(uploadUrl, videoResponse.data, {
        headers: {
          "Content-Type": videoContentType,
          "Content-Length": videoSize,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 30 * 60 * 1000, // 30 minutes for upload
      });

      const videoId = uploadResponse.data.id;
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

      // Step 4 (best effort): custom thumbnail. Requires a phone-verified
      // channel — failure must not fail the publish itself.
      if (thumbnailMedia?.asset?.url) {
        await this.setThumbnail(
          videoId,
          thumbnailMedia.asset.url,
          thumbnailMedia.asset.mimeType || "image/jpeg",
          account.accessToken,
        );
      }

      return {
        postId: videoId,
        postUrl: videoUrl,
      };
    } catch (error: any) {
      console.error("YouTube video upload error:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });

      // Handle token expiration errors
      if (
        error.response?.status === 401 ||
        error.response?.data?.error?.code === 401 ||
        error.response?.data?.error === "invalid_grant"
      ) {
        throw new Error(
          "YouTube access token is invalid or expired. Please reconnect your account."
        );
      }

      // Surface quota errors clearly: video uploads cost 1600 of the 10k
      // daily API quota units, so this is the most common hard failure.
      const reason = error.response?.data?.error?.errors?.[0]?.reason;
      if (reason === "quotaExceeded" || reason === "uploadLimitExceeded") {
        throw new Error(
          "YouTube upload limit reached for today. Please try again later.",
        );
      }

      throw new Error(
        `YouTube video upload failed: ${
          error.response?.data?.error?.message || error.message
        }`
      );
    }
  }

  /** Upload a custom thumbnail for a video (best effort). */
  private async setThumbnail(
    videoId: string,
    thumbnailUrl: string,
    mimeType: string,
    accessToken: string,
  ): Promise<void> {
    try {
      const image = await axios.get<ArrayBuffer>(thumbnailUrl, {
        responseType: "arraybuffer",
      });

      await axios.post(
        `${this.uploadUrl}/thumbnails/set?videoId=${videoId}`,
        Buffer.from(image.data),
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": mimeType,
          },
          maxBodyLength: Infinity,
        },
      );
    } catch (error: any) {
      // Common case: channel not verified for custom thumbnails.
      console.error("YouTube thumbnail upload failed (non-fatal):", {
        videoId,
        message: error.message,
        response: error.response?.data,
      });
    }
  }

  private truncate(text: string, max: number): string {
    return text.length <= max ? text : text.substring(0, max - 1) + "…";
  }
}

export const youtubeService = new YouTubeService();
