import { Router } from "express";
import { VoiceCloneController } from "../controllers/voice-clone.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();
const controller = new VoiceCloneController();

router.get("/all", requireAuth, controller.listVoices.bind(controller));
router.post("/create", requireAuth, controller.createClone.bind(controller));
router.delete("/:cloneId", requireAuth, controller.deleteClone.bind(controller));

export default router;
