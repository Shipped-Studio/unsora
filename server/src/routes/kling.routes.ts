import { Router } from "express";
import { KlingController } from "../controllers/kling.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();
const klingController = new KlingController();

router.post("/create-video", requireAuth, klingController.createVideo);
router.get("/all", requireAuth, klingController.getGenerations);
router.get(
  "/refresh/:generationId",
  requireAuth,
  klingController.refreshStatus,
);
router.delete(
  "/:generationId",
  requireAuth,
  klingController.deleteGeneration,
);

export default router;
