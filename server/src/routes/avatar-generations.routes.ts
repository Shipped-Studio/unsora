import { Router } from "express";
import { AvatarGenerationController } from "../controllers/avatar-generation.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();
const avatarController = new AvatarGenerationController();

router.post("/create", requireAuth, avatarController.createGeneration);
router.get("/all", requireAuth, avatarController.getGenerations);
router.get(
  "/refresh/:generationId",
  requireAuth,
  avatarController.refreshGenerationStatus,
);
router.delete(
  "/:generationId",
  requireAuth,
  avatarController.deleteGeneration,
);

export default router;
