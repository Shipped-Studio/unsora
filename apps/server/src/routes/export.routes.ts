import { Router } from "express";
import { ExportController } from "../controllers/export.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();
const exportController = new ExportController();

router.post(
  "/",
  requireAuth,
  exportController.createExport.bind(exportController)
);

router.get(
  "/",
  requireAuth,
  exportController.getUserExports.bind(exportController)
);

router.get(
  "/job/:taskId",
  requireAuth,
  exportController.getJobStatus.bind(exportController)
);

router.get(
  "/:id",
  requireAuth,
  exportController.getExport.bind(exportController)
);

router.delete(
  "/:id",
  requireAuth,
  exportController.deleteExport.bind(exportController)
);

export default router;
