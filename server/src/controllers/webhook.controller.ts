import { Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "../lib/db";
import { tiktokService } from "../services/platforms/tiktok.service";

export class WebhookController {
  // ─── Facebook Webhook ───────────────────────────────────────────────

  /**
   * GET /webhooks/facebook
   * Facebook verification challenge (required when subscribing)
   */
  async facebookVerify(req: Request, res: Response) {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === process.env.FB_WEBHOOK_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
  }

  /**
   * POST /webhooks/facebook
   * Receives Facebook page events (feed, messages, etc.)
   */
  async facebookEvent(req: Request, res: Response) {
    const signature = req.headers["x-hub-signature-256"] as string;

    if (!WebhookController.verifyMetaSignature(req, signature, process.env.FB_APP_SECRET!)) {
      console.error("Facebook webhook signature verification failed");
      return res.sendStatus(403);
    }

    const body = req.body;

    try {
      if (body.object === "page") {
        for (const entry of body.entry || []) {
          const pageId = entry.id;

          for (const change of entry.changes || []) {
            await WebhookController.handleFacebookChange(pageId, change);
          }
        }
      }
    } catch (error) {
      console.error("Error processing Facebook webhook:", error);
    }

    return res.sendStatus(200);
  }

  // ─── Instagram Webhook ──────────────────────────────────────────────

  /**
   * GET /webhooks/instagram
   * Instagram verification challenge
   */
  async instagramVerify(req: Request, res: Response) {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === process.env.IG_WEBHOOK_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
  }

  /**
   * POST /webhooks/instagram
   * Receives Instagram events (comments, mentions, story_insights, etc.)
   */
  async instagramEvent(req: Request, res: Response) {
    const signature = req.headers["x-hub-signature-256"] as string;

    if (!WebhookController.verifyMetaSignature(req, signature, process.env.IG_APP_SECRET!)) {
      console.error("Instagram webhook signature verification failed");
      return res.sendStatus(403);
    }

    const body = req.body;

    try {
      if (body.object === "instagram") {
        for (const entry of body.entry || []) {
          const igUserId = entry.id;

          for (const change of entry.changes || []) {
            await WebhookController.handleInstagramChange(igUserId, change);
          }
        }
      }
    } catch (error) {
      console.error("Error processing Instagram webhook:", error);
    }

    return res.sendStatus(200);
  }

  // ─── YouTube Webhook (PubSubHubbub / WebSub) ───────────────────────

  /**
   * GET /webhooks/youtube
   * YouTube PubSubHubbub verification challenge
   */
  async youtubeVerify(req: Request, res: Response) {
    const challenge = req.query["hub.challenge"];

    if (challenge) {
      return res.status(200).send(challenge);
    }

    return res.sendStatus(404);
  }

  /**
   * POST /webhooks/youtube
   * Receives YouTube feed updates (new video, updated video, deleted video)
   * Body is Atom XML
   */
  async youtubeEvent(req: Request, res: Response) {
    const linkHeader = req.headers["link"] as string;
    const signature = req.headers["x-hub-signature"] as string;
    const rawBody = (req as any).rawBody as string;

    if (signature && process.env.YOUTUBE_WEBHOOK_SECRET) {
      const expectedSig =
        "sha1=" +
        crypto
          .createHmac("sha1", process.env.YOUTUBE_WEBHOOK_SECRET)
          .update(rawBody || "")
          .digest("hex");

      if (signature !== expectedSig) {
        console.error("YouTube webhook signature verification failed");
        return res.sendStatus(403);
      }
    }

    try {
      await WebhookController.handleYouTubeEvent(rawBody);
    } catch (error) {
      console.error("Error processing YouTube webhook:", error);
    }

    return res.sendStatus(200);
  }

  // ─── TikTok Webhook ─────────────────────────────────────────────────

  /**
   * POST /webhooks/tiktok
   * Receives Content Posting events. Payload shape:
   *   { client_key, event, create_time, user_openid, content }
   * where `content` is a serialized JSON string with the event fields.
   *
   * The post URL comes from `post.publish.publicly_available`, whose content
   * carries the public `post_id` (sent once TikTok's moderation completes).
   */
  async tiktokEvent(req: Request, res: Response) {
    if (!WebhookController.verifyTikTokSignature(req)) {
      console.error("TikTok webhook signature verification failed");
      return res.sendStatus(403);
    }

    const body = req.body;

    try {
      const content = WebhookController.parseTikTokContent(body.content);

      switch (body.event) {
        case "post.publish.publicly_available":
          await WebhookController.handleTikTokPubliclyAvailable(content);
          break;
        case "post.publish.failed":
          await WebhookController.handleTikTokPublishFailed(content);
          break;
        case "post.publish.complete":
          // The publish worker already records completion via status polling;
          // the public post id arrives separately in publicly_available.
          break;
        case "authorization.removed":
          await WebhookController.handleTikTokAuthRevoke(body.user_openid);
          break;
        default:
          break;
      }
    } catch (error) {
      console.error("Error processing TikTok webhook:", error);
    }

    return res.sendStatus(200);
  }

  /**
   * Verify the `TikTok-Signature: t=<ts>,s=<sig>` header: HMAC-SHA256 of
   * `${t}.${rawBody}` keyed with the app's client secret, with a replay
   * window on the timestamp.
   */
  private static verifyTikTokSignature(req: Request): boolean {
    const secret = process.env.TIKTOK_CLIENT_SECRET;
    const header = req.headers["tiktok-signature"] as string | undefined;

    // Without a secret we can't verify; don't lock ourselves out in dev.
    if (!secret) return true;
    if (!header) return false;

    const parts = Object.fromEntries(
      header.split(",").map((part) => part.split("=") as [string, string]),
    );
    const timestamp = parts.t;
    const signature = parts.s;
    if (!timestamp || !signature) return false;

    // Reject replays older than 5 minutes.
    const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(ageSeconds) || ageSeconds > 300) return false;

    const rawBody = (req as any).rawBody as string;
    if (!rawBody) return false;

    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");

    return (
      signature.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    );
  }

  /**
   * Parse the webhook's `content` JSON string. `post_id` is a bare 64-bit
   * number that JSON.parse would round past 2^53, so quote it first.
   */
  private static parseTikTokContent(
    content: unknown,
  ): Record<string, unknown> {
    if (typeof content === "object" && content !== null) {
      return content as Record<string, unknown>;
    }
    if (typeof content !== "string" || !content) return {};

    const quoted = content.replace(
      /("post_id"\s*:\s*)"?(\d+)"?/g,
      '$1"$2"',
    );
    try {
      return JSON.parse(quoted);
    } catch {
      console.error("Failed to parse TikTok webhook content:", content);
      return {};
    }
  }

  // ─── Shared Helpers ─────────────────────────────────────────────────

  private static verifyMetaSignature(
    req: Request,
    signature: string,
    appSecret: string
  ): boolean {
    if (!signature || !appSecret) return false;

    const rawBody = (req as any).rawBody as string;
    if (!rawBody) return false;

    const expectedSig =
      "sha256=" +
      crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSig)
    );
  }

  // ─── Platform-specific Event Handlers ───────────────────────────────

  private static async handleFacebookChange(_pageId: string, _change: any) {}

  private static async handleInstagramChange(_igUserId: string, _change: any) {}

  private static async handleYouTubeEvent(_rawXml: string) {}

  /**
   * `post.publish.publicly_available` — the post passed moderation and is
   * live. content: { publish_id, post_id, publish_type }. Resolve the real
   * share URL and store it on the PostAccount.
   */
  private static async handleTikTokPubliclyAvailable(
    content: Record<string, unknown>,
  ) {
    const publishId = content.publish_id ? String(content.publish_id) : null;
    const postId = content.post_id ? String(content.post_id) : null;
    if (!publishId || !postId) return;

    // The publish worker stores either the publish id (private/pending posts)
    // or the public post id (when status polling caught it) — match both.
    const postAccount = await prisma.postAccount.findFirst({
      where: { publishedPostId: { in: [publishId, postId] } },
      include: {
        account: true,
        post: { select: { type: true } },
      },
    });

    if (!postAccount) {
      console.warn(
        `TikTok publicly_available webhook: no post found for publish_id ${publishId}`,
      );
      return;
    }

    // Prefer the exact share URL from the Display API; fall back to a
    // constructed profile URL. Single attempt — the webhook can be redelivered
    // and the profile-based fallback is already correct.
    const shareUrl = await tiktokService.queryShareUrl(
      postId,
      postAccount.account.accessToken,
      1,
    );

    const kind = postAccount.post.type === "CAROUSEL" ? "photo" : "video";

    await prisma.postAccount.update({
      where: { id: postAccount.id },
      data: {
        published: true,
        publishedPostId: postId,
        publishedUrl:
          shareUrl ??
          tiktokService.buildFallbackUrl(postAccount.account, kind, postId),
        error: null,
      },
    });
  }

  /** `post.publish.failed` — content: { publish_id, reason, publish_type }. */
  private static async handleTikTokPublishFailed(
    content: Record<string, unknown>,
  ) {
    const publishId = content.publish_id ? String(content.publish_id) : null;
    if (!publishId) return;

    const postAccount = await prisma.postAccount.findFirst({
      where: { publishedPostId: publishId },
    });

    if (postAccount) {
      await prisma.postAccount.update({
        where: { id: postAccount.id },
        data: {
          published: false,
          error: `TikTok publish failed: ${content.reason || "Unknown error"}`,
        },
      });

      // Recompute the post's overall status from its legs, otherwise a post
      // that looked fully published keeps saying so.
      const legs = await prisma.postAccount.findMany({
        where: { postId: postAccount.postId },
        select: { published: true },
      });
      const publishedCount = legs.filter((leg) => leg.published).length;
      await prisma.post.update({
        where: { id: postAccount.postId },
        data: {
          status: publishedCount === 0 ? "FAILED" : "PARTIALLY_PUBLISHED",
          error: `Failed to publish to ${legs.length - publishedCount} of ${legs.length} account(s)`,
        },
      });
    }
  }

  /** `authorization.removed` — the user deauthorized the app on TikTok. */
  private static async handleTikTokAuthRevoke(openId: unknown) {
    if (!openId) return;

    const account = await prisma.socialAccount.findFirst({
      where: { provider: "tiktok", providerAccountId: String(openId) },
    });

    if (account) {
      await prisma.socialAccount.delete({ where: { id: account.id } });
    }
  }
}
