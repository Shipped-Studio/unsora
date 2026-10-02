import { Request, Response } from "express";
import { prisma } from "../lib/db";
import { Prisma, PostType, PostStatus, MediaType } from "@prisma/client";
import { addPostPublishingJob } from "../queue/post.queue";
import { createAsset } from "../lib/asset-utils";
import { reconcilePostLegs } from "../lib/post-legs";
import {
  PostRuleError,
  assertCaptionForType,
  assertMediaMatchesType,
  assertProvidersSupportType,
  isPostType,
  parseFutureDate,
} from "../lib/post-rules";

const ACCOUNT_SELECT = {
  id: true,
  provider: true,
  accountName: true,
  accountUsername: true,
  profilePicture: true,
} as const;

const POST_INCLUDE = {
  media: {
    orderBy: { order: "asc" },
    include: { asset: true },
  },
  postAccounts: {
    orderBy: { createdAt: "asc" },
    include: { account: { select: ACCOUNT_SELECT } },
  },
} satisfies Prisma.PostInclude;

const POST_STATUSES: PostStatus[] = [
  "DRAFT",
  "SCHEDULED",
  "PUBLISHING",
  "PUBLISHED",
  "PARTIALLY_PUBLISHED",
  "FAILED",
];

interface MediaBody {
  type: string;
  url: string;
  order?: number;
  width?: number;
  height?: number;
  duration?: number;
  fileSize?: number | string;
  mimeType?: string;
}

interface AccountBody {
  accountId: string;
  customCaption?: string | null;
  title?: string | null;
  settings?: Record<string, unknown> | null;
}

async function findUserId(clerkId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });
  return user?.id ?? null;
}

function sendRuleError(res: Response, error: PostRuleError) {
  return res.status(error.status).json({
    success: false,
    error: error.message,
    code: error.code,
  });
}

/** Loads the given accounts and fails unless every one belongs to the user. */
async function loadOwnedAccounts(userId: string, accountIds: string[]) {
  const unique = [...new Set(accountIds)];
  const accounts = await prisma.socialAccount.findMany({
    where: { id: { in: unique }, userId },
    select: { id: true, provider: true },
  });
  if (accounts.length !== unique.length) {
    throw new PostRuleError(
      "One or more accounts aren't connected to your workspace.",
      "ACCOUNT_NOT_FOUND",
      403,
    );
  }
  return accounts;
}

/** Turns request media into PostMedia rows, reusing assets by URL. */
async function buildMediaRows(userId: string, media: MediaBody[]) {
  return Promise.all(
    media.map(async (m, index) => {
      const asset = await createAsset({
        userId,
        url: m.url,
        name: m.mimeType || "Post media",
        mimeType: m.mimeType,
        type: m.type === "VIDEO" ? "VIDEO" : "IMAGE",
        source: "UPLOAD",
        width: m.width,
        height: m.height,
        duration: m.duration,
        fileSize: m.fileSize ? BigInt(m.fileSize) : undefined,
      });
      return {
        type: m.type as MediaType,
        assetId: asset.id,
        order: m.order ?? index,
      };
    }),
  );
}

function legData(a: AccountBody) {
  return {
    customCaption: a.customCaption || null,
    title: a.title || null,
    settings:
      a.settings && typeof a.settings === "object"
        ? (a.settings as Prisma.InputJsonValue)
        : Prisma.DbNull,
  };
}

function parseStatuses(raw: unknown): PostStatus[] | undefined {
  if (typeof raw !== "string" || !raw) return undefined;
  const statuses = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s): s is PostStatus => POST_STATUSES.includes(s as PostStatus));
  return statuses.length ? statuses : undefined;
}

function parseDate(raw: unknown): Date | undefined {
  if (typeof raw !== "string" || !raw) return undefined;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Validates content and platform support for a post that is about to go out. */
async function assertPublishable(postId: string) {
  const post = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    select: {
      type: true,
      mainCaption: true,
      media: { select: { type: true } },
      postAccounts: {
        select: { published: true, account: { select: { provider: true } } },
      },
    },
  });
  if (post.postAccounts.length === 0) {
    throw new PostRuleError("Pick at least one account.", "ACCOUNT_REQUIRED");
  }
  assertMediaMatchesType(post.type, post.media, true);
  assertCaptionForType(post.type, post.mainCaption);
  assertProvidersSupportType(
    post.type,
    post.postAccounts
      .filter((pa) => !pa.published)
      .map((pa) => pa.account.provider),
  );
}

export class PostController {
  /** Create a draft, or a scheduled post when `scheduledFor` is set. */
  async createPost(req: Request, res: Response) {
    try {
      const {
        type = "VIDEO",
        mainCaption,
        scheduledFor,
        timezone,
        media,
        accounts,
      } = req.body as {
        type?: string;
        mainCaption?: string;
        scheduledFor?: string | null;
        timezone?: string | null;
        media?: MediaBody[];
        accounts?: AccountBody[];
      };

      if (!isPostType(type)) {
        return res
          .status(400)
          .json({ success: false, error: "Unknown post type", code: "INVALID_TYPE" });
      }
      if (!mainCaption?.trim() && type === "TEXT") {
        return res.status(400).json({
          success: false,
          error: "Write something before saving a text post.",
          code: "CAPTION_REQUIRED",
        });
      }
      if (!accounts?.length) {
        return res.status(400).json({
          success: false,
          error: "Pick at least one account.",
          code: "ACCOUNT_REQUIRED",
        });
      }

      const userId = await findUserId(req.auth.userId);
      if (!userId) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const owned = await loadOwnedAccounts(
        userId,
        accounts.map((a) => a.accountId),
      );
      const scheduleDate = scheduledFor ? parseFutureDate(scheduledFor) : null;
      assertMediaMatchesType(type, media, Boolean(scheduleDate));
      if (scheduleDate) {
        assertProvidersSupportType(
          type,
          owned.map((a) => a.provider),
        );
      }

      const mediaRows = media?.length
        ? await buildMediaRows(userId, media)
        : undefined;

      const post = await prisma.post.create({
        data: {
          userId,
          type,
          mainCaption: mainCaption ?? "",
          status: scheduleDate ? "SCHEDULED" : "DRAFT",
          scheduledFor: scheduleDate,
          scheduledTimezone: timezone || null,
          media: mediaRows ? { create: mediaRows } : undefined,
          postAccounts: {
            create: accounts.map((a) => ({
              accountId: a.accountId,
              ...legData(a),
            })),
          },
        },
        include: POST_INCLUDE,
      });

      return res.status(201).json({
        success: true,
        data: post,
        message: scheduleDate ? "Post scheduled" : "Draft saved",
      });
    } catch (error) {
      if (error instanceof PostRuleError) return sendRuleError(res, error);
      console.error("Error creating post:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to create post" });
    }
  }

  /**
   * List posts. Filters: status (comma separated), type, accountId, provider,
   * q (caption search), from/to (schedule or publish date), sort, dir.
   */
  async getPosts(req: Request, res: Response) {
    try {
      const userId = await findUserId(req.auth.userId);
      if (!userId) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 20));
      const statuses = parseStatuses(req.query.status);
      const type = req.query.type;
      const accountId =
        typeof req.query.accountId === "string" ? req.query.accountId : undefined;
      const provider =
        typeof req.query.provider === "string" ? req.query.provider : undefined;
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      const from = parseDate(req.query.from);
      const to = parseDate(req.query.to);

      const where: Prisma.PostWhereInput = { userId };
      if (statuses) where.status = { in: statuses };
      if (isPostType(type)) where.type = type;
      if (accountId || provider) {
        where.postAccounts = {
          some: {
            ...(accountId ? { accountId } : {}),
            ...(provider ? { account: { provider } } : {}),
          },
        };
      }
      if (q) where.mainCaption = { contains: q, mode: "insensitive" };
      if (from || to) {
        const range = {
          ...(from ? { gte: from } : {}),
          ...(to ? { lt: to } : {}),
        };
        where.OR = [
          { scheduledFor: range },
          { scheduledFor: null, publishedAt: range },
        ];
      }

      const dir: Prisma.SortOrder = req.query.dir === "asc" ? "asc" : "desc";
      const orderBy: Prisma.PostOrderByWithRelationInput[] =
        req.query.sort === "scheduled"
          ? [
              { scheduledFor: { sort: dir, nulls: "last" } },
              { createdAt: "desc" },
            ]
          : req.query.sort === "published"
            ? [
                { publishedAt: { sort: dir, nulls: "last" } },
                { createdAt: "desc" },
              ]
            : req.query.sort === "updated"
              ? [{ updatedAt: dir }]
              : [{ createdAt: dir }];

      const [posts, total] = await Promise.all([
        prisma.post.findMany({
          where,
          include: POST_INCLUDE,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.post.count({ where }),
      ]);

      return res.json({
        success: true,
        data: {
          posts,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      console.error("Error fetching posts:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to fetch posts" });
    }
  }

  /** Post counts per status, for tabs and the home page. */
  async getPostCounts(req: Request, res: Response) {
    try {
      const userId = await findUserId(req.auth.userId);
      if (!userId) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const groups = await prisma.post.groupBy({
        by: ["status"],
        where: { userId },
        _count: { _all: true },
      });

      const counts = Object.fromEntries(
        POST_STATUSES.map((status) => [status, 0]),
      ) as Record<PostStatus, number>;
      for (const group of groups) counts[group.status] = group._count._all;

      return res.json({
        success: true,
        data: {
          counts,
          total: Object.values(counts).reduce((sum, n) => sum + n, 0),
        },
      });
    } catch (error) {
      console.error("Error counting posts:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to count posts" });
    }
  }

  async getPostById(req: Request, res: Response) {
    try {
      const userId = await findUserId(req.auth.userId);
      if (!userId) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const post = await prisma.post.findFirst({
        where: { id: req.params.id, userId },
        include: POST_INCLUDE,
      });

      if (!post) {
        return res.status(404).json({ success: false, error: "Post not found" });
      }

      return res.json({ success: true, data: post });
    } catch (error) {
      console.error("Error fetching post:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to fetch post" });
    }
  }

  /**
   * Update a post. Accounts are upserted by accountId: legs that already
   * published are never modified or removed, so editing a partially
   * published post can't cause a double post.
   */
  async updatePost(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { type, mainCaption, scheduledFor, timezone, accounts, media } =
        req.body as {
          type?: string;
          mainCaption?: string;
          scheduledFor?: string | null;
          timezone?: string | null;
          accounts?: AccountBody[];
          media?: MediaBody[];
        };

      const userId = await findUserId(req.auth.userId);
      if (!userId) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const existing = await prisma.post.findFirst({
        where: { id, userId },
        include: {
          media: { select: { type: true } },
          postAccounts: {
            select: {
              id: true,
              accountId: true,
              published: true,
              account: { select: { provider: true } },
            },
          },
        },
      });

      if (!existing) {
        return res.status(404).json({ success: false, error: "Post not found" });
      }
      if (existing.status === "PUBLISHED") {
        return res.status(400).json({
          success: false,
          error: "Published posts can't be edited. Duplicate it instead.",
          code: "POST_PUBLISHED",
        });
      }
      if (existing.status === "PUBLISHING") {
        return res.status(409).json({
          success: false,
          error: "This post is publishing right now. Try again in a minute.",
          code: "POST_PUBLISHING",
        });
      }

      const nextType = type === undefined ? existing.type : type;
      if (!isPostType(nextType)) {
        return res
          .status(400)
          .json({ success: false, error: "Unknown post type", code: "INVALID_TYPE" });
      }

      const scheduleDate =
        scheduledFor === undefined
          ? undefined
          : scheduledFor
            ? parseFutureDate(scheduledFor)
            : null;

      let providers = existing.postAccounts.map((pa) => pa.account.provider);
      if (Array.isArray(accounts)) {
        if (accounts.length === 0) {
          throw new PostRuleError("Pick at least one account.", "ACCOUNT_REQUIRED");
        }
        const owned = await loadOwnedAccounts(
          userId,
          accounts.map((a) => a.accountId),
        );
        providers = owned.map((a) => a.provider);
      }

      const willBeScheduled =
        scheduleDate instanceof Date ||
        (scheduleDate === undefined && existing.status === "SCHEDULED");
      assertMediaMatchesType(
        nextType,
        Array.isArray(media) ? media : existing.media,
        willBeScheduled,
      );
      if (willBeScheduled) {
        assertCaptionForType(nextType, mainCaption ?? existing.mainCaption);
        assertProvidersSupportType(nextType, providers);
      }

      const mediaRows = Array.isArray(media)
        ? await buildMediaRows(userId, media)
        : undefined;

      const data: Prisma.PostUpdateInput = { type: nextType };
      if (mainCaption !== undefined) data.mainCaption = mainCaption;
      if (scheduleDate instanceof Date) {
        data.scheduledFor = scheduleDate;
        data.scheduledTimezone = timezone || null;
        data.status = "SCHEDULED";
        data.error = null;
      } else if (scheduleDate === null) {
        data.scheduledFor = null;
        data.scheduledTimezone = null;
        // Unscheduling a partially published post keeps that status.
        if (existing.status === "SCHEDULED") data.status = "DRAFT";
      }

      await prisma.$transaction(async (tx) => {
        await tx.post.update({ where: { id }, data });

        if (mediaRows) {
          await tx.postMedia.deleteMany({ where: { postId: id } });
          if (mediaRows.length) {
            await tx.postMedia.createMany({
              data: mediaRows.map((row) => ({ ...row, postId: id })),
            });
          }
        }

        if (Array.isArray(accounts)) {
          await reconcilePostLegs(tx, id, existing.postAccounts, accounts);
        }
      });

      const updated = await prisma.post.findUnique({
        where: { id },
        include: POST_INCLUDE,
      });

      return res.json({ success: true, data: updated, message: "Post updated" });
    } catch (error) {
      if (error instanceof PostRuleError) return sendRuleError(res, error);
      console.error("Error updating post:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to update post" });
    }
  }

  /** Copy a post's content, media and accounts into a new draft. */
  async duplicatePost(req: Request, res: Response) {
    try {
      const userId = await findUserId(req.auth.userId);
      if (!userId) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const source = await prisma.post.findFirst({
        where: { id: req.params.id, userId },
        include: { media: true, postAccounts: true },
      });
      if (!source) {
        return res.status(404).json({ success: false, error: "Post not found" });
      }

      const copy = await prisma.post.create({
        data: {
          userId,
          type: source.type,
          mainCaption: source.mainCaption,
          status: "DRAFT",
          scheduledTimezone: source.scheduledTimezone,
          media: {
            create: source.media.map((m) => ({
              type: m.type,
              assetId: m.assetId,
              order: m.order,
            })),
          },
          postAccounts: {
            create: source.postAccounts.map((pa) => ({
              accountId: pa.accountId,
              customCaption: pa.customCaption,
              title: pa.title,
              settings: (pa.settings ?? Prisma.DbNull) as Prisma.InputJsonValue,
            })),
          },
        },
        include: POST_INCLUDE,
      });

      return res
        .status(201)
        .json({ success: true, data: copy, message: "Draft created" });
    } catch (error) {
      console.error("Error duplicating post:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to duplicate post" });
    }
  }

  async bulkDeletePosts(req: Request, res: Response) {
    try {
      const { ids } = req.body as { ids?: string[] };
      if (!Array.isArray(ids) || ids.length === 0) {
        return res
          .status(400)
          .json({ success: false, error: "Post IDs array is required" });
      }

      const userId = await findUserId(req.auth.userId);
      if (!userId) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      // Posts that are publishing right now are skipped; deleting them would
      // orphan the running job.
      const result = await prisma.post.deleteMany({
        where: { id: { in: ids }, userId, status: { not: "PUBLISHING" } },
      });

      return res.json({
        success: true,
        count: result.count,
        message: `${result.count} post${result.count === 1 ? "" : "s"} deleted`,
      });
    } catch (error) {
      console.error("Error bulk deleting posts:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to delete posts" });
    }
  }

  async deletePost(req: Request, res: Response) {
    try {
      const userId = await findUserId(req.auth.userId);
      if (!userId) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const post = await prisma.post.findFirst({
        where: { id: req.params.id, userId },
        select: { id: true, status: true },
      });
      if (!post) {
        return res.status(404).json({ success: false, error: "Post not found" });
      }
      if (post.status === "PUBLISHING") {
        return res.status(409).json({
          success: false,
          error: "This post is publishing right now. Try again in a minute.",
          code: "POST_PUBLISHING",
        });
      }

      await prisma.post.delete({ where: { id: post.id } });
      return res.json({ success: true, message: "Post deleted" });
    } catch (error) {
      console.error("Error deleting post:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to delete post" });
    }
  }

  /**
   * Publish an existing post now. Queues the publishing job and returns right
   * away with status PUBLISHING; clients poll the post for the outcome.
   */
  async publishPost(req: Request, res: Response) {
    return enqueuePublish(req, res, "publish");
  }

  /** Retry the accounts that failed. Published accounts are never re-posted. */
  async retryPost(req: Request, res: Response) {
    return enqueuePublish(req, res, "retry");
  }

  /** Create a post and publish it immediately. */
  async createAndPublishPost(req: Request, res: Response) {
    try {
      const {
        type = "VIDEO",
        mainCaption,
        media,
        accounts,
      } = req.body as {
        type?: string;
        mainCaption?: string;
        media?: MediaBody[];
        accounts?: AccountBody[];
      };

      if (!isPostType(type)) {
        return res
          .status(400)
          .json({ success: false, error: "Unknown post type", code: "INVALID_TYPE" });
      }
      if (!accounts?.length) {
        return res.status(400).json({
          success: false,
          error: "Pick at least one account.",
          code: "ACCOUNT_REQUIRED",
        });
      }

      const userId = await findUserId(req.auth.userId);
      if (!userId) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const owned = await loadOwnedAccounts(
        userId,
        accounts.map((a) => a.accountId),
      );
      assertMediaMatchesType(type, media, true);
      assertProvidersSupportType(
        type,
        owned.map((a) => a.provider),
      );

      const mediaRows = media?.length
        ? await buildMediaRows(userId, media)
        : undefined;

      const post = await prisma.post.create({
        data: {
          userId,
          type,
          mainCaption: mainCaption ?? "",
          status: "PUBLISHING",
          scheduledFor: null,
          media: mediaRows ? { create: mediaRows } : undefined,
          postAccounts: {
            create: accounts.map((a) => ({
              accountId: a.accountId,
              ...legData(a),
            })),
          },
        },
        include: POST_INCLUDE,
      });

      await addPostPublishingJob(
        { postId: post.id, userId },
        { jobId: `${post.id}:publish-now` },
      );

      return res
        .status(201)
        .json({ success: true, data: post, message: "Publishing started" });
    } catch (error) {
      if (error instanceof PostRuleError) return sendRuleError(res, error);
      console.error("Error creating and publishing post:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to publish post" });
    }
  }

  async updateAccountCaption(req: Request, res: Response) {
    try {
      const { id, accountId } = req.params;
      const { customCaption } = req.body as { customCaption?: string };

      const userId = await findUserId(req.auth.userId);
      if (!userId) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const post = await prisma.post.findFirst({
        where: { id, userId },
        select: { id: true },
      });
      if (!post) {
        return res.status(404).json({ success: false, error: "Post not found" });
      }

      const result = await prisma.postAccount.updateMany({
        where: { postId: id, accountId, published: false },
        data: { customCaption: customCaption || null },
      });
      if (result.count === 0) {
        return res
          .status(404)
          .json({ success: false, error: "Post account not found" });
      }

      return res.json({ success: true, message: "Caption updated" });
    } catch (error) {
      console.error("Error updating caption:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to update caption" });
    }
  }
}

async function enqueuePublish(
  req: Request,
  res: Response,
  mode: "publish" | "retry",
) {
  const { id } = req.params;
  try {
    const userId = await findUserId(req.auth.userId);
    if (!userId) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const post = await prisma.post.findFirst({
      where: { id, userId },
      select: {
        id: true,
        status: true,
        error: true,
        postAccounts: { select: { published: true } },
      },
    });
    if (!post) {
      return res.status(404).json({ success: false, error: "Post not found" });
    }

    if (post.status === "PUBLISHING") {
      return res.status(409).json({
        success: false,
        error: "This post is already publishing.",
        code: "POST_PUBLISHING",
      });
    }
    if (post.status === "PUBLISHED") {
      return res.status(400).json({
        success: false,
        error: "This post is already published.",
        code: "POST_PUBLISHED",
      });
    }
    if (
      mode === "retry" &&
      post.status !== "FAILED" &&
      post.status !== "PARTIALLY_PUBLISHED"
    ) {
      return res.status(400).json({
        success: false,
        error: "Only failed or partially published posts can be retried.",
        code: "NOT_RETRYABLE",
      });
    }
    if (post.postAccounts.every((pa) => pa.published)) {
      return res.status(400).json({
        success: false,
        error: "Every account on this post is already published.",
        code: "POST_PUBLISHED",
      });
    }

    await assertPublishable(id);

    const previous = { status: post.status, error: post.error };
    await prisma.post.update({
      where: { id },
      data: { status: "PUBLISHING", error: null },
    });

    try {
      // A fresh job id per attempt: the per-post key used by the scheduler
      // is deduplicated for 10 minutes and would swallow a quick retry.
      await addPostPublishingJob(
        { postId: id, userId },
        { jobId: `${id}:${mode}:${Date.now()}` },
      );
    } catch (queueError) {
      await prisma.post.update({ where: { id }, data: previous });
      throw queueError;
    }

    return res.status(202).json({
      success: true,
      message: mode === "retry" ? "Retry started" : "Publishing started",
      data: { postId: id, status: "PUBLISHING", results: [] },
    });
  } catch (error) {
    if (error instanceof PostRuleError) return sendRuleError(res, error);
    console.error(`Error starting ${mode} for post ${id}:`, error);
    return res.status(500).json({
      success: false,
      error:
        mode === "retry" ? "Couldn't start the retry" : "Couldn't start publishing",
    });
  }
}
