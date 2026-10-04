import { Router } from "express";
import { ImageController } from "../controllers/image.controller";
import { requireAuth } from "../middleware/auth";
import {
  legacyCreate,
  legacyImageBody,
} from "../controllers/legacy-create.controller";

const router = Router();
const imageController = new ImageController();

router.post("/create", requireAuth, legacyCreate(legacyImageBody));
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
