import { Router } from "express";
import { PostController } from "../controllers/post.controller";
import { analyticsController } from "../controllers/analytics.controller";
import { requireAuth } from "../middleware/auth";
import { requirePaidPlan } from "../middleware/require-paid-plan";

const router = Router();
const postController = new PostController();

router.use(requireAuth);

// Create post — requires an active paid plan
router.post(
  "/",
  requirePaidPlan,
  postController.createPost.bind(postController),
);

// Get all posts (with filters)
router.get("/", postController.getPosts.bind(postController));

// Analytics (registered before "/:id" so "analytics" isn't matched as an id)
router.get(
  "/analytics/summary",
  analyticsController.getSummary.bind(analyticsController),
);
router.post(
  "/analytics/refresh",
  analyticsController.refresh.bind(analyticsController),
);

// Post counts per status (before "/:id")
router.get("/counts", postController.getPostCounts.bind(postController));

// Get single post
router.get("/:id", postController.getPostById.bind(postController));

// Copy a post into a new draft — requires an active paid plan
router.post(
  "/:id/duplicate",
  requirePaidPlan,
  postController.duplicatePost.bind(postController),
);

// Update post — requires an active paid plan
router.put(
  "/:id",
  requirePaidPlan,
  postController.updatePost.bind(postController),
);

// Bulk delete posts — requires an active paid plan
router.post(
  "/bulk-delete",
  requirePaidPlan,
  postController.bulkDeletePosts.bind(postController),
);

// Delete post — requires an active paid plan
router.delete(
  "/:id",
  requirePaidPlan,
  postController.deletePost.bind(postController),
);

// Publish post immediately — requires an active paid plan
router.post(
  "/:id/publish",
  requirePaidPlan,
  postController.publishPost.bind(postController),
);

// Retry a failed or partially published post — requires an active paid plan
router.post(
  "/:id/retry",
  requirePaidPlan,
  postController.retryPost.bind(postController),
);

// Create and publish post immediately (Post Now) — requires an active paid plan
router.post(
  "/publish-now",
  requirePaidPlan,
  postController.createAndPublishPost.bind(postController),
);

// Update custom caption for specific account — requires an active paid plan
router.put(
  "/:id/accounts/:accountId/caption",
  requirePaidPlan,
  postController.updateAccountCaption.bind(postController),
);

export default router;
