import { Router } from "express";
import { MusicGenerationController } from "../controllers/music-generation.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();
const musicController = new MusicGenerationController();

router.post("/create", requireAuth, musicController.createGeneration);
router.get("/all", requireAuth, musicController.getGenerations);
router.get(
  "/refresh/:generationId",
  requireAuth,
  musicController.refreshGenerationStatus,
);
router.delete(
  "/:generationId",
  requireAuth,
  musicController.deleteGeneration,
);

export default router;
