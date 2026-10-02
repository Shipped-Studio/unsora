import { Router } from "express";
import { SubtitleController } from "../controllers/subtitle.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();
const subtitleController = new SubtitleController();

// All routes require authentication
router.post(
  "/create",
  requireAuth,
  subtitleController.createTranscription.bind(subtitleController),
);

router.post(
  "/:id/start",
  requireAuth,
  subtitleController.startTranscription.bind(subtitleController),
);

router.post(
  "/transcribe/batch",
  requireAuth,
  subtitleController.queueBatchTranscribeVideos.bind(subtitleController),
);

router.post(
  "/transcribe",
  requireAuth,
  subtitleController.queueTranscribeVideo.bind(subtitleController),
);

router.get(
  "/:id",
  requireAuth,
  subtitleController.getTranscription.bind(subtitleController),
);

router.get(
  "/:id/status",
  requireAuth,
  subtitleController.getTranscriptionStatus.bind(subtitleController),
);

router.put(
  "/:id",
  requireAuth,
  subtitleController.updateTranscription.bind(subtitleController),
);

router.put(
  "/:id/chunks",
  requireAuth,
  subtitleController.updateSubtitleChunks.bind(subtitleController),
);

router.get(
  "/",
  requireAuth,
  subtitleController.getUserTranscriptions.bind(subtitleController),
);

router.get(
  "/queue/stats",
  requireAuth,
  subtitleController.getQueueStats.bind(subtitleController),
);

router.delete(
  "/bulk",
  requireAuth,
  subtitleController.deleteTranscriptions.bind(subtitleController),
);

router.delete(
  "/:id",
  requireAuth,
  subtitleController.deleteTranscription.bind(subtitleController),
);

export default router;
