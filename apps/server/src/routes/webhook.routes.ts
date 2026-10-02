import { Router } from "express";
import { WebhookController } from "../controllers/webhook.controller";

const router = Router();
const webhookController = new WebhookController();

// Facebook
router.get("/facebook", webhookController.facebookVerify);
router.post("/facebook", webhookController.facebookEvent);

// Instagram
router.get("/instagram", webhookController.instagramVerify);
router.post("/instagram", webhookController.instagramEvent);

// YouTube (PubSubHubbub / WebSub)
router.get("/youtube", webhookController.youtubeVerify);
router.post("/youtube", webhookController.youtubeEvent);

// TikTok
router.post("/tiktok", webhookController.tiktokEvent);

export default router;
