import { SocialAccount } from "@prisma/client";
import type { PostMediaWithAsset } from "../post.service";
import axios from "axios";

/**
 * Instagram API Service
 * Reference: https://developers.facebook.com/docs/instagram-api/guides/content-publishing
 *
 * Publishing is a two-step flow for every media type: create a media
 * container, wait for Instagram to process it, then publish the container.
 * Carousels add one child container per image before the parent container.
 */

const BASE_URL = "https://graph.instagram.com/v24.0";

/** Instagram allows a maximum of 10 items per carousel. */
const MAX_CAROUSEL_IMAGES = 10;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type PostType = "VIDEO" | "IMAGE" | "TEXT" | "CAROUSEL";

export class InstagramService {
  /**
   * Publish post to Instagram (main method).
   */
  async publishPost(
    postType: PostType,
    media: PostMediaWithAsset[],
    account: SocialAccount,
    caption: string,
  ): Promise<{ postId: string; postUrl: string }> {
    const igUserId = account.providerAccountId;
    const accessToken = account.accessToken;

    let postId: string;

    if (postType === "VIDEO") {
      postId = await this.publishReel(media, caption, igUserId, accessToken);
    } else if (postType === "CAROUSEL" || postType === "IMAGE") {
      postId = await this.publishPhotos(media, caption, igUserId, accessToken);
    } else {
      throw new Error(
        "Instagram supports video reels and image posts (single or carousel) only",
      );
    }

    const postUrl = await this.getMediaPermalink(postId, accessToken);

    return { postId, postUrl };
  }

  /**
   * Publish an Instagram Reel, optionally with a custom cover image.
   */
  private async publishReel(
    media: PostMediaWithAsset[],
    caption: string,
    igUserId: string,
    accessToken: string,
  ): Promise<string> {
    const videoMedia = media.find((m) => m.type === "VIDEO");
    const coverMedia = media.find((m) => m.type === "THUMBNAIL");

    if (!videoMedia) {
      throw new Error("No video found for Instagram reel");
    }

    const containerPayload: Record<string, unknown> = {
      media_type: "REELS",
      video_url: videoMedia.asset.url,
      caption,
      share_to_feed: true,
    };

    if (coverMedia?.asset?.url) {
      containerPayload.cover_url = coverMedia.asset.url;
    } else {
      // No cover provided: use the frame at 5s (thumb_offset is in ms).
      containerPayload.thumb_offset = "5000";
    }

    try {
      const creationId = await this.createProcessedContainer(
        igUserId,
        accessToken,
        containerPayload,
      );
      return await this.publishContainer(igUserId, accessToken, creationId);
    } catch (error: any) {
      this.handleInstagramError(error, "Instagram Reel upload");
    }
  }

  /**
   * Publish an image post: one image = single feed photo, multiple = carousel.
   */
  private async publishPhotos(
    media: PostMediaWithAsset[],
    caption: string,
    igUserId: string,
    accessToken: string,
  ): Promise<string> {
    const images = media
      .filter((m) => m.type === "IMAGE")
      .sort((a, b) => a.order - b.order);

    if (images.length === 0) {
      throw new Error("No images found for Instagram post");
    }

    if (images.length === 1) {
      return this.publishSingleImage(images[0], caption, igUserId, accessToken);
    }

    return this.publishCarousel(images, caption, igUserId, accessToken);
  }

  private async publishSingleImage(
    imageMedia: PostMediaWithAsset,
    caption: string,
    igUserId: string,
    accessToken: string,
  ): Promise<string> {
    try {
      const creationId = await this.createProcessedContainer(
        igUserId,
        accessToken,
        { image_url: imageMedia.asset.url, caption },
      );
      return await this.publishContainer(igUserId, accessToken, creationId);
    } catch (error: any) {
      this.handleInstagramError(error, "Instagram image upload");
    }
  }

  private async publishCarousel(
    images: PostMediaWithAsset[],
    caption: string,
    igUserId: string,
    accessToken: string,
  ): Promise<string> {
    if (images.length > MAX_CAROUSEL_IMAGES) {
      throw new Error(
        `Instagram carousels support up to ${MAX_CAROUSEL_IMAGES} images (received ${images.length}).`,
      );
    }

    try {
      // One child container per image, in order.
      const childIds: string[] = [];
      for (const image of images) {
        childIds.push(
          await this.createProcessedContainer(igUserId, accessToken, {
            image_url: image.asset.url,
            is_carousel_item: true,
          }),
        );
      }

      const parentId = await this.createProcessedContainer(
        igUserId,
        accessToken,
        { media_type: "CAROUSEL", children: childIds, caption },
      );

      return await this.publishContainer(igUserId, accessToken, parentId);
    } catch (error: any) {
      this.handleInstagramError(error, "Instagram carousel upload");
    }
  }

  // ─── Container lifecycle ───

  /**
   * Create a media container and wait until Instagram finishes processing it.
   * Returns the container (creation) id.
   */
  private async createProcessedContainer(
    igUserId: string,
    accessToken: string,
    payload: Record<string, unknown>,
  ): Promise<string> {
    const response = await axios.post(
      `${BASE_URL}/${igUserId}/media`,
      { access_token: accessToken, ...payload },
      { headers: { "Content-Type": "application/json" } },
    );

    const containerId = response.data.id;

    const isReady = await this.pollContainerStatus(containerId, accessToken);
    if (!isReady) {
      throw new Error("Instagram media processing timed out");
    }

    return containerId;
  }

  /**
   * Publish a finished container; returns the published media id.
   * Instagram can return "media not ready" (code 9007) even after the
   * container reports FINISHED, so that error is retried with backoff.
   */
  private async publishContainer(
    igUserId: string,
    accessToken: string,
    creationId: string,
    maxAttempts: number = 4,
  ): Promise<string> {
    for (let attempt = 1; ; attempt++) {
      try {
        const response = await axios.post(
          `${BASE_URL}/${igUserId}/media_publish`,
          { access_token: accessToken, creation_id: creationId },
          { headers: { "Content-Type": "application/json" } },
        );

        return response.data.id;
      } catch (error: any) {
        const igError = error.response?.data?.error;
        const mediaNotReady =
          igError?.code === 9007 ||
          igError?.error_subcode === 9007 ||
          /not ready for publishing/i.test(
            igError?.error_user_msg || igError?.message || "",
          );

        if (!mediaNotReady || attempt >= maxAttempts) {
          throw error;
        }

        // 10s, 20s, 40s
        await sleep(10_000 * 2 ** (attempt - 1));
      }
    }
  }

  /**
   * Poll a container's processing status until FINISHED (true), ERROR/EXPIRED
   * (throws), or timeout (false).
   */
  private async pollContainerStatus(
    containerId: string,
    accessToken: string,
    maxAttempts: number = 60,
    intervalMs: number = 5000,
  ): Promise<boolean> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await axios.get(`${BASE_URL}/${containerId}`, {
          params: { access_token: accessToken, fields: "status_code" },
        });

        // Status codes: EXPIRED, ERROR, FINISHED, IN_PROGRESS, PUBLISHED
        const statusCode = response.data.status_code;

        if (statusCode === "FINISHED") {
          return true;
        }

        if (statusCode === "ERROR" || statusCode === "EXPIRED") {
          throw new Error(`Media processing failed with status: ${statusCode}`);
        }

        if (attempt < maxAttempts) {
          await sleep(intervalMs);
        }
      } catch (error: any) {
        console.error("Error polling media status:", {
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

    return false;
  }

  // ─── URL resolution and error handling ───

  /**
   * Fetch the permalink for a published media item.
   * The publish endpoint only returns a numeric media ID — this call
   * resolves it to the actual https://www.instagram.com/… URL.
   */
  private async getMediaPermalink(
    mediaId: string,
    accessToken: string,
  ): Promise<string> {
    try {
      const response = await axios.get(`${BASE_URL}/${mediaId}`, {
        params: { access_token: accessToken, fields: "permalink" },
      });

      return response.data.permalink;
    } catch (error: any) {
      console.error("Failed to fetch Instagram permalink:", {
        mediaId,
        message: error.message,
        response: error.response?.data,
      });
      return `https://www.instagram.com`;
    }
  }

  /**
   * Normalize Instagram API errors into a thrown Error. Never returns.
   */
  private handleInstagramError(error: any, context: string): never {
    const igError = error.response?.data?.error;

    console.error(`${context} error:`, {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });

    // Only genuine auth failures should ask the user to reconnect. Instagram
    // labels many unrelated errors (permissions, media problems, rate limits)
    // as OAuthException, so match the specific token error codes instead:
    // 190 = invalid/expired token, 102 = session invalidated.
    if (
      error.response?.status === 401 ||
      igError?.code === 190 ||
      igError?.code === 102
    ) {
      throw new Error(
        "Instagram access token is invalid or expired. Please reconnect your account.",
      );
    }

    // Prefer Instagram's user-facing message, then its technical message.
    const detail =
      igError?.error_user_msg || igError?.message || error.message;
    const code =
      igError?.code !== undefined ? ` (code ${igError.code})` : "";
    throw new Error(`${context} failed: ${detail}${code}`);
  }
}

export const instagramService = new InstagramService();
