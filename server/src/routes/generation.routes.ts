import { Router } from "express";
import { GenerationController } from "../controllers/generation.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();
const generationController = new GenerationController();

router.post("/create-video", requireAuth, generationController.createVideo);
router.get("/all", requireAuth, generationController.getGenerations);
router.get(
  "/refresh/:generationId",
  requireAuth,
  generationController.refreshStatus,
);
router.delete(
  "/:generationId",
  requireAuth,
  generationController.deleteGeneration,
);
router.delete("/", requireAuth, generationController.deleteGenerations);

export default router;
