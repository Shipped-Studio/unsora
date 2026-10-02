import { Router } from "express";
import { ImageController } from "../controllers/image.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();
const imageController = new ImageController();

router.post("/create", requireAuth, imageController.createGeneration);
router.get("/all", requireAuth, imageController.getGenerations);
router.get(
  "/refresh/:generationId",
  requireAuth,
  imageController.refreshGenerationStatus,
);
router.delete(
  "/:generationId",
  requireAuth,
  imageController.deleteGeneration,
);

export default router;
