import { SocialAccount } from "@prisma/client";
import { Agent, RichText } from "@atproto/api";
import axios from "axios";
import { getBlueskyAgent } from "../../oauth/bluesky";
import type { PostMediaWithAsset } from "../post.service";

/**
 * Bluesky (AT Protocol) publishing service.
 *
 * Posts are records in the user's repo created via the authenticated agent
 * (com.atproto.repo.createRecord under the hood). Media is uploaded as blobs
 * to the user's PDS first, then referenced from the post's embed.
 */

type PostType = "VIDEO" | "IMAGE" | "TEXT" | "CAROUSEL";

/** Bluesky post text limit, counted in graphemes. */
const MAX_GRAPHEMES = 300;

/** Bluesky embeds allow at most 4 images. */
const MAX_IMAGES = 4;

/** PDS blob upload cap for video (bsky.social allows up to 100MB). */
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export class BlueskyService {
  async publishPost(
    postType: PostType,
    media: PostMediaWithAsset[],
    account: SocialAccount,
    caption: string,
  ): Promise<{ postId: string; postUrl: string }> {
    const agent = await getBlueskyAgent(account.providerAccountId);

    // Embed unions in the SDK are lexicon-generated $Typed objects; we build
    // them dynamically, so keep the local type loose.
    let embed: any;

    if (postType === "VIDEO") {
      embed = await this.buildVideoEmbed(agent, media);
    } else if (postType === "IMAGE" || postType === "CAROUSEL") {
      embed = await this.buildImagesEmbed(agent, media);
    }
    // TEXT posts have no embed.

    const richText = new RichText({ text: this.truncateGraphemes(caption) });
    await richText.detectFacets(agent);

    const response = await agent.post({
      text: richText.text,
      facets: richText.facets,
      ...(embed ? { embed } : {}),
      createdAt: new Date().toISOString(),
    });

    // response.uri is an AT URI: at://did:plc:xxx/app.bsky.feed.post/<rkey>
    const rkey = response.uri.split("/").pop() as string;
    const actor = account.accountUsername || account.providerAccountId;

    return {
      postId: response.uri,
      postUrl: `https://bsky.app/profile/${actor}/post/${rkey}`,
    };
  }

  // ─── Embeds ───

  private async buildImagesEmbed(
    agent: Agent,
    media: PostMediaWithAsset[],
  ): Promise<Record<string, unknown>> {
    const images = media
      .filter((m) => m.type === "IMAGE")
      .sort((a, b) => a.order - b.order);

    if (images.length === 0) {
      throw new Error("No images found for Bluesky post");
    }

    if (images.length > MAX_IMAGES) {
      throw new Error(
        `Bluesky supports up to ${MAX_IMAGES} images per post (received ${images.length}).`,
      );
    }

    const uploaded: Record<string, unknown>[] = [];
    for (const image of images) {
      const blob = await this.uploadBlob(
        agent,
        image.asset.url,
        image.asset.mimeType || "image/jpeg",
      );
      uploaded.push({
        image: blob,
        alt: image.asset.name || "",
        ...(image.asset.width && image.asset.height
          ? {
              aspectRatio: {
                width: image.asset.width,
                height: image.asset.height,
              },
            }
          : {}),
      });
    }

    return { $type: "app.bsky.embed.images", images: uploaded };
  }

  private async buildVideoEmbed(
    agent: Agent,
    media: PostMediaWithAsset[],
  ): Promise<Record<string, unknown>> {
    const videoMedia = media.find((m) => m.type === "VIDEO");
    if (!videoMedia) {
      throw new Error("No video found for Bluesky post");
    }

    const fileSize = videoMedia.asset.fileSize
      ? Number(videoMedia.asset.fileSize)
      : null;
    if (fileSize && fileSize > MAX_VIDEO_BYTES) {
      throw new Error(
        `Bluesky videos are limited to ${MAX_VIDEO_BYTES / (1024 * 1024)}MB (video is ${Math.ceil(fileSize / (1024 * 1024))}MB).`,
      );
    }

    const blob = await this.uploadBlob(
      agent,
      videoMedia.asset.url,
      videoMedia.asset.mimeType || "video/mp4",
    );

    return {
      $type: "app.bsky.embed.video",
      video: blob,
      ...(videoMedia.asset.width && videoMedia.asset.height
        ? {
            aspectRatio: {
              width: videoMedia.asset.width,
              height: videoMedia.asset.height,
            },
          }
        : {}),
    };
  }

  /** Download a media asset and upload it to the user's PDS as a blob. */
  private async uploadBlob(agent: Agent, url: string, mimeType: string) {
    const download = await axios.get<ArrayBuffer>(url, {
      responseType: "arraybuffer",
      maxContentLength: MAX_VIDEO_BYTES,
    });

    const bytes = new Uint8Array(download.data);

    try {
      const response = await agent.uploadBlob(bytes, { encoding: mimeType });
      return response.data.blob;
    } catch (error: any) {
      const message = error?.message || "unknown error";
      if (error?.status === 401 || /token|auth/i.test(message)) {
        throw new Error(
          "Bluesky session is invalid or was revoked. Please reconnect your account.",
        );
      }
      throw new Error(`Bluesky media upload failed: ${message}`);
    }
  }

  // ─── Text handling ───

  /** Trim to Bluesky's 300-grapheme limit, appending an ellipsis if cut. */
  private truncateGraphemes(text: string): string {
    const segmenter = new Intl.Segmenter();
    const graphemes = [...segmenter.segment(text)];
    if (graphemes.length <= MAX_GRAPHEMES) {
      return text;
    }
    return (
      graphemes
        .slice(0, MAX_GRAPHEMES - 1)
        .map((s) => s.segment)
        .join("")
        .trimEnd() + "…"
    );
  }
}

export const blueskyService = new BlueskyService();
