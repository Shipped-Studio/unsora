import { PostAccount, Prisma, SocialAccount } from "@prisma/client";
import axios from "axios";
import { prisma } from "../lib/db";
import { tokenRefreshService } from "./token-refresh.service";

/**
 * Post analytics service.
 *
 * Platforms do NOT push engagement metrics over webhooks — webhooks only
 * carry events (publish status, comments, auth revokes). Metrics are
 * cumulative counters that must be polled from each platform's API:
 *   - TikTok: Display API POST /v2/video/query/ (requires video.list scope)
 *   - Instagram: media fields (like_count, comments_count) + /insights
 *     (views/shares/saves need instagram_business_manage_insights)
 *   - Bluesky: public AppView app.bsky.feed.getPosts (like/reply/repost/quote
 *     counts; no view/impression metric exists on the network)
 *   - YouTube: Data API videos.list part=statistics (views/likes/comments;
 *     share counts are only in the Analytics API, not polled here)
 *   - Facebook: post fields (reactions/comments/shares via
 *     pages_read_engagement; "likes" is the subtotal of ALL reaction types)
 *     + post_impressions / total_video_views insights (read_insights)
 *   - Threads: media insights (views/likes/replies/reposts/quotes via
 *     threads_manage_insights)
 *   - Pinterest: batched pin analytics, up to 100 pins per request
 *     (impressions/saves/clicks via pins:read)
 *   - X: tweets lookup public_metrics, up to 100 posts per request
 *     (impressions/likes/replies/reposts+quotes/bookmarks)
 *   - Google Business Profile: localPosts:reportInsights, up to 100 posts
 *     per request per location (search views only)
 *   - LinkedIn: socialMetadata reaction summaries per post ("likes" is the
 *     subtotal of ALL reaction types: LIKE/PRAISE/EMPATHY/INTEREST/
 *     APPRECIATION/ENTERTAINMENT); impressions need partner-level API
 *     access and stay 0
 *
 * Each poll writes a PostMetricSnapshot row, so totals and growth-over-time
 * can both be derived.
 */

export interface PostMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}

const EMPTY_METRICS: PostMetrics = {
  views: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  saves: 0,
};

/** Only posts published within this window are polled. */
const METRICS_WINDOW_DAYS = 90;

type PublishedPostAccount = PostAccount & { account: SocialAccount };

const METRICS_PROVIDERS = [
  "tiktok",
  "instagram",
  "bluesky",
  "google",
  "facebook",
  "threads",
  "pinterest",
  "linkedin",
  "x",
  "google_business",
];

/** Published legs inside the metrics window on a provider we can poll. */
function recentPublishedWhere(): Prisma.PostAccountWhereInput {
  return {
    published: true,
    publishedPostId: { not: null },
    publishedAt: {
      gte: new Date(Date.now() - METRICS_WINDOW_DAYS * 24 * 60 * 60 * 1000),
    },
    account: { provider: { in: METRICS_PROVIDERS } },
  };
}

export class AnalyticsService {
  /**
   * Accounts with at least one published post in the metrics window. The
   * scheduled refresh fans out one run per account from this list.
   */
  async listAccountsToRefresh(): Promise<string[]> {
    const rows = await prisma.postAccount.findMany({
      where: recentPublishedWhere(),
      distinct: ["accountId"],
      select: { accountId: true },
    });
    return rows.map((row) => row.accountId);
  }

  /** Poll fresh metrics for one account's published posts in the window. */
  async refreshAccountMetrics(accountId: string): Promise<number> {
    const postAccounts = (await prisma.postAccount.findMany({
      where: { ...recentPublishedWhere(), accountId },
      include: { account: true },
    })) as PublishedPostAccount[];

    return this.refreshMetricsFor(postAccounts);
  }

  /** Poll metrics for a single user's published posts (on-demand refresh). */
  async refreshUserMetrics(userId: string): Promise<number> {
    const postAccounts = (await prisma.postAccount.findMany({
      where: { ...recentPublishedWhere(), post: { userId } },
      include: { account: true },
    })) as PublishedPostAccount[];

    return this.refreshMetricsFor(postAccounts);
  }

  /**
   * Group posts by social account (one token refresh + batched API calls per
   * account) and write a snapshot for each post we could fetch.
   */
  private async refreshMetricsFor(
    postAccounts: PublishedPostAccount[],
  ): Promise<number> {
    if (postAccounts.length === 0) return 0;

    const byAccount = new Map<string, PublishedPostAccount[]>();
    for (const pa of postAccounts) {
      const group = byAccount.get(pa.accountId) ?? [];
      group.push(pa);
      byAccount.set(pa.accountId, group);
    }

    let refreshed = 0;

    for (const [accountId, group] of byAccount) {
      try {
        const account =
          await tokenRefreshService.getAccountWithFreshToken(accountId);
        const provider = account.provider.toLowerCase();

        let metricsByPost: Map<string, PostMetrics>;
        switch (provider) {
          case "tiktok":
            metricsByPost = await this.fetchTikTokMetrics(account, group);
            break;
          case "bluesky":
            metricsByPost = await this.fetchBlueskyMetrics(group);
            break;
          case "google": // YouTube
            metricsByPost = await this.fetchYouTubeMetrics(account, group);
            break;
          case "facebook":
            metricsByPost = await this.fetchFacebookMetrics(account, group);
            break;
          case "threads":
            metricsByPost = await this.fetchThreadsMetrics(account, group);
            break;
          case "pinterest":
            metricsByPost = await this.fetchPinterestMetrics(account, group);
            break;
          case "linkedin":
            metricsByPost = await this.fetchLinkedInMetrics(account, group);
            break;
          case "x":
            metricsByPost = await this.fetchXMetrics(account, group);
            break;
          case "google_business":
            metricsByPost = await this.fetchGoogleBusinessMetrics(
              account,
              group,
            );
            break;
          default:
            metricsByPost = await this.fetchInstagramMetrics(account, group);
        }

        for (const [postAccountId, metrics] of metricsByPost) {
          await prisma.postMetricSnapshot.create({
            data: { postAccountId, ...metrics },
          });
          refreshed++;
        }
      } catch (error) {
        // One broken account (revoked token etc.) must not stop the rest.
        console.error(
          `Analytics refresh failed for account ${accountId}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    return refreshed;
  }

  // ─── TikTok ───

  /**
   * Fetch metrics for TikTok posts via the Display API video query, which
   * accepts up to 20 video ids per request.
   */
  private async fetchTikTokMetrics(
    account: SocialAccount,
    postAccounts: PublishedPostAccount[],
  ): Promise<Map<string, PostMetrics>> {
    const result = new Map<string, PostMetrics>();
    const byVideoId = new Map(
      postAccounts.map((pa) => [pa.publishedPostId as string, pa.id]),
    );
    const videoIds = [...byVideoId.keys()];

    for (let i = 0; i < videoIds.length; i += 20) {
      const batch = videoIds.slice(i, i + 20);

      try {
        const response = await axios.post(
          "https://open.tiktokapis.com/v2/video/query/?fields=id,view_count,like_count,comment_count,share_count",
          { filters: { video_ids: batch } },
          {
            headers: {
              Authorization: `Bearer ${account.accessToken}`,
              "Content-Type": "application/json",
            },
          },
        );

        for (const video of response.data?.data?.videos ?? []) {
          const postAccountId = byVideoId.get(String(video.id));
          if (!postAccountId) continue;
          result.set(postAccountId, {
            views: video.view_count ?? 0,
            likes: video.like_count ?? 0,
            comments: video.comment_count ?? 0,
            shares: video.share_count ?? 0,
            saves: 0, // not exposed by the Display API
          });
        }
      } catch (error: any) {
        console.error("TikTok metrics query failed:", {
          accountId: account.id,
          message: error.message,
          response: error.response?.data,
        });
      }
    }

    return result;
  }

  // ─── Threads ───

  /**
   * Fetch metrics for Threads posts via media insights. Available metrics
   * vary by post type and API version, so parsing tolerates missing ones.
   * Maps replies → comments and reposts+quotes → shares.
   */
  private async fetchThreadsMetrics(
    account: SocialAccount,
    postAccounts: PublishedPostAccount[],
  ): Promise<Map<string, PostMetrics>> {
    const result = new Map<string, PostMetrics>();

    for (const pa of postAccounts) {
      const mediaId = pa.publishedPostId as string;

      try {
        const response = await axios.get(
          `https://graph.threads.net/v1.0/${mediaId}/insights`,
          {
            params: {
              metric: "views,likes,replies,reposts,quotes",
              access_token: account.accessToken,
            },
          },
        );

        const metrics: PostMetrics = { ...EMPTY_METRICS };
        for (const item of response.data?.data ?? []) {
          // Media insights report either values[0].value or total_value.value.
          const value =
            item.values?.[0]?.value ?? item.total_value?.value ?? 0;
          if (item.name === "views") metrics.views = value;
          if (item.name === "likes") metrics.likes = value;
          if (item.name === "replies") metrics.comments = value;
          if (item.name === "reposts") metrics.shares += value;
          if (item.name === "quotes") metrics.shares += value;
        }

        result.set(pa.id, metrics);
      } catch (error: any) {
        console.error("Threads insights query failed:", {
          mediaId,
          message: error.message,
          response: error.response?.data,
        });
      }
    }

    return result;
  }

  // ─── Pinterest ───

  /**
   * Fetch metrics for pins via the batched analytics endpoint (up to 100
   * pin ids per request). Pinterest reports impressions/saves/clicks, not
   * likes/comments — impressions map to views, outbound clicks to shares.
   * Some metrics require a business account; missing ones read as 0.
   */
  private async fetchPinterestMetrics(
    account: SocialAccount,
    postAccounts: PublishedPostAccount[],
  ): Promise<Map<string, PostMetrics>> {
    const result = new Map<string, PostMetrics>();
    const byPinId = new Map(
      postAccounts.map((pa) => [pa.publishedPostId as string, pa.id]),
    );
    const pinIds = [...byPinId.keys()];

    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(
      Date.now() - METRICS_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    )
      .toISOString()
      .slice(0, 10);

    for (let i = 0; i < pinIds.length; i += 100) {
      const batch = pinIds.slice(i, i + 100);

      try {
        const response = await axios.get(
          "https://api.pinterest.com/v5/pins/analytics",
          {
            headers: { Authorization: `Bearer ${account.accessToken}` },
            params: {
              pin_ids: batch.join(","),
              start_date: startDate,
              end_date: endDate,
              metric_types: "IMPRESSION,SAVE,PIN_CLICK,OUTBOUND_CLICK",
            },
          },
        );

        for (const [pinId, data] of Object.entries(
          (response.data ?? {}) as Record<string, any>,
        )) {
          const postAccountId = byPinId.get(pinId);
          if (!postAccountId) continue;

          const summary =
            data?.all?.summary_metrics ?? data?.all?.lifetime_metrics ?? {};

          result.set(postAccountId, {
            views: summary.IMPRESSION ?? 0,
            likes: 0, // not exposed by Pinterest
            comments: 0, // not exposed by Pinterest
            shares: summary.OUTBOUND_CLICK ?? 0,
            saves: summary.SAVE ?? 0,
          });
        }
      } catch (error: any) {
        console.error("Pinterest analytics query failed:", {
          accountId: account.id,
          message: error.message,
          response: error.response?.data,
        });
      }
    }

    return result;
  }

  // ─── Facebook ───

  /**
   * Fetch metrics for Facebook Page posts. publishedPostId is either a feed
   * post id (`pageId_postId`, from photo/text posts) or a bare video id
   * (from /videos uploads) — the two use different fields and insights
   * endpoints. Insights need read_insights; older connections without it
   * degrade to engagement counts with views = 0.
   *
   * "likes" is the subtotal of ALL reaction types (Like/Love/Haha/Wow/Sad/
   * Angry/Care) via the reactions edge, not just the classic Like.
   */
  private async fetchFacebookMetrics(
    account: SocialAccount,
    postAccounts: PublishedPostAccount[],
  ): Promise<Map<string, PostMetrics>> {
    const result = new Map<string, PostMetrics>();

    for (const pa of postAccounts) {
      const postId = pa.publishedPostId as string;
      const isFeedPost = postId.includes("_");
      const metrics: PostMetrics = { ...EMPTY_METRICS };
      let fetchedAnything = false;

      try {
        const response = await axios.get(
          `https://graph.facebook.com/v24.0/${postId}`,
          {
            params: {
              access_token: account.accessToken,
              fields: isFeedPost
                ? "reactions.summary(total_count),comments.summary(true),shares"
                : "reactions.summary(total_count),comments.summary(true)",
            },
          },
        );
        metrics.likes = response.data.reactions?.summary?.total_count ?? 0;
        metrics.comments = response.data.comments?.summary?.total_count ?? 0;
        metrics.shares = response.data.shares?.count ?? 0;
        fetchedAnything = true;
      } catch (error: any) {
        console.error("Facebook post fields query failed:", {
          postId,
          message: error.message,
          response: error.response?.data,
        });
      }

      try {
        const response = isFeedPost
          ? await axios.get(
              `https://graph.facebook.com/v24.0/${postId}/insights`,
              {
                params: {
                  access_token: account.accessToken,
                  metric: "post_impressions",
                },
              },
            )
          : await axios.get(
              `https://graph.facebook.com/v24.0/${postId}/video_insights`,
              {
                params: {
                  access_token: account.accessToken,
                  metric: "total_video_views",
                },
              },
            );

        const value = response.data?.data?.[0]?.values?.[0]?.value;
        metrics.views = typeof value === "number" ? value : 0;
        fetchedAnything = true;
      } catch {
        // Insights need read_insights, which older connections may lack.
        // Engagement counts still get stored.
      }

      if (fetchedAnything) {
        result.set(pa.id, metrics);
      }
    }

    return result;
  }

  // ─── X ───

  /**
   * Fetch metrics for X posts via the tweets lookup (up to 100 ids per
   * request). Reposts and quotes both count as shares.
   */
  private async fetchXMetrics(
    account: SocialAccount,
    postAccounts: PublishedPostAccount[],
  ): Promise<Map<string, PostMetrics>> {
    const result = new Map<string, PostMetrics>();
    const byPostId = new Map(
      postAccounts.map((pa) => [pa.publishedPostId as string, pa.id]),
    );
    const postIds = [...byPostId.keys()];

    for (let i = 0; i < postIds.length; i += 100) {
      const batch = postIds.slice(i, i + 100);

      try {
        const response = await axios.get("https://api.x.com/2/tweets", {
          headers: { Authorization: `Bearer ${account.accessToken}` },
          params: { ids: batch.join(","), "tweet.fields": "public_metrics" },
        });

        for (const post of (response.data?.data ?? []) as any[]) {
          const postAccountId = byPostId.get(post.id);
          if (!postAccountId) continue;

          const m = post.public_metrics ?? {};
          result.set(postAccountId, {
            views: m.impression_count ?? 0,
            likes: m.like_count ?? 0,
            comments: m.reply_count ?? 0,
            shares: (m.retweet_count ?? 0) + (m.quote_count ?? 0),
            saves: m.bookmark_count ?? 0,
          });
        }
      } catch (error: any) {
        console.error("X metrics query failed:", {
          accountId: account.id,
          message: error.message,
          response: error.response?.data,
        });
      }
    }

    return result;
  }

  // ─── Google Business Profile ───

  /**
   * Fetch search views for local posts (up to 100 per request). Google
   * reports views and button clicks only; there are no likes or comments.
   */
  private async fetchGoogleBusinessMetrics(
    account: SocialAccount,
    postAccounts: PublishedPostAccount[],
  ): Promise<Map<string, PostMetrics>> {
    const result = new Map<string, PostMetrics>();
    const byPostName = new Map(
      postAccounts.map((pa) => [pa.publishedPostId as string, pa.id]),
    );
    const postNames = [...byPostName.keys()];

    const endTime = new Date().toISOString();
    const startTime = new Date(
      Date.now() - METRICS_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    for (let i = 0; i < postNames.length; i += 100) {
      const batch = postNames.slice(i, i + 100);

      try {
        const response = await axios.post(
          `https://mybusiness.googleapis.com/v4/${account.providerAccountId}/localPosts:reportInsights`,
          {
            localPostNames: batch,
            basicRequest: {
              metricRequests: [{ metric: "LOCAL_POST_VIEWS_SEARCH" }],
              timeRange: { startTime, endTime },
            },
          },
          { headers: { Authorization: `Bearer ${account.accessToken}` } },
        );

        for (const entry of (response.data?.localPostMetrics ?? []) as any[]) {
          const postAccountId = byPostName.get(entry.localPostName);
          if (!postAccountId) continue;

          const views = (entry.metricValues ?? []).find(
            (v: any) => v.metric === "LOCAL_POST_VIEWS_SEARCH",
          );
          result.set(postAccountId, {
            ...EMPTY_METRICS,
            views: Number(views?.totalValue?.value ?? 0),
          });
        }
      } catch (error: any) {
        console.error("Google Business insights query failed:", {
          accountId: account.id,
          message: error.message,
          response: error.response?.data,
        });
      }
    }

    return result;
  }

  // ─── LinkedIn ───

  /**
   * Fetch metrics for LinkedIn posts. publishedPostId is the post URN
   * (urn:li:share:… or urn:li:ugcPost:…).
   *
   * "likes" is the subtotal of ALL reaction types (LIKE/PRAISE/EMPATHY/
   * INTEREST/APPRECIATION/ENTERTAINMENT), summed from socialMetadata
   * reactionSummaries. Falls back to the socialActions likes summary when
   * socialMetadata is unavailable for the token. Impressions/shares need
   * partner-level API access and stay 0.
   */
  private async fetchLinkedInMetrics(
    account: SocialAccount,
    postAccounts: PublishedPostAccount[],
  ): Promise<Map<string, PostMetrics>> {
    const result = new Map<string, PostMetrics>();

    for (const pa of postAccounts) {
      const postUrn = pa.publishedPostId as string;
      const encodedUrn = encodeURIComponent(postUrn);
      const metrics: PostMetrics = { ...EMPTY_METRICS };
      let fetchedAnything = false;

      try {
        const response = await axios.get(
          `https://api.linkedin.com/rest/socialMetadata/${encodedUrn}`,
          {
            headers: {
              Authorization: `Bearer ${account.accessToken}`,
              "LinkedIn-Version": "202601",
              "X-Restli-Protocol-Version": "2.0.0",
            },
          },
        );

        const summaries = response.data?.reactionSummaries ?? {};
        metrics.likes = Object.values(summaries).reduce(
          (total: number, summary: any) => total + (summary?.count ?? 0),
          0,
        );
        metrics.comments = response.data?.commentSummary?.count ?? 0;
        fetchedAnything = true;
      } catch {
        // socialMetadata may be unavailable for member tokens — try the
        // older socialActions summary instead.
        try {
          const response = await axios.get(
            `https://api.linkedin.com/v2/socialActions/${encodedUrn}`,
            { headers: { Authorization: `Bearer ${account.accessToken}` } },
          );

          metrics.likes =
            response.data?.likesSummary?.aggregatedTotalLikes ??
            response.data?.likesSummary?.totalLikes ??
            0;
          metrics.comments =
            response.data?.commentsSummary?.aggregatedTotalComments ??
            response.data?.commentsSummary?.totalFirstLevelComments ??
            0;
          fetchedAnything = true;
        } catch (error: any) {
          console.error("LinkedIn metrics query failed:", {
            postUrn,
            message: error.message,
            response: error.response?.data,
          });
        }
      }

      if (fetchedAnything) {
        result.set(pa.id, metrics);
      }
    }

    return result;
  }

  // ─── YouTube ───

  /**
   * Fetch metrics for YouTube videos via the Data API, which accepts up to
   * 50 video ids per request (1 quota unit each). Uses the account's OAuth
   * token so unlisted/private videos report stats too. Share and save counts
   * are only available in the YouTube Analytics API and stay 0 here.
   */
  private async fetchYouTubeMetrics(
    account: SocialAccount,
    postAccounts: PublishedPostAccount[],
  ): Promise<Map<string, PostMetrics>> {
    const result = new Map<string, PostMetrics>();
    const byVideoId = new Map(
      postAccounts.map((pa) => [pa.publishedPostId as string, pa.id]),
    );
    const videoIds = [...byVideoId.keys()];

    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = videoIds.slice(i, i + 50);

      try {
        const response = await axios.get(
          "https://www.googleapis.com/youtube/v3/videos",
          {
            params: { part: "statistics", id: batch.join(","), maxResults: 50 },
            headers: { Authorization: `Bearer ${account.accessToken}` },
          },
        );

        for (const video of response.data?.items ?? []) {
          const postAccountId = byVideoId.get(video.id);
          if (!postAccountId) continue;
          const stats = video.statistics ?? {};
          result.set(postAccountId, {
            views: Number(stats.viewCount ?? 0),
            likes: Number(stats.likeCount ?? 0),
            comments: Number(stats.commentCount ?? 0),
            shares: 0, // Analytics API only
            saves: 0, // not exposed
          });
        }
      } catch (error: any) {
        console.error("YouTube metrics query failed:", {
          accountId: account.id,
          message: error.message,
          response: error.response?.data,
        });
      }
    }

    return result;
  }

  // ─── Bluesky ───

  /**
   * Fetch metrics for Bluesky posts from the public AppView, which accepts
   * up to 25 AT URIs per request and needs no authentication.
   * publishedPostId stores the post's AT URI. Bluesky exposes no
   * view/impression counter, so views stay 0; reposts + quotes map to shares.
   */
  private async fetchBlueskyMetrics(
    postAccounts: PublishedPostAccount[],
  ): Promise<Map<string, PostMetrics>> {
    const result = new Map<string, PostMetrics>();
    const byUri = new Map(
      postAccounts.map((pa) => [pa.publishedPostId as string, pa.id]),
    );
    const uris = [...byUri.keys()];

    for (let i = 0; i < uris.length; i += 25) {
      const batch = uris.slice(i, i + 25);

      try {
        const response = await axios.get(
          "https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts",
          { params: { uris: batch }, paramsSerializer: { indexes: null } },
        );

        for (const post of response.data?.posts ?? []) {
          const postAccountId = byUri.get(post.uri);
          if (!postAccountId) continue;
          result.set(postAccountId, {
            views: 0, // not exposed by Bluesky
            likes: post.likeCount ?? 0,
            comments: post.replyCount ?? 0,
            shares: (post.repostCount ?? 0) + (post.quoteCount ?? 0),
            saves: 0, // not exposed by Bluesky
          });
        }
      } catch (error: any) {
        console.error("Bluesky metrics query failed:", {
          message: error.message,
          response: error.response?.data,
        });
      }
    }

    return result;
  }

  // ─── Instagram ───

  /**
   * Fetch metrics for Instagram posts. Likes/comments come from media
   * fields (basic scope); views/shares/saves come from the insights edge
   * and require instagram_business_manage_insights — missing permission
   * degrades gracefully to zeros.
   */
  private async fetchInstagramMetrics(
    account: SocialAccount,
    postAccounts: PublishedPostAccount[],
  ): Promise<Map<string, PostMetrics>> {
    const result = new Map<string, PostMetrics>();

    for (const pa of postAccounts) {
      const mediaId = pa.publishedPostId as string;
      const metrics: PostMetrics = { ...EMPTY_METRICS };
      let fetchedAnything = false;

      // Primary source: the insights edge carries all five metrics in one
      // call (requires instagram_business_manage_insights).
      try {
        const response = await axios.get(
          `https://graph.instagram.com/v24.0/${mediaId}/insights`,
          {
            params: {
              access_token: account.accessToken,
              metric: ["views", "likes", "comments", "shares", "saved"].join(
                ",",
              ),
            },
          },
        );

        console.log(JSON.stringify(response.data, null, 2));

        for (const item of response.data?.data ?? []) {
          const value =
            item.values?.[0]?.value ?? item.total_value?.value ?? 0;
          if (item.name === "views") metrics.views = value;
          if (item.name === "likes") metrics.likes = value;
          if (item.name === "comments") metrics.comments = value;
          if (item.name === "shares") metrics.shares = value;
          if (item.name === "saved") metrics.saves = value;
        }
        fetchedAnything = true;
      } catch (error: any) {
        console.error("Instagram insights query failed:", {
          mediaId,
          message: error.message,
          response: error.response?.data,
        });
      }

      // Fallback: older connections without the insights scope still get
      // likes/comments from the media fields.
      if (!fetchedAnything) {
        try {
          const response = await axios.get(
            `https://graph.instagram.com/v24.0/${mediaId}`,
            {
              params: {
                access_token: account.accessToken,
                fields: "like_count,comments_count",
              },
            },
          );
          metrics.likes = response.data.like_count ?? 0;
          metrics.comments = response.data.comments_count ?? 0;
          fetchedAnything = true;
        } catch (error: any) {
          console.error("Instagram media fields query failed:", {
            mediaId,
            message: error.message,
            response: error.response?.data,
          });
        }
      }

      if (fetchedAnything) {
        result.set(pa.id, metrics);
      }
    }

    return result;
  }

  // ─── Read side ───

  /**
   * Aggregate analytics for a user's dashboard:
   * totals, per-platform breakdown, daily timeseries, and top posts.
   */
  async getSummary(userId: string, days: number = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const postAccounts = await prisma.postAccount.findMany({
      where: {
        published: true,
        publishedAt: { gte: since },
        post: { userId },
      },
      include: {
        account: {
          select: {
            provider: true,
            accountUsername: true,
            profilePicture: true,
          },
        },
        post: { select: { mainCaption: true, type: true } },
        metricSnapshots: { orderBy: { fetchedAt: "desc" } },
      },
      orderBy: { publishedAt: "desc" },
    });

    const totals: PostMetrics = { ...EMPTY_METRICS };
    const byPlatform = new Map<string, PostMetrics & { posts: number }>();

    const posts = postAccounts.map((pa) => {
      const latest = pa.metricSnapshots[0];
      const metrics: PostMetrics = latest
        ? {
            views: latest.views,
            likes: latest.likes,
            comments: latest.comments,
            shares: latest.shares,
            saves: latest.saves,
          }
        : { ...EMPTY_METRICS };

      const provider = pa.account.provider.toLowerCase();
      const platform = byPlatform.get(provider) ?? {
        ...EMPTY_METRICS,
        posts: 0,
      };
      platform.posts++;
      for (const key of Object.keys(EMPTY_METRICS) as (keyof PostMetrics)[]) {
        totals[key] += metrics[key];
        platform[key] += metrics[key];
      }
      byPlatform.set(provider, platform);

      return {
        postAccountId: pa.id,
        platform: provider,
        accountUsername: pa.account.accountUsername,
        profilePicture: pa.account.profilePicture,
        caption: pa.customCaption || pa.post.mainCaption,
        postType: pa.post.type,
        publishedAt: pa.publishedAt,
        publishedUrl: pa.publishedUrl,
        metrics,
        lastFetchedAt: latest?.fetchedAt ?? null,
      };
    });

    return {
      totals,
      postCount: postAccounts.length,
      byPlatform: [...byPlatform.entries()].map(([platform, metrics]) => ({
        platform,
        ...metrics,
      })),
      timeseries: this.buildDailyTimeseries(postAccounts, since),
      posts,
    };
  }

  /**
   * Build a daily timeseries of total views/likes across all posts. For each
   * day, each post contributes its most recent snapshot up to the end of
   * that day (counters are cumulative, so this is total-to-date).
   */
  private buildDailyTimeseries(
    postAccounts: {
      metricSnapshots: {
        views: number;
        likes: number;
        comments: number;
        shares: number;
        fetchedAt: Date;
      }[];
    }[],
    since: Date,
  ) {
    const days: { date: string; views: number; likes: number; comments: number; shares: number }[] =
      [];

    const dayMs = 24 * 60 * 60 * 1000;
    const start = new Date(since);
    start.setHours(0, 0, 0, 0);

    for (let t = start.getTime(); t <= Date.now(); t += dayMs) {
      const endOfDay = new Date(t + dayMs);
      const point = {
        date: new Date(t).toISOString().slice(0, 10),
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
      };

      for (const pa of postAccounts) {
        // Snapshots are ordered desc; find the first at or before end of day.
        const snapshot = pa.metricSnapshots.find(
          (s) => s.fetchedAt < endOfDay,
        );
        if (!snapshot) continue;
        point.views += snapshot.views;
        point.likes += snapshot.likes;
        point.comments += snapshot.comments;
        point.shares += snapshot.shares;
      }

      days.push(point);
    }

    return days;
  }
}

export const analyticsService = new AnalyticsService();
