import { Router } from "express";
import { VoiceGenerationController } from "../controllers/voice-generation.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();
const voiceController = new VoiceGenerationController();

router.get("/options", requireAuth, voiceController.getOptions);
router.post("/create", requireAuth, voiceController.createGeneration);
router.get("/all", requireAuth, voiceController.getGenerations);
router.get(
  "/refresh/:generationId",
  requireAuth,
  voiceController.refreshGenerationStatus,
);
router.delete(
  "/:generationId",
  requireAuth,
  voiceController.deleteGeneration,
);

export default router;
