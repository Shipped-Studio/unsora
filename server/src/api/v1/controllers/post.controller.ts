import { Request, Response } from "express";
import { PostStatus, PostType, Prisma } from "@prisma/client";
import prisma from "../../../lib/db";
import { resolveUser } from "../helpers/resolve-user";
import { postInclude } from "../helpers/post-include";
import { buildMediaCreateData } from "../helpers/post-media";
import {
  parseAccounts,
  parsePagination,
  parsePostStatusFilter,
  parseOptionalPostType,
  parseScheduledFor,
} from "../helpers/post-validation";
import { normalizeCreatePostBody } from "../helpers/normalize-create-post";
import { formatPublicPostSummary } from "../helpers/public-post-response";
import { withPublicCreate } from "../helpers/public-create";
import { handlePublicError, sendError } from "../helpers/public-response";
import { postAccountSettingsForProvider } from "../helpers/post-platform-settings";
import { postService } from "../../../services/post.service";

async function verifyUserAccounts(userId: string, accountIds: string[]) {
  const uniqueIds = [...new Set(accountIds)];
  const userAccounts = await prisma.socialAccount.findMany({
    where: { id: { in: uniqueIds }, userId },
    select: { id: true },
  });
  if (userAccounts.length !== uniqueIds.length) {
    return false;
  }
  return true;
}

export class PublicPostController {
  createPost = async (req: Request, res: Response) => {
    try {
      const externalId = req.body?.external_id;

      if (
        typeof externalId === "string" &&
        externalId.trim() &&
        !req.headers["idempotency-key"]
      ) {
        req.headers["idempotency-key"] = externalId.trim().slice(0, 128);
      }

      await withPublicCreate(req, res, 201, async () => {
        const normalized = normalizeCreatePostBody(req.body);

        if (!normalized.ok) {
          res.status(400).json({ success: false, error: normalized.error });
          return null;
        }

        const payload = normalized.value;
        
        const user = await resolveUser(req.auth.userId);
        
        if (!user) {
          res.status(404).json({ success: false, error: "User not found" });
          return null;
        }

        const accountIds = payload.accounts.map((a) => a.accountId);
        
        const ownsAccounts = await verifyUserAccounts(user.id, accountIds);
        
        if (!ownsAccounts) {
          
          res.status(403).json({
            success: false,
            error: "One or more accounts do not belong to you",
            code: "UNKNOWN_ACCOUNTS",
          });
          return null;
        }

        const linkedAccounts = await prisma.socialAccount.findMany({
          where: { id: { in: accountIds }, userId: user.id },
          select: { id: true, provider: true },
        });

        const status: PostStatus = payload.scheduledAt ? "SCHEDULED" : "DRAFT";

        let mediaCreateData:
          | Awaited<ReturnType<typeof buildMediaCreateData>>
          | undefined;
        if (payload.media?.length) {
          mediaCreateData = await buildMediaCreateData(
            user.id,
            payload.media,
          );
        }

        const post = await prisma.post.create({
          data: {
            userId: user.id,
            type: payload.postType,
            mainCaption: payload.caption,
            status,
            scheduledFor: payload.scheduledAt,
            scheduledTimezone: payload.timezone,
            media: mediaCreateData
              ? { create: mediaCreateData }
              : undefined,
            postAccounts: {
              create: payload.accounts.map((a) => {
                const provider =
                  linkedAccounts.find((la) => la.id === a.accountId)
                    ?.provider ?? "";
                const accountSettings = postAccountSettingsForProvider(
                  provider,
                  payload.platformSettings,
                );
                return {
                  accountId: a.accountId,
                  customCaption: a.customCaption ?? null,
                  title: a.title ?? null,
                  settings: accountSettings
                    ? (accountSettings as Prisma.InputJsonValue)
                    : undefined,
                };
              }),
            },
          },
          include: postInclude,
        });

        const body = {
          success: true,
          data: formatPublicPostSummary(post),
          message: payload.scheduledAt
            ? "Post scheduled"
            : "Post saved as draft",
        };

        return body;
      });
    } catch (error) {
      return handlePublicError(
        res,
        error,
        "Create post error:",
        "Failed to create post",
      );
    }
  };

  listPosts = async (req: Request, res: Response) => {
    try {
      const statusResult = parsePostStatusFilter(req.query.status);
      
      if (!statusResult.ok) {
        return sendError(res, 400, statusResult.error);
      }

      const typeResult = parseOptionalPostType(req.query.type);

      if (!typeResult.ok) {
        return sendError(res, 400, typeResult.error);
      }

      const paginationResult = parsePagination(
        req.query.page,
        req.query.limit,
      );
      if (!paginationResult.ok) {
        return sendError(res, 400, paginationResult.error);
      }
      const { page, limit, skip } = paginationResult.value;

      const user = await resolveUser(req.auth.userId);
      if (!user) {
        return sendError(res, 404, "User not found");
      }

      const where: { userId: string; status?: PostStatus; type?: PostType } = {
        userId: user.id,
      };

      if (statusResult.value) where.status = statusResult.value;
      
      if (typeResult.value) where.type = typeResult.value;

      const [posts, total] = await Promise.all([
        prisma.post.findMany({
          where,
          include: postInclude,
          orderBy: { createdAt: "desc" },
          skip,
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
      return handlePublicError(
        res,
        error,
        "List posts error:",
        "Failed to fetch posts",
      );
    }
  };

  getPost = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id?.trim()) {
        return sendError(res, 400, "Post ID is required");
      }

      const user = await resolveUser(req.auth.userId);
      if (!user) {
        return sendError(res, 404, "User not found");
      }

      const post = await prisma.post.findFirst({
        where: { id, userId: user.id },
        include: postInclude,
      });

      if (!post) {
        return sendError(res, 404, "Post not found");
      }

      return res.json({ success: true, data: post });
    } catch (error) {
      return handlePublicError(
        res,
        error,
        "Get post error:",
        "Failed to fetch post",
      );
    }
  };

  retryPost = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id?.trim()) {
        return sendError(res, 400, "Post ID is required");
      }

      const user = await resolveUser(req.auth.userId);
      if (!user) {
        return sendError(res, 404, "User not found");
      }

      const post = await prisma.post.findFirst({
        where: { id, userId: user.id },
        select: { id: true, status: true },
      });

      if (!post) {
        return sendError(res, 404, "Post not found");
      }

      if (post.status !== "FAILED" && post.status !== "PARTIALLY_PUBLISHED") {
        return sendError(
          res,
          400,
          `Only failed or partially published posts can be retried (status: ${post.status})`,
        );
      }

      const result = await postService.retryPost(id);

      return res.json({
        success: result.success,
        message: result.success
          ? "Post published successfully"
          : "Retry completed with some errors",
        data: {
          postId: id,
          results: result.results,
        },
      });
    } catch (error) {
      return handlePublicError(
        res,
        error,
        "Retry post error:",
        "Failed to retry post",
      );
    }
  };

  updatePost = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!id?.trim()) {
        return sendError(res, 400, "Post ID is required");
      }

      const { mainCaption, scheduledFor, timezone, accounts } = req.body;

      if (
        mainCaption !== undefined &&
        (typeof mainCaption !== "string" || mainCaption.trim().length === 0)
      ) {
        return sendError(res, 400, "mainCaption must be a non-empty string");
      }

      const scheduleResult = parseScheduledFor(scheduledFor);

      if (!scheduleResult.ok) {
        return sendError(res, 400, scheduleResult.error);
      }

      let accountsResult: ReturnType<typeof parseAccounts> | undefined;
      
      if (accounts !== undefined) {
        accountsResult = parseAccounts(accounts);
        if (!accountsResult.ok) {
          return sendError(res, 400, accountsResult.error);
        }
      }

      const user = await resolveUser(req.auth.userId);
      
      if (!user) {
        return sendError(res, 404, "User not found");
      }

      const existingPost = await prisma.post.findFirst({
        where: { id, userId: user.id },
        select: { id: true, status: true },
      });

      if (!existingPost) {
        return sendError(res, 404, "Post not found");
      }

      if (existingPost.status === "PUBLISHED") {
        return sendError(res, 400, "Cannot edit published posts");
      }

      if (accountsResult?.ok) {
        const ownsAccounts = await verifyUserAccounts(
          user.id,
          accountsResult.value.map((a) => a.accountId),
        );
        if (!ownsAccounts) {
          return sendError(
            res,
            403,
            "One or more accounts do not belong to you",
          );
        }
      }

      const updateData: {
        mainCaption?: string;
        scheduledFor?: Date | null;
        scheduledTimezone?: string | null;
        status?: PostStatus;
      } = {};

      if (mainCaption !== undefined) {
        updateData.mainCaption = mainCaption.trim();
      }

      if (scheduleResult.value !== undefined) {
        if (scheduleResult.value) {
          updateData.scheduledFor = scheduleResult.value;
          updateData.scheduledTimezone =
            typeof timezone === "string" && timezone.trim()
              ? timezone.trim()
              : null;
          updateData.status = "SCHEDULED";
        } else {
          updateData.scheduledFor = null;
          updateData.scheduledTimezone = null;
          updateData.status = "DRAFT";
        }
      }

      await prisma.post.update({
        where: { id },
        data: updateData,
      });

      if (accountsResult?.ok) {
        await prisma.postAccount.deleteMany({ where: { postId: id } });
        await prisma.postAccount.createMany({
          data: accountsResult.value.map((a) => ({
            postId: id,
            accountId: a.accountId,
            customCaption: a.customCaption ?? null,
            title: a.title ?? null,
          })),
        });
      }

      const post = await prisma.post.findFirst({
        where: { id, userId: user.id },
        include: postInclude,
      });

      return res.json({
        success: true,
        data: post,
        message: "Post updated successfully",
      });
    } catch (error) {
      return handlePublicError(
        res,
        error,
        "Update post error:",
        "Failed to update post",
      );
    }
  };

  deletePost = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!id?.trim()) {
        return sendError(res, 400, "Post ID is required");
      }

      const user = await resolveUser(req.auth.userId);
      if (!user) {
        return sendError(res, 404, "User not found");
      }

      const post = await prisma.post.findFirst({
        where: { id, userId: user.id },
        select: { id: true },
      });

      if (!post) {
        return sendError(res, 404, "Post not found");
      }

      await prisma.post.delete({ where: { id } });

      return res.json({
        success: true,
        message: "Post deleted successfully",
      });
    } catch (error) {
      return handlePublicError(
        res,
        error,
        "Delete post error:",
        "Failed to delete post",
      );
    }
  };
}
