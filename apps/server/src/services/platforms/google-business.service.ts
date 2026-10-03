import { SocialAccount } from "@prisma/client";
import type { PostMediaWithAsset } from "../post.service";
import axios from "axios";

/**
 * Google Business Profile local posts (My Business API v4).
 * Reference: https://developers.google.com/my-business/reference/rest/v4/accounts.locations.localPosts
 *
 * providerAccountId is the location's `accounts/{a}/locations/{l}` path.
 * Posts are "What's new" updates: a summary of up to 1500 characters, at
 * most one photo (JPG/PNG, ≥400×300, ≤5 MB) fetched by Google from a public
 * URL, and an optional call-to-action button. Video isn't supported.
 */

const BASE_URL = "https://mybusiness.googleapis.com/v4";

const MAX_SUMMARY_LENGTH = 1500;

export const GOOGLE_BUSINESS_CTA_TYPES = [
  "LEARN_MORE",
  "BOOK",
  "ORDER",
  "SHOP",
  "SIGN_UP",
  "CALL",
] as const;

export type GoogleBusinessCtaType = (typeof GOOGLE_BUSINESS_CTA_TYPES)[number];

/** Keys must match what the composer and the public API store per leg. */
export interface GoogleBusinessPostSettings {
  ctaType?: GoogleBusinessCtaType;
  /** Required for every button except CALL, which dials the profile's phone. */
  ctaUrl?: string;
}

type PostType = "VIDEO" | "IMAGE" | "TEXT" | "CAROUSEL";

export class GoogleBusinessService {
  async publishPost(
    postType: PostType,
    media: PostMediaWithAsset[],
    account: SocialAccount,
    caption: string,
    settings: Record<string, unknown> | null,
  ): Promise<{ postId: string; postUrl: string }> {
    if (postType === "VIDEO" || postType === "CAROUSEL") {
      throw new Error(
        "Google Business Profile posts take text or a single photo.",
      );
    }

    try {
      const body: Record<string, unknown> = {
        summary: this.formatSummary(caption),
        topicType: "STANDARD",
      };

      if (postType === "IMAGE") {
        const image = media.find((m) => m.type === "IMAGE");
        if (!image) throw new Error("No image found for Google Business post");
        body.media = [{ mediaFormat: "PHOTO", sourceUrl: image.asset.url }];
      }

      const callToAction = this.callToAction(settings);
      if (callToAction) body.callToAction = callToAction;

      const response = await axios.post(
        `${BASE_URL}/${account.providerAccountId}/localPosts`,
        body,
        {
          headers: {
            Authorization: `Bearer ${account.accessToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      const post = response.data ?? {};
      if (post.state === "REJECTED") {
        throw new Error(
          "Google rejected this post. Check it against Google's content policy for Business Profile posts.",
        );
      }
      if (!post.name) {
        throw new Error("Google did not return a post id");
      }

      return {
        postId: post.name as string,
        // searchUrl opens the post on Google Search; it can be missing while
        // the post is still PROCESSING.
        postUrl:
          (post.searchUrl as string | undefined) ||
          "https://business.google.com/posts",
      };
    } catch (error: any) {
      this.handleGoogleError(error, `Google Business ${postType.toLowerCase()} post`);
    }
  }

  // ─── Helpers ───

  private callToAction(
    settings: Record<string, unknown> | null,
  ): { actionType: GoogleBusinessCtaType; url?: string } | null {
    const ctaType = settings?.ctaType as GoogleBusinessCtaType | undefined;
    if (!ctaType || !GOOGLE_BUSINESS_CTA_TYPES.includes(ctaType)) return null;

    if (ctaType === "CALL") return { actionType: "CALL" };

    const url = typeof settings?.ctaUrl === "string" ? settings.ctaUrl.trim() : "";
    if (!/^https?:\/\//i.test(url)) {
      throw new Error(
        "The Google Business button needs a link that starts with https://",
      );
    }
    return { actionType: ctaType, url };
  }

  private formatSummary(text: string): string {
    return text.length <= MAX_SUMMARY_LENGTH
      ? text
      : text.substring(0, MAX_SUMMARY_LENGTH - 1) + "…";
  }

  /** Normalize Google API errors into a thrown Error. Never returns. */
  private handleGoogleError(error: any, context: string): never {
    const apiError = error.response?.data?.error;

    console.error(`${context} error:`, {
      message: error.message,
      response: apiError ?? error.response?.data,
      status: error.response?.status,
    });

    if (error.response?.status === 401) {
      throw new Error(
        "Google Business access token is invalid or expired. Please reconnect your account.",
      );
    }

    if (!error.response && error instanceof Error) {
      throw error;
    }

    if (apiError?.status === "PERMISSION_DENIED") {
      throw new Error(
        `${context} failed: Unsora can't post to this location. Make sure you're still an owner or manager, then reconnect your account.`,
      );
    }

    throw new Error(`${context} failed: ${apiError?.message || error.message}`);
  }
}

export const googleBusinessService = new GoogleBusinessService();
