import { Router } from "express";
import { UploadController } from "../controllers/upload.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();
const controller = new UploadController();

// Authenticated: mint a direct-upload URL for the browser.
router.post(
  "/signed-url",
  requireAuth,
  controller.createSignedUrl.bind(controller),
);

// Authenticated: import files from a link, Dropbox, Google Drive or OneDrive.
router.post("/import", requireAuth, controller.importFiles.bind(controller));

export default router;
