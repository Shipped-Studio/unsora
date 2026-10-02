import { Router } from "express";
import { ScheduleController } from "../controllers/schedule.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();
const scheduleController = new ScheduleController();

router.use(requireAuth);

router.get("/slots", scheduleController.getSlots);
router.put("/slots", scheduleController.replaceSlots);
router.get("/next-slots", scheduleController.getNextSlots);

export default router;
