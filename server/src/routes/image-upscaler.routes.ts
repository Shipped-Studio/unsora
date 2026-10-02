import { Router } from "express";
import { ImageUpscaleController } from "../controllers/image-upscale.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();
const controller = new ImageUpscaleController();

router.post("/create", requireAuth, controller.createUpscale);
router.get("/all", requireAuth, controller.getUpscales);
router.get("/refresh/:jobId", requireAuth, controller.refreshUpscaleStatus);
router.delete("/:jobId", requireAuth, controller.deleteUpscale);

export default router;
