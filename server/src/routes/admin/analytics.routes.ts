import { Router } from "express";
import { adminAnalyticsController } from "../../controllers/admin/analytics.controller";

const router = Router();

router.get("/", adminAnalyticsController.get.bind(adminAnalyticsController));

export default router;
