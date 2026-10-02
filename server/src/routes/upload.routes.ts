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

export default router;
