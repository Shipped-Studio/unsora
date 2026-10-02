import { SocialAccount } from "@prisma/client";
import type { PostMediaWithAsset } from "../post.service";
import axios from "axios";

/**
 * Facebook API Service
 * Reference: https://developers.facebook.com/docs/graph-api/reference/page/
 *
 * All publishing targets a Page (providerAccountId) using its page access
 * token. Requires the pages_manage_posts permission.
 */

type PostType = "VIDEO" | "IMAGE" | "TEXT" | "CAROUSEL";

export class FacebookService {
  private baseUrl = "https://graph.facebook.com/v24.0";

  /**
   * Publish post to Facebook Page (main method)
   */
  async publishPost(
    postType: PostType,
    media: PostMediaWithAsset[],
    account: SocialAccount,
    caption: string
  ): Promise<{ postId: string; postUrl: string }> {
    const pageId = account.providerAccountId;
    const accessToken = account.accessToken;

    try {
      switch (postType) {
        case "VIDEO":
          return await this.publishVideo(pageId, accessToken, media, caption);
        case "IMAGE":
        case "CAROUSEL":
          return await this.publishPhotos(pageId, accessToken, media, caption);
        case "TEXT":
          return await this.publishText(pageId, accessToken, caption);
        default:
          throw new Error(`Unsupported post type for Facebook: ${postType}`);
      }
    } catch (error: any) {
      this.handleFacebookError(error, `Facebook ${postType.toLowerCase()} post`);
    }
  }

  /** Upload a video to the Page via file_url (Facebook fetches it itself). */
  private async publishVideo(
    pageId: string,
    accessToken: string,
    media: PostMediaWithAsset[],
    caption: string,
  ): Promise<{ postId: string; postUrl: string }> {
    const videoMedia = media.find((m) => m.type === "VIDEO");
    if (!videoMedia) {
      throw new Error("No video found for Facebook video post");
    }

    const response = await axios.post(`${this.baseUrl}/${pageId}/videos`, null, {
      params: {
        access_token: accessToken,
        file_url: videoMedia.asset.url,
        description: caption,
      },
    });

    const videoId = response.data.id;

    return {
      postId: videoId,
      postUrl: `https://www.facebook.com/${pageId}/videos/${videoId}`,
    };
  }

  /** One image = single photo post; multiple = multi-photo feed post. */
  private async publishPhotos(
    pageId: string,
    accessToken: string,
    media: PostMediaWithAsset[],
    caption: string,
  ): Promise<{ postId: string; postUrl: string }> {
    const images = media
      .filter((m) => m.type === "IMAGE")
      .sort((a, b) => a.order - b.order);

    if (images.length === 0) {
      throw new Error("No images found for Facebook post");
    }

    if (images.length === 1) {
      const response = await axios.post(
        `${this.baseUrl}/${pageId}/photos`,
        null,
        {
          params: {
            access_token: accessToken,
            url: images[0].asset.url,
            caption,
          },
        },
      );

      // photos returns { id: photoId, post_id: pageId_postId }
      const postId = response.data.post_id || response.data.id;
      return { postId, postUrl: `https://www.facebook.com/${postId}` };
    }

    // Carousel: upload each photo unpublished, then attach them to one
    // feed post.
    const photoIds: string[] = [];
    for (const image of images) {
      const response = await axios.post(
        `${this.baseUrl}/${pageId}/photos`,
        null,
        {
          params: {
            access_token: accessToken,
            url: image.asset.url,
            published: false,
          },
        },
      );
      photoIds.push(response.data.id);
    }

    const params: Record<string, string> = {
      access_token: accessToken,
      message: caption,
    };
    photoIds.forEach((id, index) => {
      params[`attached_media[${index}]`] = JSON.stringify({ media_fbid: id });
    });

    const response = await axios.post(`${this.baseUrl}/${pageId}/feed`, null, {
      params,
    });

    const postId = response.data.id;
    return { postId, postUrl: `https://www.facebook.com/${postId}` };
  }

  private async publishText(
    pageId: string,
    accessToken: string,
    caption: string,
  ): Promise<{ postId: string; postUrl: string }> {
    if (!caption.trim()) {
      throw new Error("Facebook text posts need a caption");
    }

    const response = await axios.post(`${this.baseUrl}/${pageId}/feed`, null, {
      params: { access_token: accessToken, message: caption },
    });

    const postId = response.data.id;
    return { postId, postUrl: `https://www.facebook.com/${postId}` };
  }

  /** Normalize Facebook API errors into a thrown Error. Never returns. */
  private handleFacebookError(error: any, context: string): never {
    const fbError = error.response?.data?.error;

    console.error(`${context} error:`, {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });

    // 190 = invalid/expired token, 102 = session invalidated.
    if (
      error.response?.status === 401 ||
      fbError?.code === 190 ||
      fbError?.code === 102
    ) {
      throw new Error(
        "Facebook access token is invalid or expired. Please reconnect your account."
      );
    }

    // Errors we threw ourselves (no HTTP response attached) pass through.
    if (!error.response && error instanceof Error) {
      throw error;
    }

    const detail = fbError?.error_user_msg || fbError?.message || error.message;
    const code = fbError?.code !== undefined ? ` (code ${fbError.code})` : "";
    throw new Error(`${context} failed: ${detail}${code}`);
  }
}

export const facebookService = new FacebookService();
