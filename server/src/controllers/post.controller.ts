import { Request, Response } from "express";
import { prisma } from "../lib/db";
import { PostType, PostStatus, MediaType } from "@prisma/client";
import { postService } from "../services/post.service";
import { addPostPublishingJob } from "../queue/post.queue";
import { createAsset } from "../lib/asset-utils";

export class PostController {
  // Create a new post (draft or scheduled)
  async createPost(req: Request, res: Response) {
    try {
      const clerkId = req.auth.userId;
      const {
        type = "VIDEO",
        mainCaption,
        scheduledFor,
        timezone, // User's timezone (e.g., "America/New_York", "Asia/Dhaka")
        media, // Array of {type, url, order?, width?, height?, duration?, fileSize?, mimeType?}
        accounts, // Array of {accountId, customCaption?}
      } = req.body;

      // Validate required fields
      if (!mainCaption) {
        return res.status(400).json({
          success: false,
          error: "Main caption is required",
        });
      }

      if (!accounts || accounts.length === 0) {
        return res.status(400).json({
          success: false,
          error: "At least one account must be selected",
        });
      }

      // Get user
      const user = await prisma.user.findUnique({
        where: { clerkId },
        select: { id: true },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      // Verify all accounts belong to user
      const accountIds = accounts.map((a: any) => a.accountId);
      const userAccounts = await prisma.socialAccount.findMany({
        where: {
          id: { in: accountIds },
          userId: user.id,
        },
      });

      if (userAccounts.length !== accountIds.length) {
        return res.status(403).json({
          success: false,
          error: "One or more accounts do not belong to you",
        });
      }

      // Determine status
      const status: PostStatus = scheduledFor ? "SCHEDULED" : "DRAFT";

      // The client sends `scheduledFor` as an ISO 8601 string in UTC
      // (`Date#toJSON` is called by `JSON.stringify`), which already encodes
      // the user's wall-clock time in their local timezone as the correct UTC
      // instant. We only need to parse it; the IANA `timezone` is stored
      // separately for display.
      const utcDate = scheduledFor ? new Date(scheduledFor) : null;

      // Create asset records for media, then create post
      let mediaCreateData: any[] | undefined;
      if (media) {
        const mediaAssets = await Promise.all(
          media.map(async (m: any) => {
            const asset = await createAsset({
              userId: user.id,
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
            return { asset, m };
          })
        );
        mediaCreateData = mediaAssets.map(({ asset, m }, index) => ({
          type: m.type as MediaType,
          assetId: asset.id,
          order: m.order ?? index,
        }));
      }

      const post = await prisma.post.create({
        data: {
          userId: user.id,
          type: type as PostType,
          mainCaption,
          status,
          scheduledFor: utcDate,
          scheduledTimezone: timezone || null,
          media: mediaCreateData
            ? { create: mediaCreateData }
            : undefined,
          postAccounts: {
            create: accounts.map((a: any) => ({
              accountId: a.accountId,
              customCaption: a.customCaption || null,
              title: a.title || null,
              // Per-account platform options (e.g. TikTok privacy level,
              // interaction toggles, commercial-content disclosure).
              settings:
                a.settings && typeof a.settings === "object"
                  ? a.settings
                  : undefined,
            })),
          },
        },
        include: {
          media: {
            orderBy: { order: "asc" },
            include: { asset: true },
          },
          postAccounts: {
            include: {
              account: {
                select: {
                  id: true,
                  provider: true,
                  accountName: true,
                  accountUsername: true,
                  profilePicture: true,
                },
              },
            },
          },
        },
      });

      return res.status(201).json({
        success: true,
        data: post,
        message: scheduledFor
          ? "Post scheduled successfully"
          : "Post saved as draft",
      });
    } catch (error) {
      console.error("Error creating post:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to create post",
      });
    }
  }

  // Get all posts for user
  async getPosts(req: Request, res: Response) {
    try {
      const clerkId = req.auth.userId;
      const { status, type, page = 1, limit = 20 } = req.query;

      const user = await prisma.user.findUnique({
        where: { clerkId },
        select: { id: true },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      const skip = (Number(page) - 1) * Number(limit);

      const where: any = { userId: user.id };
      if (status) where.status = status;
      if (type) where.type = type;

      const [posts, total] = await Promise.all([
        prisma.post.findMany({
          where,
          include: {
            media: {
              orderBy: { order: "asc" },
              include: { asset: true },
            },
            postAccounts: {
              include: {
                account: {
                  select: {
                    id: true,
                    provider: true,
                    accountName: true,
                    accountUsername: true,
                    profilePicture: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: Number(limit),
        }),
        prisma.post.count({ where }),
      ]);

      return res.json({
        success: true,
        data: {
          posts,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (error) {
      console.error("Error fetching posts:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch posts",
      });
    }
  }

  // Get single post by ID
  async getPostById(req: Request, res: Response) {
    try {
      const clerkId = req.auth.userId;
      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: { clerkId },
        select: { id: true },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      const post = await prisma.post.findFirst({
        where: {
          id,
          userId: user.id,
        },
        include: {
          media: {
            orderBy: { order: "asc" },
            include: { asset: true },
          },
          postAccounts: {
            include: {
              account: {
                select: {
                  id: true,
                  provider: true,
                  accountName: true,
                  accountUsername: true,
                  profilePicture: true,
                },
              },
            },
          },
        },
      });

      if (!post) {
        return res.status(404).json({
          success: false,
          error: "Post not found",
        });
      }

      return res.json({
        success: true,
        data: post,
      });
    } catch (error) {
      console.error("Error fetching post:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch post",
      });
    }
  }

  // Update post
  async updatePost(req: Request, res: Response) {
    try {
      const clerkId = req.auth.userId;
      const { id } = req.params;
      const { type, mainCaption, scheduledFor, timezone, accounts, media } =
        req.body;

      const user = await prisma.user.findUnique({
        where: { clerkId },
        select: { id: true },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      // Verify post belongs to user
      const existingPost = await prisma.post.findFirst({
        where: {
          id,
          userId: user.id,
        },
      });

      if (!existingPost) {
        return res.status(404).json({
          success: false,
          error: "Post not found",
        });
      }

      // Can't edit published posts
      if (existingPost.status === "PUBLISHED") {
        return res.status(400).json({
          success: false,
          error: "Cannot edit published posts",
        });
      }

      const updateData: any = {};

      if (mainCaption !== undefined) {
        updateData.mainCaption = mainCaption;
      }

      if (type === "VIDEO" || type === "CAROUSEL" || type === "IMAGE") {
        updateData.type = type;
      }

      if (scheduledFor !== undefined) {
        if (scheduledFor) {
          // Convert from user's timezone to UTC
          const scheduledForUTC = new Date(scheduledFor);
          updateData.scheduledFor = scheduledForUTC;
          updateData.scheduledTimezone = timezone || null;
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

      // Replace media if provided (the client always sends the full list).
      if (Array.isArray(media)) {
        const mediaAssets = await Promise.all(
          media.map(async (m: any, index: number) => {
            const asset = await createAsset({
              userId: user.id,
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
              postId: id,
              type: m.type as MediaType,
              assetId: asset.id,
              order: m.order ?? index,
            };
          }),
        );

        await prisma.postMedia.deleteMany({ where: { postId: id } });
        await prisma.postMedia.createMany({ data: mediaAssets });
      }

      // Update accounts if provided
      if (accounts) {
        // Delete old accounts
        await prisma.postAccount.deleteMany({
          where: { postId: id },
        });

        // Create new accounts
        await prisma.postAccount.createMany({
          data: accounts.map((a: any) => ({
            postId: id,
            accountId: a.accountId,
            customCaption: a.customCaption || null,
            title: a.title || null,
            settings:
              a.settings && typeof a.settings === "object"
                ? a.settings
                : undefined,
          })),
        });
      }

      // Re-fetch after media/account replacement so the response is current.
      const updatedPost = await prisma.post.findUnique({
        where: { id },
        include: {
          media: {
            orderBy: { order: "asc" },
            include: { asset: true },
          },
          postAccounts: {
            include: {
              account: {
                select: {
                  id: true,
                  provider: true,
                  accountName: true,
                  accountUsername: true,
                  profilePicture: true,
                },
              },
            },
          },
        },
      });

      return res.json({
        success: true,
        data: updatedPost,
        message: "Post updated successfully",
      });
    } catch (error) {
      console.error("Error updating post:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to update post",
      });
    }
  }

  // Bulk delete posts
  async bulkDeletePosts(req: Request, res: Response) {
    try {
      const clerkId = req.auth.userId;
      const { ids } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Post IDs array is required",
        });
      }

      const user = await prisma.user.findUnique({
        where: { clerkId },
        select: { id: true },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      const result = await prisma.post.deleteMany({
        where: {
          id: { in: ids },
          userId: user.id,
        },
      });

      return res.json({
        success: true,
        count: result.count,
        message: `${result.count} post${result.count !== 1 ? "s" : ""} deleted successfully`,
      });
    } catch (error) {
      console.error("Error bulk deleting posts:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to delete posts",
      });
    }
  }

  // Delete post
  async deletePost(req: Request, res: Response) {
    try {
      const clerkId = req.auth.userId;
      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: { clerkId },
        select: { id: true },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      // Verify post belongs to user
      const post = await prisma.post.findFirst({
        where: {
          id,
          userId: user.id,
        },
      });

      if (!post) {
        return res.status(404).json({
          success: false,
          error: "Post not found",
        });
      }

      // Delete post (cascade will delete media and postAccounts)
      await prisma.post.delete({
        where: { id },
      });

      return res.json({
        success: true,
        message: "Post deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting post:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to delete post",
      });
    }
  }

  // Publish post now (immediately)
  async publishPost(req: Request, res: Response) {
    try {
      const clerkId = req.auth.userId;
      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: { clerkId },
        select: { id: true },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      // Get post with accounts
      const post = await prisma.post.findFirst({
        where: {
          id,
          userId: user.id,
        },
        include: {
          media: {
            orderBy: { order: "asc" },
            include: { asset: true },
          },
          postAccounts: {
            include: {
              account: true,
            },
          },
        },
      });

      if (!post) {
        return res.status(404).json({
          success: false,
          error: "Post not found",
        });
      }

      // Can't publish already published posts
      if (post.status === "PUBLISHED") {
        return res.status(400).json({
          success: false,
          error: "Post is already published",
        });
      }

      // Use post service to publish
      const result = await postService.publishPost(id);

      return res.json({
        success: result.success,
        message: result.success
          ? "Post published successfully"
          : "Post published with some errors",
        data: {
          postId: id,
          results: result.results,
        },
      });
    } catch (error) {
      console.error("Error publishing post:", error);

      // Update post status to FAILED
      await prisma.post.update({
        where: { id: req.params.id },
        data: {
          status: "FAILED",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });

      return res.status(500).json({
        success: false,
        error: "Failed to publish post",
      });
    }
  }

  // Retry a failed or partially published post (only failed accounts are re-attempted)
  async retryPost(req: Request, res: Response) {
    try {
      const clerkId = req.auth.userId;
      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: { clerkId },
        select: { id: true },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      const post = await prisma.post.findFirst({
        where: { id, userId: user.id },
        select: { id: true, status: true },
      });

      if (!post) {
        return res.status(404).json({
          success: false,
          error: "Post not found",
        });
      }

      if (post.status !== "FAILED" && post.status !== "PARTIALLY_PUBLISHED") {
        return res.status(400).json({
          success: false,
          error: `Only failed or partially published posts can be retried (status: ${post.status})`,
        });
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
      console.error("Error retrying post:", error);
      return res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to retry post",
      });
    }
  }

  // Create and publish post immediately (Post Now)
  async createAndPublishPost(req: Request, res: Response) {
    try {
      const clerkId = req.auth.userId;
      const { type = "VIDEO", mainCaption, media, accounts } = req.body;

      // Validate required fields
      if (!mainCaption) {
        return res.status(400).json({
          success: false,
          error: "Main caption is required",
        });
      }

      if (!accounts || accounts.length === 0) {
        return res.status(400).json({
          success: false,
          error: "At least one account must be selected",
        });
      }

      // Get user
      const user = await prisma.user.findUnique({
        where: { clerkId },
        select: { id: true },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      // Verify all accounts belong to user
      const accountIds = accounts.map((a: any) => a.accountId);
      const userAccounts = await prisma.socialAccount.findMany({
        where: {
          id: { in: accountIds },
          userId: user.id,
        },
      });

      if (userAccounts.length !== accountIds.length) {
        return res.status(403).json({
          success: false,
          error: "One or more accounts do not belong to you",
        });
      }

      // Create asset records for media, then create post as PUBLISHING
      let mediaCreateData: any[] | undefined;
      if (media) {
        const mediaAssets = await Promise.all(
          media.map(async (m: any) => {
            const asset = await createAsset({
              userId: user.id,
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
            return { asset, m };
          })
        );
        mediaCreateData = mediaAssets.map(({ asset, m }, index) => ({
          type: m.type as MediaType,
          assetId: asset.id,
          order: m.order ?? index,
        }));
      }

      const post = await prisma.post.create({
        data: {
          userId: user.id,
          type: type as PostType,
          mainCaption,
          status: "PUBLISHING",
          scheduledFor: null,
          media: mediaCreateData
            ? { create: mediaCreateData }
            : undefined,
          postAccounts: {
            create: accounts.map((a: any) => ({
              accountId: a.accountId,
              customCaption: a.customCaption || null,
              title: a.title || null,
              settings:
                a.settings && typeof a.settings === "object"
                  ? a.settings
                  : undefined,
            })),
          },
        },
        include: {
          media: {
            orderBy: { order: "asc" },
            include: { asset: true },
          },
          postAccounts: {
            include: {
              account: true,
            },
          },
        },
      });

      // Enqueue for background publishing and return immediately. Publishing
      // can take minutes (TikTok processing polls every 5s), so the worker
      // handles it and the client tracks progress from the posts page.
      await addPostPublishingJob({ postId: post.id, userId: user.id });

      return res.status(201).json({
        success: true,
        data: post,
        message: "Post queued for publishing",
      });
    } catch (error) {
      console.error("Error creating and publishing post:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to create and publish post",
      });
    }
  }

  // Update custom caption for specific account
  async updateAccountCaption(req: Request, res: Response) {
    try {
      const clerkId = req.auth.userId;
      const { id, accountId } = req.params;
      const { customCaption } = req.body;

      const user = await prisma.user.findUnique({
        where: { clerkId },
        select: { id: true },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      // Verify post belongs to user
      const post = await prisma.post.findFirst({
        where: {
          id,
          userId: user.id,
        },
      });

      if (!post) {
        return res.status(404).json({
          success: false,
          error: "Post not found",
        });
      }

      // Update post account
      const postAccount = await prisma.postAccount.updateMany({
        where: {
          postId: id,
          accountId,
        },
        data: {
          customCaption: customCaption || null,
        },
      });

      if (postAccount.count === 0) {
        return res.status(404).json({
          success: false,
          error: "Post account not found",
        });
      }

      return res.json({
        success: true,
        message: "Caption updated successfully",
      });
    } catch (error) {
      console.error("Error updating caption:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to update caption",
      });
    }
  }
}
