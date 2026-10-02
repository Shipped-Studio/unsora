import { Router } from "express";
import { VoiceConversionController } from "../controllers/voice-conversion.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();
const controller = new VoiceConversionController();

router.post("/create", requireAuth, controller.createConversion.bind(controller));
router.get("/all", requireAuth, controller.getConversions.bind(controller));
router.get(
  "/refresh/:conversionId",
  requireAuth,
  controller.refreshConversionStatus.bind(controller),
);
router.delete(
  "/:conversionId",
  requireAuth,
  controller.deleteConversion.bind(controller),
);

export default router;
