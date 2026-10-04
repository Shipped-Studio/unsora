import { Router } from "express";
import { KlingController } from "../controllers/kling.controller";
import { requireAuth } from "../middleware/auth";
import {
  legacyCreate,
  legacyVideoBody,
} from "../controllers/legacy-create.controller";

const router = Router();
const klingController = new KlingController();

// Old Kling-only route: same request, now priced live through the catalog.
router.post(
  "/create-video",
  requireAuth,
  legacyCreate((body) => legacyVideoBody({ ...body, model: "kling-3.0-pro" })),
);
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
