import express from "express";
import { StripeController } from "../controllers/stripe.controller";
import { requireAuth } from "../middleware/auth";

const router = express.Router();

const stripeController = new StripeController();

// Create a separate router for webhook with raw body parsing
const stripeRouter = express.Router();

stripeRouter.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  stripeController.handleWebhook,
);

// Main router with JSON parsing for other routes
router.post(
  "/create-checkout-session",
  requireAuth,
  stripeController.generateCheckoutSession,
);

router.post("/cancel-trial", requireAuth, stripeController.cancelTrial);

// Plan switch for users who already have a subscription: opens a Checkout
// for the new plan; on payment the webhook carries remaining credits over
// and cancels the old subscription.
router.post("/upgrade-plan", requireAuth, stripeController.upgradePlan);

router.post(
  "/get-paid-subscription",
  requireAuth,
  stripeController.getPaidSubscription,
);

router.get(
  "/user-subscription",
  requireAuth,
  stripeController.getUserSubscription,
);

router.get(
  "/get-billing-portal-url",
  requireAuth,
  stripeController.getBillingPortalUrl,
);

// Subscription tiers (basic / pro / power). Source of truth is the `plans`
// table — the client renders these instead of hardcoding names/prices/credits.
router.get(
  "/subscription-plans",
  requireAuth,
  stripeController.getSubscriptionPlans,
);

// Top-up credit packs (one-time purchases). The list endpoint is auth-only
// because it's used from the in-app billing UI; if you want to surface pack
// pricing on a public marketing page, drop `requireAuth` from this one.
router.get("/credit-packs", requireAuth, stripeController.listCreditPacks);

router.post(
  "/create-topup-session",
  requireAuth,
  stripeController.createTopupCheckoutSession,
);

// Mount webhook router
router.use(stripeRouter);

export default router;
