import { Router } from "express";
import { VideoGenerationController } from "../controllers/video-generation.controller";
import { requireAuth } from "../middleware/auth";
import {
  legacyCreate,
  legacyVideoBody,
} from "../controllers/legacy-create.controller";

const router = Router();
const controller = new VideoGenerationController();

router.post("/create", requireAuth, legacyCreate((body) => legacyVideoBody(body)));
router.get("/all", requireAuth, controller.getGenerations);
router.get("/refresh/:generationId", requireAuth, controller.refreshStatus);
router.delete("/:generationId", requireAuth, controller.deleteGeneration);
router.delete("/", requireAuth, controller.deleteGenerations);

export default router;
