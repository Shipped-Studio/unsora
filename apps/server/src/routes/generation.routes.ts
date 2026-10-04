import { Router } from "express";
import { GenerationController } from "../controllers/generation.controller";
import { requireAuth } from "../middleware/auth";
import {
  legacyCreate,
  legacyVideoBody,
} from "../controllers/legacy-create.controller";

const router = Router();
const generationController = new GenerationController();

// Old Seedance route: same request, now priced live through the catalog.
router.post(
  "/create-video",
  requireAuth,
  legacyCreate((body) =>
    legacyVideoBody(body, { model: "seedance-2.0-fast", audio: false }),
  ),
);
router.get("/all", requireAuth, generationController.getGenerations);
router.get(
  "/refresh/:generationId",
  requireAuth,
  generationController.refreshStatus,
);
router.delete(
  "/:generationId",
  requireAuth,
  generationController.deleteGeneration,
);
router.delete("/", requireAuth, generationController.deleteGenerations);

export default router;
