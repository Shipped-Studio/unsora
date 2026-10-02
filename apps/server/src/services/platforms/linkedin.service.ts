import { SocialAccount } from "@prisma/client";
import type { PostMediaWithAsset } from "../post.service";
import axios from "axios";

/**
 * LinkedIn Posts API (versioned REST).
 * Reference: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
 *
 * Posts are created as the connected member (urn:li:person:{id}, where the
 * id is the OpenID `sub` stored as providerAccountId).
 *
 * Images use initializeUpload → PUT binary. Videos use initializeUpload →
 * PUT each byte range → finalizeUpload with the returned ETags → poll until
 * the video is AVAILABLE.
 */

const BASE_URL = "https://api.linkedin.com/rest";
// LinkedIn API versions (YYYYMM) sunset 12 months after release — bump this
// about twice a year or requests start failing with "version is not active".
const LINKEDIN_VERSION = "202601";

/** LinkedIn commentary limit is 3000 chars. */
const MAX_COMMENTARY_LENGTH = 3000;

/** LinkedIn multi-image posts support 2–20 images. */
const MAX_CAROUSEL_IMAGES = 20;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type PostType = "VIDEO" | "IMAGE" | "TEXT" | "CAROUSEL";

export class LinkedInService {
  async publishPost(
    postType: PostType,
    media: PostMediaWithAsset[],
    account: SocialAccount,
    caption: string,
  ): Promise<{ postId: string; postUrl: string }> {
    const author = `urn:li:person:${account.providerAccountId}`;

    try {
      let content: Record<string, unknown> | undefined;

      if (postType === "VIDEO") {
        const videoUrn = await this.uploadVideo(
          account.accessToken,
          author,
          media,
        );
        content = { media: { id: videoUrn } };
      } else if (postType === "IMAGE" || postType === "CAROUSEL") {
        content = await this.buildImageContent(
          account.accessToken,
          author,
          media,
        );
      }
      // TEXT → commentary-only post, no content block.

      const response = await axios.post(
        `${BASE_URL}/posts`,
        {
          author,
          commentary: this.formatCommentary(caption),
          visibility: "PUBLIC",
          distribution: {
            feedDistribution: "MAIN_FEED",
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          ...(content ? { content } : {}),
          lifecycleState: "PUBLISHED",
          isReshareDisabledByAuthor: false,
        },
        { headers: this.headers(account.accessToken) },
      );

      const postUrn =
        (response.headers["x-restli-id"] as string) ||
        (response.headers["x-linkedin-id"] as string);

      if (!postUrn) {
        throw new Error("LinkedIn did not return a post id");
      }

      return {
        postId: postUrn,
        postUrl: `https://www.linkedin.com/feed/update/${postUrn}/`,
      };
    } catch (error: any) {
      this.handleLinkedInError(
        error,
        `LinkedIn ${postType.toLowerCase()} post`,
      );
    }
  }

  // ─── Images ───

  private async buildImageContent(
    accessToken: string,
    author: string,
    media: PostMediaWithAsset[],
  ): Promise<Record<string, unknown>> {
    const images = media
      .filter((m) => m.type === "IMAGE")
      .sort((a, b) => a.order - b.order);

    if (images.length === 0) {
      throw new Error("No images found for LinkedIn post");
    }

    if (images.length > MAX_CAROUSEL_IMAGES) {
      throw new Error(
        `LinkedIn multi-image posts support up to ${MAX_CAROUSEL_IMAGES} images (received ${images.length}).`,
      );
    }

    const imageUrns: string[] = [];
    for (const image of images) {
      imageUrns.push(
        await this.uploadImage(accessToken, author, image.asset.url),
      );
    }

    if (imageUrns.length === 1) {
      return { media: { id: imageUrns[0] } };
    }

    return {
      multiImage: { images: imageUrns.map((id) => ({ id })) },
    };
  }

  /** Register + upload one image, returning its urn:li:image id. */
  private async uploadImage(
    accessToken: string,
    author: string,
    imageUrl: string,
  ): Promise<string> {
    const registration = await axios.post(
      `${BASE_URL}/images?action=initializeUpload`,
      { initializeUploadRequest: { owner: author } },
      { headers: this.headers(accessToken) },
    );

    const { uploadUrl, image } = registration.data.value;

    const download = await axios.get<ArrayBuffer>(imageUrl, {
      responseType: "arraybuffer",
      timeout: 5 * 60 * 1000,
    });

    await axios.put(uploadUrl, Buffer.from(download.data), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/octet-stream",
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 10 * 60 * 1000,
    });

    return image as string;
  }

  // ─── Video ───

  /** Register + upload + finalize a video, returning its urn:li:video id. */
  private async uploadVideo(
    accessToken: string,
    author: string,
    media: PostMediaWithAsset[],
  ): Promise<string> {
    const videoMedia = media.find((m) => m.type === "VIDEO");
    if (!videoMedia) {
      throw new Error("No video found for LinkedIn post");
    }

    const download = await axios.get<ArrayBuffer>(videoMedia.asset.url, {
      responseType: "arraybuffer",
      timeout: 10 * 60 * 1000,
    });
    const buffer = Buffer.from(download.data);

    // 1. Register the upload.
    const registration = await axios.post(
      `${BASE_URL}/videos?action=initializeUpload`,
      {
        initializeUploadRequest: {
          owner: author,
          fileSizeBytes: buffer.length,
          uploadCaptions: false,
          uploadThumbnail: false,
        },
      },
      { headers: this.headers(accessToken) },
    );

    const { video, uploadInstructions, uploadToken } = registration.data.value;

    // 2. Upload each byte range; LinkedIn wants the returned ETags back.
    const uploadedPartIds: string[] = [];
    for (const instruction of uploadInstructions) {
      const { uploadUrl, firstByte, lastByte } = instruction;
      const part = buffer.subarray(firstByte, lastByte + 1);

      const uploadResponse = await axios.put(uploadUrl, part, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/octet-stream",
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 30 * 60 * 1000,
      });

      const etag = uploadResponse.headers["etag"] as string | undefined;
      if (!etag) {
        throw new Error("LinkedIn video part upload returned no ETag");
      }
      uploadedPartIds.push(etag);
    }

    // 3. Finalize.
    await axios.post(
      `${BASE_URL}/videos?action=finalizeUpload`,
      {
        finalizeUploadRequest: {
          video,
          uploadToken: uploadToken ?? "",
          uploadedPartIds,
        },
      },
      { headers: this.headers(accessToken) },
    );

    // 4. Wait for processing.
    await this.waitForVideoProcessing(accessToken, video);

    return video as string;
  }

  private async waitForVideoProcessing(
    accessToken: string,
    videoUrn: string,
    maxAttempts: number = 60,
    intervalMs: number = 5000,
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const response = await axios.get(
        `${BASE_URL}/videos/${encodeURIComponent(videoUrn)}`,
        { headers: this.headers(accessToken) },
      );

      const status = response.data.status;

      if (status === "AVAILABLE") {
        return;
      }

      if (status === "PROCESSING_FAILED") {
        throw new Error("LinkedIn video processing failed");
      }

      if (attempt < maxAttempts) {
        await sleep(intervalMs);
      }
    }

    throw new Error("LinkedIn video processing timed out");
  }

  // ─── Helpers ───

  private headers(accessToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      "LinkedIn-Version": LINKEDIN_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
    };
  }

  /**
   * LinkedIn commentary uses "little text format" where these characters are
   * reserved and must be backslash-escaped to render literally:
   * \ | { } @ [ ] ( ) < > # * _ ~
   */
  private formatCommentary(text: string): string {
    const truncated =
      text.length <= MAX_COMMENTARY_LENGTH
        ? text
        : text.substring(0, MAX_COMMENTARY_LENGTH - 1) + "…";
    return truncated.replace(/([\\|{}@\[\]()<>#*_~])/g, "\\$1");
  }

  /** Normalize LinkedIn API errors into a thrown Error. Never returns. */
  private handleLinkedInError(error: any, context: string): never {
    const apiError = error.response?.data;

    console.error(`${context} error:`, {
      message: error.message,
      response: apiError,
      status: error.response?.status,
    });

    if (error.response?.status === 401) {
      throw new Error(
        "LinkedIn access token is invalid or expired. Please reconnect your account.",
      );
    }

    if (!error.response && error instanceof Error) {
      throw error;
    }

    const detail = apiError?.message || error.message;
    const code =
      apiError?.serviceErrorCode !== undefined
        ? ` (code ${apiError.serviceErrorCode})`
        : "";
    throw new Error(`${context} failed: ${detail}${code}`);
  }
}

export const linkedInService = new LinkedInService();
