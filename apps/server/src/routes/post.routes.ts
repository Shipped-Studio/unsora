import { Router } from "express";
import { PostController } from "../controllers/post.controller";
import { analyticsController } from "../controllers/analytics.controller";
import { requireAuth } from "../middleware/auth";
import { requireSchedulerAccess } from "../middleware/require-scheduler-access";

const router = Router();
const postController = new PostController();

router.use(requireAuth);

// Create post — requires scheduler access (paid plan or free tier)
router.post(
  "/",
  requireSchedulerAccess,
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

// Copy a post into a new draft — requires scheduler access (paid plan or free tier)
router.post(
  "/:id/duplicate",
  requireSchedulerAccess,
  postController.duplicatePost.bind(postController),
);

// Update post — requires scheduler access (paid plan or free tier)
router.put(
  "/:id",
  requireSchedulerAccess,
  postController.updatePost.bind(postController),
);

// Bulk delete posts — never gated, so a lapsed plan can still clear its queue
router.post(
  "/bulk-delete",
  postController.bulkDeletePosts.bind(postController),
);

// Delete post — never gated, so a lapsed plan can still clear its queue
router.delete(
  "/:id",
  postController.deletePost.bind(postController),
);

// Publish post immediately — requires scheduler access (paid plan or free tier)
router.post(
  "/:id/publish",
  requireSchedulerAccess,
  postController.publishPost.bind(postController),
);

// Retry a failed or partially published post — requires scheduler access (paid plan or free tier)
router.post(
  "/:id/retry",
  requireSchedulerAccess,
  postController.retryPost.bind(postController),
);

// Create and publish post immediately (Post Now) — requires scheduler access (paid plan or free tier)
router.post(
  "/publish-now",
  requireSchedulerAccess,
  postController.createAndPublishPost.bind(postController),
);

// Update custom caption for specific account — requires scheduler access (paid plan or free tier)
router.put(
  "/:id/accounts/:accountId/caption",
  requireSchedulerAccess,
  postController.updateAccountCaption.bind(postController),
);

export default router;
