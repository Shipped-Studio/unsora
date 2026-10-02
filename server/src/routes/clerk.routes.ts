import express from "express";
import { Router } from "express";
import { ClerkController } from "../controllers/clerk.controller";

const router = Router();
const clerkController = new ClerkController();

router.post(
  "/webhooks",
  express.raw({ type: "application/json" }),
  clerkController.webhooks
);

export default router;
