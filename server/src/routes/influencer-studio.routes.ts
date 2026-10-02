import { Router } from "express";
import { InfluencerStudioController } from "../controllers/influencer-studio.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();
const controller = new InfluencerStudioController();

router.post("/create", requireAuth, controller.create);
router.get("/all", requireAuth, controller.getAll);
router.get("/refresh/:generationId", requireAuth, controller.refresh);
router.delete("/:generationId", requireAuth, controller.delete);

export default router;
