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

// B-roll library. Registered before "/:id" so "broll" isn't read as an id.
router.get(
  "/broll/search",
  requireAuth,
  subtitleController.searchBroll.bind(subtitleController),
);

router.post(
  "/broll/image",
  requireAuth,
  subtitleController.generateBroll.bind(subtitleController),
);

// Saved caption presets. Registered before "/:id" so "presets" isn't read as an id.
router.get(
  "/presets",
  requireAuth,
  subtitleController.listPresets.bind(subtitleController),
);

router.post(
  "/presets",
  requireAuth,
  subtitleController.createPreset.bind(subtitleController),
);

router.delete(
  "/presets/:presetId",
  requireAuth,
  subtitleController.deletePreset.bind(subtitleController),
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

router.post(
  "/:id/hook-title",
  requireAuth,
  subtitleController.generateHookTitle.bind(subtitleController),
);

router.post(
  "/:id/brolls/auto",
  requireAuth,
  subtitleController.autoBrolls.bind(subtitleController),
);

router.post(
  "/:id/project-title",
  requireAuth,
  subtitleController.projectTitle.bind(subtitleController),
);

router.post(
  "/:id/scenes",
  requireAuth,
  subtitleController.captionScenes.bind(subtitleController),
);

router.post(
  "/:id/ai-tools/:tool",
  requireAuth,
  subtitleController.runAiTool.bind(subtitleController),
);

router.post(
  "/:id/ai-tools/:tool/remove",
  requireAuth,
  subtitleController.removeAiTool.bind(subtitleController),
);

router.post(
  "/:id/translate",
  requireAuth,
  subtitleController.translateCaptions.bind(subtitleController),
);

router.post(
  "/:id/optimize",
  requireAuth,
  subtitleController.optimizeCaptions.bind(subtitleController),
);

router.post(
  "/:id/keywords",
  requireAuth,
  subtitleController.findKeywords.bind(subtitleController),
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
