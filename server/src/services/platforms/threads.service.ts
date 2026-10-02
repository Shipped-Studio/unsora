import { SocialAccount } from "@prisma/client";
import type { PostMediaWithAsset } from "../post.service";
import axios from "axios";

/**
 * Threads API Service
 * Reference: https://developers.facebook.com/docs/threads/posts
 *
 * Same container-then-publish model as Instagram, but on graph.threads.net
 * with Threads user tokens. Media is fetched by Threads from public URLs.
 */

const BASE_URL = "https://graph.threads.net/v1.0";

/** Threads text limit (graphemes; simple length check is close enough). */
const MAX_TEXT_LENGTH = 500;

/** Threads carousels allow 2–20 items. */
const MAX_CAROUSEL_ITEMS = 20;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type PostType = "VIDEO" | "IMAGE" | "TEXT" | "CAROUSEL";

export class ThreadsService {
  async publishPost(
    postType: PostType,
    media: PostMediaWithAsset[],
    account: SocialAccount,
    caption: string,
  ): Promise<{ postId: string; postUrl: string }> {
    const threadsUserId = account.providerAccountId;
    const accessToken = account.accessToken;
    const text = this.truncate(caption, MAX_TEXT_LENGTH);

    try {
      let containerId: string;

      if (postType === "TEXT") {
        containerId = await this.createContainer(threadsUserId, accessToken, {
          media_type: "TEXT",
          text,
        });
      } else if (postType === "VIDEO") {
        const videoMedia = media.find((m) => m.type === "VIDEO");
        if (!videoMedia) {
          throw new Error("No video found for Threads post");
        }
        containerId = await this.createContainer(threadsUserId, accessToken, {
          media_type: "VIDEO",
          video_url: videoMedia.asset.url,
          text,
        });
      } else {
        const images = media
          .filter((m) => m.type === "IMAGE")
          .sort((a, b) => a.order - b.order);

        if (images.length === 0) {
          throw new Error("No images found for Threads post");
        }

        if (images.length === 1) {
          containerId = await this.createContainer(threadsUserId, accessToken, {
            media_type: "IMAGE",
            image_url: images[0].asset.url,
            text,
          });
        } else {
          containerId = await this.createCarousel(
            threadsUserId,
            accessToken,
            images,
            text,
          );
        }
      }

      // Media containers process asynchronously; Threads rejects premature
      // publishes, so wait for FINISHED.
      await this.waitForContainer(containerId, accessToken);

      const publishResponse = await axios.post(
        `${BASE_URL}/${threadsUserId}/threads_publish`,
        null,
        { params: { creation_id: containerId, access_token: accessToken } },
      );

      const mediaId = publishResponse.data.id as string;
      const postUrl = await this.getPermalink(mediaId, accessToken, account);

      return { postId: mediaId, postUrl };
    } catch (error: any) {
      this.handleThreadsError(error, `Threads ${postType.toLowerCase()} post`);
    }
  }

  // ─── Containers ───

  private async createContainer(
    threadsUserId: string,
    accessToken: string,
    params: Record<string, string>,
  ): Promise<string> {
    const response = await axios.post(
      `${BASE_URL}/${threadsUserId}/threads`,
      null,
      { params: { ...params, access_token: accessToken } },
    );
    return response.data.id;
  }

  private async createCarousel(
    threadsUserId: string,
    accessToken: string,
    images: PostMediaWithAsset[],
    text: string,
  ): Promise<string> {
    if (images.length > MAX_CAROUSEL_ITEMS) {
      throw new Error(
        `Threads carousels support up to ${MAX_CAROUSEL_ITEMS} items (received ${images.length}).`,
      );
    }

    const childIds: string[] = [];
    for (const image of images) {
      const childId = await this.createContainer(threadsUserId, accessToken, {
        media_type: "IMAGE",
        image_url: image.asset.url,
        is_carousel_item: "true",
      });
      await this.waitForContainer(childId, accessToken);
      childIds.push(childId);
    }

    return this.createContainer(threadsUserId, accessToken, {
      media_type: "CAROUSEL",
      children: childIds.join(","),
      text,
    });
  }

  /**
   * Poll container status until FINISHED. Text containers usually finish
   * immediately; videos can take a while.
   */
  private async waitForContainer(
    containerId: string,
    accessToken: string,
    maxAttempts: number = 60,
    intervalMs: number = 5000,
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const response = await axios.get(`${BASE_URL}/${containerId}`, {
        params: { fields: "status,error_message", access_token: accessToken },
      });

      const status = response.data.status;

      // Older/text containers may omit status entirely — treat as ready.
      if (!status || status === "FINISHED" || status === "PUBLISHED") {
        return;
      }

      if (status === "ERROR" || status === "EXPIRED") {
        throw new Error(
          `Threads media processing failed: ${
            response.data.error_message || status
          }`,
        );
      }

      if (attempt < maxAttempts) {
        await sleep(intervalMs);
      }
    }

    throw new Error("Threads media processing timed out");
  }

  // ─── Permalink ───

  private async getPermalink(
    mediaId: string,
    accessToken: string,
    account: SocialAccount,
  ): Promise<string> {
    try {
      const response = await axios.get(`${BASE_URL}/${mediaId}`, {
        params: { fields: "permalink", access_token: accessToken },
      });
      if (response.data.permalink) {
        return response.data.permalink;
      }
    } catch (error: any) {
      console.error("Failed to fetch Threads permalink:", {
        mediaId,
        message: error.message,
        response: error.response?.data,
      });
    }

    return account.accountUsername
      ? `https://www.threads.net/@${account.accountUsername}`
      : "https://www.threads.net";
  }

  // ─── Helpers ───

  private truncate(text: string, max: number): string {
    return text.length <= max ? text : text.substring(0, max - 1) + "…";
  }

  /** Normalize Threads API errors into a thrown Error. Never returns. */
  private handleThreadsError(error: any, context: string): never {
    const apiError = error.response?.data?.error;

    console.error(`${context} error:`, {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });

    if (
      error.response?.status === 401 ||
      apiError?.code === 190 ||
      apiError?.code === 102
    ) {
      throw new Error(
        "Threads access token is invalid or expired. Please reconnect your account.",
      );
    }

    if (!error.response && error instanceof Error) {
      throw error;
    }

    const detail = apiError?.error_user_msg || apiError?.message || error.message;
    const code = apiError?.code !== undefined ? ` (code ${apiError.code})` : "";
    throw new Error(`${context} failed: ${detail}${code}`);
  }
}

export const threadsService = new ThreadsService();
