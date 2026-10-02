import { Router } from "express";
import { VideoController } from "../controllers/video.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();
const videoController = new VideoController();

router.post("/create-process", requireAuth, videoController.processVideo);
router.get("/all", requireAuth, videoController.getVideos);
router.get(
  "/refresh/:videoId",
  requireAuth,
  videoController.refreshVideoStatus
);
router.delete("/:videoId", requireAuth, videoController.deleteVideo);
router.delete("/", requireAuth, videoController.deleteVideos);

export default router;
