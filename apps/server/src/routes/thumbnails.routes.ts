import { Router } from "express";
import { ThumbnailController } from "../controllers/thumbnail.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();
const thumbnailController = new ThumbnailController();

router.post(
  "/create",
  requireAuth,
  thumbnailController.createGeneration,
);
router.get("/", requireAuth, thumbnailController.getGenerations);
router.get(
  "/refresh/:generationId",
  requireAuth,
  thumbnailController.refreshGenerationStatus,
);
router.delete(
  "/:generationId",
  requireAuth,
  thumbnailController.deleteGeneration,
);

export default router;
