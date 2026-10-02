import { SocialAccount } from "@prisma/client";
import type { PostMediaWithAsset } from "../post.service";
import axios from "axios";
import { getPinterestBoards } from "../../oauth/pinterest";

/**
 * Pinterest API Service (v5)
 * Reference: https://developers.pinterest.com/docs/api/v5/pins-create/
 *
 * Every pin targets a board. The board id comes from the post's per-account
 * settings ({ boardId }); if none was chosen, the account's first board is
 * used so publishing never dead-ends.
 *
 * Videos use the register-upload flow: POST /media → upload file to the
 * returned AWS url → poll processing → create the pin with the media id.
 */

const BASE_URL = "https://api.pinterest.com/v5";

/** Pinterest limits: title 100 chars, description 800 chars. */
const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 800;

/** Pinterest carousels support 2–5 images. */
const MAX_CAROUSEL_IMAGES = 5;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Per-account publish settings (PostAccount.settings for pinterest). */
export interface PinterestPostSettings {
  boardId?: string;
  title?: string;
  link?: string;
}

type PostType = "VIDEO" | "IMAGE" | "TEXT" | "CAROUSEL";

export class PinterestService {
  async publishPost(
    postType: PostType,
    media: PostMediaWithAsset[],
    account: SocialAccount,
    caption: string,
    settings?: Record<string, unknown> | null,
  ): Promise<{ postId: string; postUrl: string }> {
    const options = (settings ?? {}) as PinterestPostSettings;

    try {
      const boardId = await this.resolveBoardId(account, options);

      const basePin: Record<string, unknown> = {
        board_id: boardId,
        title: this.truncate(
          options.title || caption.substring(0, MAX_TITLE_LENGTH) || "Untitled",
          MAX_TITLE_LENGTH,
        ),
        description: this.truncate(caption, MAX_DESCRIPTION_LENGTH),
        ...(options.link ? { link: options.link } : {}),
      };

      let mediaSource: Record<string, unknown>;

      if (postType === "VIDEO") {
        mediaSource = await this.buildVideoSource(account.accessToken, media);
      } else if (postType === "IMAGE" || postType === "CAROUSEL") {
        mediaSource = this.buildImageSource(media);
      } else {
        throw new Error(
          "Pinterest requires an image or video — text-only posts cannot be published",
        );
      }

      const response = await axios.post(
        `${BASE_URL}/pins`,
        { ...basePin, media_source: mediaSource },
        { headers: { Authorization: `Bearer ${account.accessToken}` } },
      );

      const pinId = response.data.id as string;

      return {
        postId: pinId,
        postUrl: `https://www.pinterest.com/pin/${pinId}/`,
      };
    } catch (error: any) {
      this.handlePinterestError(error, `Pinterest ${postType.toLowerCase()} pin`);
    }
  }

  // ─── Board resolution ───

  private async resolveBoardId(
    account: SocialAccount,
    options: PinterestPostSettings,
  ): Promise<string> {
    if (options.boardId) {
      return options.boardId;
    }

    const boards = await getPinterestBoards(account.accessToken);
    if (boards.length === 0) {
      throw new Error(
        "No Pinterest board found. Create a board on Pinterest first (or pick one in the post settings).",
      );
    }
    return boards[0].id;
  }

  // ─── Media sources ───

  private buildImageSource(
    media: PostMediaWithAsset[],
  ): Record<string, unknown> {
    const images = media
      .filter((m) => m.type === "IMAGE")
      .sort((a, b) => a.order - b.order);

    if (images.length === 0) {
      throw new Error("No images found for Pinterest pin");
    }

    if (images.length === 1) {
      return {
        source_type: "image_url",
        url: images[0].asset.url,
      };
    }

    if (images.length > MAX_CAROUSEL_IMAGES) {
      throw new Error(
        `Pinterest carousels support up to ${MAX_CAROUSEL_IMAGES} images (received ${images.length}).`,
      );
    }

    return {
      source_type: "multiple_image_urls",
      items: images.map((image) => ({ url: image.asset.url })),
    };
  }

  /** Register + upload + process a video, returning the pin media_source. */
  private async buildVideoSource(
    accessToken: string,
    media: PostMediaWithAsset[],
  ): Promise<Record<string, unknown>> {
    const videoMedia = media.find((m) => m.type === "VIDEO");
    if (!videoMedia) {
      throw new Error("No video found for Pinterest pin");
    }
    const coverMedia = media.find((m) => m.type === "THUMBNAIL");

    // 1. Register the upload.
    const registration = await axios.post(
      `${BASE_URL}/media`,
      { media_type: "video" },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    const { media_id, upload_url, upload_parameters } = registration.data;

    // 2. Upload the video bytes (multipart form with Pinterest's parameters).
    const download = await axios.get<ArrayBuffer>(videoMedia.asset.url, {
      responseType: "arraybuffer",
      timeout: 10 * 60 * 1000,
    });

    const form = new FormData();
    for (const [key, value] of Object.entries(upload_parameters ?? {})) {
      form.append(key, String(value));
    }
    form.append(
      "file",
      new Blob([new Uint8Array(download.data)], {
        type: videoMedia.asset.mimeType || "video/mp4",
      }),
    );

    await axios.post(upload_url, form, {
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 30 * 60 * 1000,
    });

    // 3. Wait for processing.
    await this.waitForMediaProcessing(accessToken, media_id);

    return {
      source_type: "video_id",
      media_id,
      ...(coverMedia?.asset?.url
        ? { cover_image_url: coverMedia.asset.url }
        : { cover_image_key_frame_time: 1000 }),
    };
  }

  private async waitForMediaProcessing(
    accessToken: string,
    mediaId: string,
    maxAttempts: number = 60,
    intervalMs: number = 5000,
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const response = await axios.get(`${BASE_URL}/media/${mediaId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const status = response.data.status;

      if (status === "succeeded") {
        return;
      }

      if (status === "failed") {
        throw new Error("Pinterest video processing failed");
      }

      if (attempt < maxAttempts) {
        await sleep(intervalMs);
      }
    }

    throw new Error("Pinterest video processing timed out");
  }

  // ─── Helpers ───

  private truncate(text: string, max: number): string {
    return text.length <= max ? text : text.substring(0, max - 1) + "…";
  }

  /** Normalize Pinterest API errors into a thrown Error. Never returns. */
  private handlePinterestError(error: any, context: string): never {
    const apiError = error.response?.data;

    console.error(`${context} error:`, {
      message: error.message,
      response: apiError,
      status: error.response?.status,
    });

    if (error.response?.status === 401) {
      throw new Error(
        "Pinterest access token is invalid or expired. Please reconnect your account.",
      );
    }

    if (!error.response && error instanceof Error) {
      throw error;
    }

    const detail = apiError?.message || error.message;
    const code =
      apiError?.code !== undefined ? ` (code ${apiError.code})` : "";
    throw new Error(`${context} failed: ${detail}${code}`);
  }
}

export const pinterestService = new PinterestService();
