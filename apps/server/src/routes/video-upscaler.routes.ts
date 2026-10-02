import { Router } from "express";
import { VideoUpscalerController } from "../controllers/video-upscaler.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();
const controller = new VideoUpscalerController();

router.post("/create", requireAuth, controller.create);
router.get("/all", requireAuth, controller.getAll);
router.get("/refresh/:jobId", requireAuth, controller.refreshStatus);
router.delete("/:jobId", requireAuth, controller.delete);
router.delete("/", requireAuth, controller.deleteMany);

export default router;
