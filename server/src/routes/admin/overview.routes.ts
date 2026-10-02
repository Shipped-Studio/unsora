import { Router } from "express";
import { adminOverviewController } from "../../controllers/admin/overview.controller";

const router = Router();

router.get("/", adminOverviewController.get.bind(adminOverviewController));

export default router;
