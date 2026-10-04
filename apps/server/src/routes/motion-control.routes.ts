import { Router } from "express";
import { MotionControlController } from "../controllers/motion-control.controller";
import { requireAuth } from "../middleware/auth";
import {
  legacyCreate,
  legacyMotionBody,
} from "../controllers/legacy-create.controller";

const router = Router();
const motionControlController = new MotionControlController();

router.post("/create", requireAuth, legacyCreate(legacyMotionBody));
router.get("/all", requireAuth, motionControlController.getGenerations);
router.get(
  "/refresh/:generationId",
  requireAuth,
  motionControlController.refreshStatus,
);
router.delete(
  "/:generationId",
  requireAuth,
  motionControlController.deleteGeneration,
);

export default router;
