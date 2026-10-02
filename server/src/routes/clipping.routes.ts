import { Router } from "express";
import { ClippingController } from "../controllers/clipping.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();
const controller = new ClippingController();

router.post("/create", requireAuth, controller.create.bind(controller));
router.get("/all", requireAuth, controller.getAll.bind(controller));
router.get(
  "/refresh/:clippingId",
  requireAuth,
  controller.refresh.bind(controller),
);
router.delete(
  "/:clippingId/clips/:clipId",
  requireAuth,
  controller.deleteClip.bind(controller),
);
router.delete(
  "/:clippingId",
  requireAuth,
  controller.deleteJob.bind(controller),
);

export default router;
